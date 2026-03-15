UI_COMPONENTS.md
Конструктор интерфейса — оболочка, компоненты, AutoForm, Streaming UI
Продукт: Таймтуаск  ·  app.site.ru  ·  Версия: 1.0 MVP

Назначение документа
Описывает все компоненты интерфейса: из чего состоят, какие props принимают, как себя ведут. Cursor читает этот файл при создании или изменении любого UI-элемента.

•	Все токены — только из UI_TOKENS.md, никакого хардкода
•	Все shadcn/ui компоненты используются как примитивы — оборачиваются, не переписываются
•	Каждый компонент — отдельный файл в components/ui/ или components/app/
•	Логика (запросы, состояния) — только в хуках, не внутри компонентов

1. Оболочка кабинета / App Shell
Три зоны, которые не меняются при переходе между страницами. Реализуется как app/(dashboard)/layout.tsx.

1.1 Структура layout
app/(dashboard)/layout.tsx
├── <Sidebar />          — левая колонка, 220px, фиксированная
├── <div className="flex flex-col flex-1">
│   ├── <Header />       — верхняя полоса, 52px, фиксированная
│   └── <main>           — ContentArea, flex-1, overflow-y-auto
│       └── {children}   — содержимое страницы

→ Sidebar и Header — Server Components. children — могут быть Client
→ Вся оболочка защищена middleware: без сессии → редирект на /login

1.2 Sidebar
Элемент	Описание	Источник данных
Логотип + название	Верхний левый угол. Иконка 28px + текст «Таймтуаск»	Статика
Кнопка свернуть	Иконка ⊞ рядом с логотипом. MVP: заглушка (UI есть, функция в V2)	Статика
Nav-пункты	Список инструментов + «Баланс и пополнение». Иконка + текст	GET /api/tools (динамика)
«Поделиться»	Нижний левый угол. Иконка + текст. Открывает модалку шаринга	Статика

Nav-пункты — важное правило:
•	Список инструментов ВСЕГДА загружается из GET /api/tools через хук useTools()
•	Хардкод пунктов меню запрещён — инструменты меняются в БД без деплоя
•	«Баланс и пополнение» — единственный статичный пункт, всегда последний
•	Активный пункт определяется по usePathname() — background: --color-accent

1.3 Header
Элемент	Позиция	Описание
Breadcrumb	Левый край	📁 > Название инструмента. Компонент <Breadcrumb />
Баланс токенов	Правая группа	Число + «тк». Жирный. Обновляется через useBalance()
Кнопка «Пополнить»	Правая группа	Button variant=accent, size=sm. Ведёт на /billing
Поддержка	Правая группа	Иконка Telegram + текст «Поддержка». Внешняя ссылка
Аватар + email	Правая группа	Аватар-круг с инициалом + email пользователя. Открывает UserMenu
ID аккаунта	Правая группа	Текст «ID RA001». Размер xs, цвет secondary
Кнопка выхода	Крайний правый	Иконка выхода. signOut() из NextAuth

→ Порядок элементов в правой группе: баланс → пополнить → поддержка → аватар/email → ID → выход
→ Header — Server Component, баланс подгружается Client-хуком useBalance() внутри

1.4 MVP vs V2 — эволюция оболочки
Фича	MVP	V2
Sidebar	Статичный, 220px	Сворачивается до 56px (только иконки)
Недавнее в Sidebar	Нет	Последние открытые инструменты (как чаты в GPT)
Мобайл	Sidebar скрыт, бургер-кнопка	Bottom navigation

2. Базовые элементы / Primitives
Атомарные компоненты. Лежат в components/ui/. Все — обёртки над shadcn/ui.

2.1 Button
Prop	Тип	Значения	Описание
variant	string	accent | ghost | outline | danger	Визуальный стиль
size	string	sm | md | lg	sm=32px, md=44px, lg=52px высота
loading	boolean	true | false	Показывает спиннер, блокирует клик
disabled	boolean	true | false	Opacity 0.4, cursor not-allowed
fullWidth	boolean	true | false	width: 100% (auth-формы)

variant	Background	Text	Когда использовать
accent	--color-accent	--color-text-primary	Главное действие: «Войти», «Пополнить», «Запустить»
ghost	transparent	--color-text-primary	Вторичное действие рядом с accent
outline	transparent	--color-text-primary	Нейтральное действие, border: --color-border
danger	--color-error 10%	--color-error	Деструктивное: удалить, отозвать

