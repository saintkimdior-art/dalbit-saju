// AI 풀이 서버: API 키를 휴대폰이 아니라 서버에 숨겨 둬요.
// Netlify 환경변수: OPENAI_API_KEY (또는 GEMINI_API_KEY), 선택: AI_MODEL
export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const { prompt } = await req.json();
  if (typeof prompt !== 'string' || prompt.length > 4000) return new Response('bad prompt', { status: 400 });
  try {
    let text;
    if (process.env.OPENAI_API_KEY) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
      });
      if (!r.ok) throw new Error('openai ' + r.status);
      text = (await r.json()).choices[0].message.content;
    } else if (process.env.GEMINI_API_KEY) {
      const model = process.env.AI_MODEL || 'gemini-2.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      if (!r.ok) throw new Error('gemini ' + r.status);
      text = (await r.json()).candidates[0].content.parts[0].text;
    } else {
      return new Response('no AI key on server', { status: 500 });
    }
    return Response.json({ text });
  } catch (e) {
    return new Response(String(e.message), { status: 502 });
  }
};
