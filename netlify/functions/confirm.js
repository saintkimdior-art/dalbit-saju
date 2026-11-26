// 결제 승인 서버: 토스페이먼츠에 "이 결제 진짜 맞아요?" 하고 최종 확인해요.
// Netlify 환경변수: TOSS_SECRET_KEY (test_sk_... 또는 live_sk_...), PRICE (예: 2900)
export default async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const { paymentKey, orderId, amount } = await req.json();
  const price = Number(process.env.PRICE || 2900);
  // 금액이 앱에서 몰래 바뀌지 않았는지 확인해요
  if (Number(amount) !== price) return new Response('amount mismatch', { status: 400 });
  const auth = Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64');
  const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: price })
  });
  const data = await r.json();
  return Response.json(data, { status: r.status });
};
