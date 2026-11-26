// AI 풀이 서버: API 키를 휴대폰이 아니라 서버에 숨겨 둬요.
// Netlify 금고(Keys and secrets)에 넣는 값
//   GEMINI_API_KEY  : 제미나이 열쇠 (선택)
//   OPENAI_API_KEY  : 오픈AI 열쇠 (선택)
//   GEMINI_MODEL    : 제미나이 모델 이름 (없으면 AI_MODEL, 그것도 없으면 gemini-4-hydrogen)
//   OPENAI_MODEL    : 오픈AI 모델 이름 (없으면 gpt-5-mini)
//   AI_PROVIDER     : 먼저 쓸 AI — gemini 또는 openai (없으면 gemini). 실패하면 다른 AI로 자동으로 넘어가요.
// 점검용: 브라우저로 /api/reading?test=1 을 열면 AI마다 연결 상태를 알려줘요 (열쇠 값은 보여주지 않아요).

const GEMINI_MODEL = () => process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-4-hydrogen';
const OPENAI_MODEL = () => process.env.OPENAI_MODEL || 'gpt-5-mini';
// Netlify AI Gateway가 켜져 있으면 OPENAI_BASE_URL을 자동으로 넣어 줘요 (오픈AI 가입 없이 Netlify 크레딧으로 사용)
const OPENAI_BASE = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); }
  catch (e) { if (e.name === 'AbortError') throw new Error(`${ms / 1000}초 안에 답이 안 왔어요`); throw e; }
  finally { clearTimeout(t); }
}
const short = async r => {
  const t = await r.text();
  try { const j = JSON.parse(t); return (j.error?.message || t).slice(0, 200); } catch { return t.slice(0, 200); }
};

async function gemini(prompt, signal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL())}:generateContent`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await short(r)}`);
  const parts = (await r.json()).candidates?.[0]?.content?.parts || [];
  return parts.filter(p => !p.thought && p.text).map(p => p.text).join('');
}
async function openai(prompt, signal, fast = true) {
  const body = { model: OPENAI_MODEL(), response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] };
  if (fast && /^(gpt-5|o\d)/.test(OPENAI_MODEL())) body.reasoning_effort = 'minimal'; // 생각을 짧게 → 훨씬 빨라요
  const r = await fetch(`${OPENAI_BASE()}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const msg = await short(r);
    // 이 모델이 '짧게 생각하기'를 모르면 그 옵션 없이 한 번 더 물어봐요
    if (fast && body.reasoning_effort && r.status === 400 && /reasoning/i.test(msg)) return openai(prompt, signal, false);
    throw new Error(`OpenAI ${r.status}: ${msg}`);
  }
  return (await r.json()).choices[0].message.content;
}

// 쓸 수 있는 AI 목록 (먼저 쓸 것부터)
function providers() {
  const list = [];
  if (process.env.GEMINI_API_KEY) list.push(['gemini', gemini]);
  if (process.env.OPENAI_API_KEY) list.push(['openai', openai]);
  if ((process.env.AI_PROVIDER || '').toLowerCase() === 'openai') list.reverse();
  return list;
}

// 첫 번째 AI가 실패하면(바쁨·오류·시간초과) 두 번째 AI로 넘어가요
async function askAI(prompt) {
  const list = providers();
  if (!list.length) throw new Error('금고에 AI 열쇠(GEMINI_API_KEY 또는 OPENAI_API_KEY)가 없어요.');
  const errors = [];
  const deadline = Date.now() + 23000; // 앱은 25초까지 기다려요
  for (let i = 0; i < list.length; i++) {
    const [, fn] = list[i];
    const left = deadline - Date.now();
    if (left < 2000) break;
    const limit = i < list.length - 1 ? Math.min(18000, left) : left; // 첫 AI에 넉넉히 18초
    try { return await withTimeout(limit, s => fn(prompt, s)); }
    catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join(' / '));
}

export default async (req) => {
  if (req.method === 'GET') {
    const info = {
      서버함수: '작동 중 ✅',
      먼저_쓰는_AI: providers().map(p => p[0]).join(' → ') || '없음 ❌',
      제미나이: process.env.GEMINI_API_KEY ? `열쇠 있음 ✅ (모델 ${GEMINI_MODEL()})` : '열쇠 없음',
      오픈AI: process.env.OPENAI_API_KEY ? `열쇠 있음 ✅ (모델 ${OPENAI_MODEL()}, ${process.env.OPENAI_BASE_URL ? 'Netlify AI 게이트웨이' : '오픈AI 직접'})` : '열쇠 없음'
    };
    const mode = new URL(req.url).searchParams.get('test');
    if (mode === '1' || mode === '2') {
      const prompt = mode === '1' ? '{"ok":true} 라는 JSON만 그대로 답하세요.'
        : '당신은 따뜻한 한국어 사주 상담가입니다. 일간 己(토), 오행 목0 화2 토2 금3 수1 인 사람의 성격·재물운·연애운을 각각 4문장으로 JSON {"personality":"","wealth":"","love":""} 으로만 답하세요.';
      for (const [name, fn] of providers()) {
        const t = Date.now();
        try { await withTimeout(20000, s => fn(prompt, s)); info[name + '_시험'] = `성공 ✅ (${((Date.now() - t) / 1000).toFixed(1)}초)`; }
        catch (e) { info[name + '_시험'] = `실패 ❌ (${((Date.now() - t) / 1000).toFixed(1)}초) ${e.message}`; }
      }
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
