require('dotenv').config();

async function main() {
  const key = process.env.WINSTON_API_KEY;
  if (!key) { console.log('WINSTON_API_KEY not found in .env'); return; }

  const res = await fetch('https://api.gowinston.ai/v2/ai-content-detection', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'Каждый товар проходит девять этапов проверки перед отправкой покупателю. Эксперты анализируют материалы, швы, маркировку и упаковку. В прошлом году платформа отклонила более трёх процентов товаров на этапе проверки подлинности. Платформа завоевала доверие миллионов покупателей благодаря строгой системе верификации. Продавцы отправляют товары не покупателям напрямую, а в центр аутентификации. Специалисты проверяют оригинальность и только после этого передают посылку покупателю. Компания запустила сервис в 2015 году в Шанхае и за девять лет обработала более пятидесяти миллионов заказов от пользователей из ста восьмидесяти стран мира.',
      version: 'latest',
      sentences: true,
      language: 'ru',
    }),
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);