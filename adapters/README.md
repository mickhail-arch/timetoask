# adapters/ — Адаптеры к внешним сервисам
 
Каждый адаптер — тонкая обёртка над внешним API.
Адаптеры импортируют только из core/.
Бизнес-логика в адаптерах ЗАПРЕЩЕНА — только HTTP-вызовы.
 
llm/       	— OpenRouter (@openrouter/ai-sdk-provider).
           	streamText() для SSE, generateText() для async.
           	Fallback модель обрабатывается здесь прозрачно.
 
payments/  	— ЮKassa. createPayment() + verifyWebhookSignature().
           	HMAC-SHA256 верификация — в адаптере, не в route.ts.
 
email/     	— SMTP через nodemailer. Fire-and-forget паттерн.
           	Ошибки email не критичны — логировать warn, не бросать.

ai-detection/ — Winston AI (внешний AI-детект) + detectAIByCode (кодовый, $0).
               Fallback: WINSTON_API_KEY не задан → LLM-детект.

moderation/   — Фронт-фильтр (dictionary.ts) + LLM-классификатор (Gemini Flash).
               Категории: A(блокировка), B(ограничения), C(дисклеймер), OK.

scraping/     — Cheerio. Парсинг HTML (заложено, не используется в express).

search/       — Serper.dev. Поиск выдачи (заложено, не используется в express).