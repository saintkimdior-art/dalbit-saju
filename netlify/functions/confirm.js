// 결제 승인 서버: 토스페이먼츠에 "이 결제 진짜 맞아요?" 하고 최종 확인해요.
// Netlify 금고: TOSS_SECRET_KEY (test_sk_... 또는 live_sk_...)
// ★ 상품 가격을 바꾸면 index.html 의 CATALOG 가격과 여기 PRICES 를 똑같이 바꿔 주세요.
const PRICES = {"life": 9900, "wealth": 4900, "love": 3900, "match": 5900, "reunion": 5900, "marriage": 4900, "charm": 3900, "job": 3900, "move": 3900, "office": 3900, "business": 5900, "aptitude": 3900, "exam": 3900, "study": 3900, "child": 4900, "baby": 4900, "health": 3900, "daewoon": 6900, "newyear": 7900, "monthly": 5900, "thismonth": 2900, "samjae": 3900, "element": 3900, "windfall": 3900};

export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const { paymentKey, orderId, amount } = await req.json();
  // 주문번호 모양: ut-상품id-시간-임의문자
  const pid = String(orderId || '').split('-')[1];
  const price = PRICES[pid];
  // 금액이 앱에서 몰래 바뀌지 않았는지 확인해요
  if (!price || Number(amount) !== price) return new Response('amount mismatch', { status: 400 });
  const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64');
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: price })
  });
  const data = await r.json();
  return Response.json(data, { status: r.status });
};
