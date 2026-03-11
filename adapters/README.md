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