2.2 Input
Prop	Тип	Описание
label	string	Floating label — маленький текст сверху при filled/focus
error	string	Текст ошибки под полем. Красный. Показывает border-error
type	string	text | email | password | number | textarea
disabled	boolean	Блокирует ввод, фон --color-bg-sidebar
hint	string	Подсказка под полем, цвет secondary (не ошибка)
→ Floating label: при пустом поле — placeholder-like, при фокусе/заполнении — уменьшается и поднимается
→ Textarea — тот же компонент Input с type=textarea и resize: vertical

2.3 Badge
Prop	Значения	Описание
variant	default | success | warning | error | accent	Цветовой вариант
size	sm | md	sm=12px текст, md=14px текст
→ Используется для: статус инструмента (active/beta), тип транзакции (TOPUP/DEBIT)

2.4 Avatar
Prop	Описание
email или name	Берёт первую букву, рендерит круг с инициалом
size	sm=24px, md=32px (дефолт в хедере)

2.5 Toast
Prop	Описание
type	success | error | info — цвет и иконка
message	Текст уведомления
duration	Авто-скрытие, default 4000ms
→ Реализуется через sonner (уже в shadcn/ui). Позиция: bottom-right. Z-index: --z-toast

2.6 Modal
Prop	Описание
open / onClose	Контролируемый режим
title	Заголовок модалки
size	sm=400px, md=560px, lg=720px
→ Backdrop click → закрывает. Esc → закрывает. Фокус-ловушка внутри

2.7 Breadcrumb
Показывает путь: 📁 > Название инструмента. Берёт данные из usePathname() + router.
→ Первый сегмент — всегда иконка папки. Разделитель — символ >. Последний сегмент — bold

3. Составные блоки / Composite Components
Компоненты из нескольких примитивов. Лежат в components/app/.

3.1 BalanceWidget
Показывает текущий баланс в хедере. Client Component.
Состояние	Отображение
Загрузка	Skeleton-плашка 60px × 20px
Баланс > 0	Число + «тк», жирный, цвет primary
Баланс = 0	Число + «тк», цвет error — красный
Ошибка	—  (прочерк)
const { balance } = useBalance()  // polling каждые 30 сек

3.2 UserMenu
Дропдаун по клику на аватар+email в хедере.
Пункт	Действие
Профиль	Переход на /profile
Настройки	Переход на /settings (V2)
Выйти	signOut() → редирект на /login
→ Для admin — дополнительный пункт «Админка» → /admin

3.3 NavItem
Один пункт бокового меню.
<NavItem icon={<IconEdit />} label="SEO-статья" href="/tools/seo-article" />
Prop	Описание
icon	SVG-иконка 18px, цвет наследуется от состояния
label	Текст пункта. size=sm, weight=medium
href	Путь. Активность определяется через usePathname()
badge	Опционально: Badge variant=accent для «new» или «beta»

4. Умная форма инструмента / AutoForm
Главный паттерн продукта. Zod-схема плагина автоматически превращается в форму — без написания кода для каждого инструмента.

4.1 Принцип работы
1.	Плагин определяет inputSchema в schema.ts — Zod-объект с .describe() на каждом поле
2.	AutoForm читает схему и рендерит соответствующие поля
3.	Пользователь заполняет форму и нажимает «Запустить»
4.	AutoForm валидирует данные через ту же Zod-схему перед отправкой
5.	Данные уходят в POST /api/tools/:id/execute

4.2 Маппинг типов Zod → поля формы
Zod-тип	Поле формы	Примечание
z.string()	Input type=text	.describe() → label
z.string().email()	Input type=email	Валидация email
z.string().min().max()	Textarea	Если min > 50 символов
z.enum([...])	Select / RadioGroup	Варианты из enum
z.boolean()	Checkbox / Toggle	
z.number()	Input type=number	.min()/.max() → ограничения
z.array(z.string())	TagInput	Добавление тегов
z.string().optional()	Любое поле	Не обязательное, без *

4.3 Props компонента
<AutoForm
  schema={plugin.inputSchema}     // Zod-схема из plugins/:id/schema.ts
  onSubmit={handleExecute}        // (data: z.infer<typeof schema>) => void
  loading={isExecuting}           // блокирует форму и кнопку
  tokenCost={plugin.token_cost}   // показывает стоимость на кнопке
  freeUsesLeft={freeUsesLeft}     // показывает остаток бесплатных запусков
/>

