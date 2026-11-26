// AI 풀이 서버: API 키를 휴대폰이 아니라 서버에 숨겨 둬요.
// Netlify 금고(Keys and secrets): GEMINI_API_KEY 또는 OPENAI_API_KEY, 선택: AI_MODEL
// 점검용: 브라우저로 /api/reading?test=1 을 열면 연결 상태를 알려줘요 (열쇠 값은 보여주지 않아요).

async function askAI(prompt) {
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.AI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const data = await r.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    return parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
  }
  if (process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return (await r.json()).choices[0].message.content;
  }
  throw new Error('금고에 AI 열쇠(GEMINI_API_KEY 또는 OPENAI_API_KEY)가 없어요. 넣은 뒤 다시 배포했는지 확인하세요.');
}

export default async (req) => {
  // 점검 모드 (GET)
  if (req.method === 'GET') {
    const info = {
      서버함수: '작동 중 ✅',
      제미나이_열쇠: process.env.GEMINI_API_KEY ? '있음 ✅' : '없음 ❌',
      오픈AI_열쇠: process.env.OPENAI_API_KEY ? '있음 ✅' : '없음',
      모델: process.env.AI_MODEL || '(기본값)'
    };
    if (new URL(req.url).searchParams.get('test') === '1') {
      const t = Date.now();
      try {
        const text = await askAI('{"ok":true} 라는 JSON만 그대로 답하세요.');
        info.AI_시험 = '성공 ✅ ' + text.slice(0, 60);
      } catch (e) { info.AI_시험 = '실패 ❌ ' + e.message; }
      info.걸린시간_초 = ((Date.now() - t) / 1000).toFixed(1);
    }
    return new Response(JSON.stringify(info, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const { prompt } = await req.json();
  if (typeof prompt !== 'string' || prompt.length > 4000) return new Response('bad prompt', { status: 400 });
  try {
    return Response.json({ text: await askAI(prompt) });
  } catch (e) {
    return new Response(String(e.message), { status: 502 });
  }
};
