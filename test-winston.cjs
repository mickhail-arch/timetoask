require('dotenv').config();

const TEXTS = [
  {
    label: 'Тест 1',
    text: 'Платформа завоевала доверие миллионов покупателей благодаря строгой системе верификации. Продавцы отправляют товары не покупателям напрямую, а в центр аутентификации. Специалисты проверяют оригинальность и только после этого передают посылку покупателю.',
  },
  {
    label: 'Тест 2',
    text: 'Каждый товар проходит девять этапов проверки перед отправкой покупателю. Эксперты анализируют материалы, швы, маркировку и упаковку. В прошлом году платформа отклонила более трёх процентов товаров на этапе проверки подлинности. Платформа завоевала доверие миллионов покупателей благодаря строгой системе верификации. Продавцы отправляют товары не покупателям напрямую, а в центр аутентификации. Специалисты проверяют оригинальность и только после этого передают посылку покупателю.',
  },
  {
    label: 'Тест 3',
    suffix: ' (AI-текст)',
    text: 'В современном мире маркетплейсы играют важную роль в международной торговле. Стоит отметить, что платформы электронной коммерции предоставляют удобные инструменты для покупателей. Важно подчеркнуть, что система верификации обеспечивает высокий уровень доверия. Необходимо учитывать, что процесс аутентификации требует значительных ресурсов. Таким образом, платформы инвестируют в развитие технологий проверки подлинности. Следует подчеркнуть, что качество сервиса напрямую влияет на лояльность пользователей. В настоящее время компании активно развивают логистическую инфраструктуру. Кроме того, пользователи получают гарантию возврата средств при обнаружении подделки.',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callWinston(apiKey, text) {
  const res = await fetch('https://api.gowinston.ai/v2/ai-content-detection', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      version: 'latest',
      sentences: true,
      language: 'ru',
    }),
  });
  return res.json();
}

async function main() {
  const key = process.env.WINSTON_API_KEY;
  if (!key) {
    console.log('WINSTON_API_KEY not found in .env');
    return;
  }

  for (let i = 0; i < TEXTS.length; i++) {
    const { label, text, suffix } = TEXTS[i];
    const len = text.length;
    const header = `=== ${label}: ${len} символов${suffix || ''} ===`;

    try {
      const data = await callWinston(key, text);

      if (data.error || data.message) {
        console.log(header);
        console.log(`Ошибка: ${data.error || data.message}`);
      } else {
        const humanScore = data.score ?? data.result?.score ?? '?';
        const aiScore = humanScore !== '?' ? 100 - humanScore : '?';
        const sentences = data.sentences || data.result?.sentences || [];
        const problematic = sentences.filter((s) => s.score < 40).length;
        const creditsUsed = data.credits_used ?? data.result?.credits_used ?? '?';
        const creditsRemaining = data.credits_remaining ?? data.result?.credits_remaining ?? '?';

        console.log(header);
        console.log(
          `Human: ${humanScore} | AI: ${aiScore} | Проблемных: ${problematic} | Кредиты: -${creditsUsed} (осталось: ${creditsRemaining})`
        );
      }
    } catch (err) {
      console.log(header);
      console.log(`Ошибка: ${err.message}`);
    }

    if (i < TEXTS.length - 1) await sleep(1000);
    console.log();
  }
}

main().catch(console.error);