4.4 Кнопка запуска
Состояние	Текст кнопки	Вид
Есть бесплатные запуски	Запустить бесплатно (осталось N)	Button accent, fullWidth
Платный запуск	Запустить · N тк	Button accent, fullWidth
Нет баланса	Пополнить баланс	Button accent, fullWidth → /billing
Выполняется	Выполняется…	Button accent, loading=true, fullWidth

5. Стриминг и прогресс / Streaming UI
Два режима выполнения инструментов требуют разных UI-паттернов.

5.1 Sync режим (SSE-стрим, < 30 сек)
Шаг	UI
1. Запуск	Форма блокируется. Кнопка → loading. Появляется блок результата
2. Стриминг	Текст появляется посимвольно. Курсор-мигалка в конце. Прокрутка вниз
3. Завершение	Курсор исчезает. Кнопки «Копировать» и «Новый запрос» становятся активны
4. Ошибка	Toast error. Форма разблокируется. Баланс не списывается

Компонент StreamResult:
<StreamResult
  content={streamContent}    // string, накапливается по мере прихода SSE
  isStreaming={true/false}   // показывает/скрывает курсор
  outputFormat={plugin.output_format}  // text | html | json | markdown
/>

5.2 Async режим (jobId + polling)
Шаг	UI
1. Запуск	Форма блокируется. Возвращается jobId. Появляется JobProgress
2. Ожидание	Прогресс-бар + текущий шаг пайплайна (step_name из job_steps)
3. Каждые 2 сек	GET /api/jobs/:jobId/status → обновление шага и процента
4. Готово	JobProgress скрывается. Появляется JobResult с полным результатом
5. Ошибка	JobProgress показывает ошибку. Toast. Форма разблокируется

Компонент JobProgress:
<JobProgress
  jobId={jobId}
  steps={[                   // список шагов из manifest (для SEO: 10 шагов)
    { name: "Анализ конкурентов", status: "done" },
    { name: "Формирование ТЗ",    status: "active" },
    { name: "Написание статьи",   status: "pending" },
  ]}
  onComplete={(result) => setResult(result)}
/>

5.3 Отображение результата
output_format	Рендеринг
text	Простой текст, шрифт mono, whitespace-pre-wrap
markdown	ReactMarkdown с подсветкой кода
html	dangerouslySetInnerHTML в sandbox-div (только для доверенного HTML от LLM)
json	JSON.stringify с подсветкой синтаксиса
→ Кнопка «Копировать» — всегда копирует raw text, независимо от output_format

6. Файловая структура компонентов
components/
├── ui/                    ← Базовые примитивы (обёртки shadcn/ui)
│   ├── button.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── toast.tsx
│   ├── modal.tsx
│   └── breadcrumb.tsx
├── app/                   ← Составные компоненты приложения
│   ├── sidebar.tsx
│   ├── header.tsx
│   ├── nav-item.tsx
│   ├── balance-widget.tsx
│   ├── user-menu.tsx
│   ├── auto-form.tsx      ← Главный паттерн продукта
│   ├── stream-result.tsx
│   └── job-progress.tsx
└── providers/             ← React-провайдеры (Session, QueryClient, Toast)
    └── app-providers.tsx

6.1 Хуки
hooks/
├── use-balance.ts         ← GET /api/billing/balance, polling 30s
├── use-tools.ts           ← GET /api/tools, кешируется
├── use-job-status.ts      ← GET /api/jobs/:id/status, polling 2s
└── use-tool-execution.ts  ← POST /api/tools/:id/execute, SSE или jobId

Хук	Возвращает	Примечание
useBalance()	{ balance, reserved, isLoading }	Polling каждые 30 сек
useTools()	{ tools, isLoading }	Кеш 5 мин, используется в Sidebar
useJobStatus(jobId)	{ status, steps, result, error }	Polling каждые 2 сек пока status=pending
useToolExecution()	{ execute, streamContent, isExecuting }	Определяет режим по executionMode плагина

Правила использования
•	Компонент не делает запросы напрямую — только через хуки
•	Компонент не знает о бизнес-логике — только рендерит props
•	AutoForm — единственный способ рендерить форму инструмента, никаких кастомных форм
•	Все иконки — SVG, размер 18px для nav, 16px для inline, 20px для кнопок
•	Анимации только через Tailwind transition — никаких сторонних animation-библиотек в MVP
•	Этот файл синхронизируется с: UI_TOKENS.md, UI_PAGES.md, FRONTEND_ONBOARDING.md
