UI_PAGES.md
Анатомия страниц — блоки внутри ContentArea
Продукт: Таймтуаск  ·  app.site.ru  ·  Версия: 1.0 MVP

Назначение документа
Описывает что рендерится внутри ContentArea для каждой страницы кабинета. Cursor читает этот файл при работе над конкретной страницей.

•	Оболочка (Sidebar + Header) описана в UI_COMPONENTS.md — здесь не повторяется
•	Каждая страница = набор зон + состояния + компоненты из UI_COMPONENTS.md
•	Добавить новую страницу = создать файл по шаблону из раздела 9

1. Шаблон страницы / Page Template
Каждая страница строится по единой структуре:

app/(dashboard)/[page-name]/page.tsx

Зона	Описание
PageHeader	Заголовок страницы h1 + опциональный subtitle. Всегда первый блок
PageContent	Основное содержимое. Один или несколько блоков
PageActions	Кнопки действий если нужны (опционально, не на всех страницах)

Каркас файла страницы:
export default function PageName() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Название" subtitle="Описание" />
      <SomeBlock />
      <AnotherBlock />
    </div>
  )
}

→ gap-6 = --space-6 = 24px между блоками — стандартный отступ внутри ContentArea
→ Каждый блок — отдельный компонент, изолирован, получает данные через свой хук

2. Dashboard — каталог инструментов
Маршрут: /dashboard
Файл: app/(dashboard)/dashboard/page.tsx
Первая страница после входа. Показывает все доступные инструменты в виде карточек.

2.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: «Инструменты». Subtitle: краткое описание сервиса
ToolsGrid	<ToolsGrid />	Сетка карточек инструментов. Данные из useTools()

2.2 Карточка инструмента / ToolCard
Элемент	Описание
Иконка	SVG-иконка инструмента, 32px, цвет --color-accent
Название	tool.name, size=lg, bold
Описание	tool.description, size=sm, цвет secondary, max 2 строки
Стоимость	Badge: «N тк» или «Бесплатно (осталось N)»
Статус	Badge: active | beta | soon. «soon» — карточка неактивна
→ Клик по карточке → /tools/:id. Карточки со status=soon некликабельны, opacity 0.5
→ Сетка: 3 колонки на lg+, 2 на md, 1 на sm

2.3 Состояния Dashboard
Состояние	Что показывается
loading	Skeleton: 6 карточек-заглушек в сетке
empty	Текст «Инструменты появятся совсем скоро» + иллюстрация (V2)
error	Toast error + кнопка «Повторить»
filled	Сетка карточек

3. Страница инструмента / Tool Page
Маршрут: /tools/:id
Файл: app/(dashboard)/tools/[id]/page.tsx
Рабочее пространство инструмента. Форма ввода + результат выполнения.

3.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: название инструмента. Subtitle: описание. Badge: стоимость
ToolWorkspace	<ToolWorkspace />	Главная зона: форма + результат. Компонует AutoForm и Result-блок

3.2 Layout ToolWorkspace
Вариант	Когда	Описание
Только форма	До первого запуска	AutoForm на всю ширину
Форма + результат	Sync режим (SSE)	Форма слева 40%, StreamResult справа 60%
Форма + прогресс	Async режим (polling)	Форма слева 40%, JobProgress справа 60%
Форма + готовый результат	После завершения async	Форма слева 40%, JobResult справа 60%
→ На md и меньше — форма сверху, результат снизу (колонка вместо строки)

3.3 Состояния Tool Page
Состояние	Что показывается
loading	Skeleton формы — несколько Input-заглушек + кнопка-заглушка
ready	AutoForm заполнена токенами из плагина. Кнопка «Запустить»
executing_sync	Форма заблокирована. StreamResult показывает стриминг текста
executing_async	Форма заблокирована. JobProgress показывает шаги пайплайна
done	Результат показан. Форма разблокирована. Кнопки «Копировать», «Новый запрос»
error	Toast error. Форма разблокирована. Результат-блок скрыт
no_balance	AutoForm заблокирована. Кнопка «Пополнить баланс» вместо «Запустить»

3.4 Кнопка «Новый запрос»
После получения результата — появляется кнопка «Новый запрос».
•	Сбрасывает результат-блок
•	Форму НЕ сбрасывает — пользователь может изменить только нужные поля
•	Исключение: явная кнопка «Очистить форму» сбрасывает всё

4. Баланс и пополнение / Billing Page
Маршрут: /billing
Файл: app/(dashboard)/billing/page.tsx
Управление токенами: текущий баланс, пополнение, история транзакций.

4.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: «Баланс и пополнение»
BalanceOverview	<BalanceOverview />	Текущий баланс + зарезервировано. Большие цифры
TopupBlock	<TopupBlock />	Варианты пополнения + кнопка «Пополнить»
TransactionHistory	<TransactionHistory />	Таблица последних транзакций

4.2 BalanceOverview
Элемент	Описание
Доступно	Большое число + «тк». Если 0 — цвет error
Зарезервировано	Меньшее число серым. Показывает balance.reserved
Итого начислено	Сумма всех TOPUP за всё время (из транзакций)

4.3 TopupBlock
Элемент	Описание
Пресеты	Карточки с вариантами: 500 тк, 1000 тк, 2000 тк, 5000 тк. Выбор одного
Произвольно	Input для ввода суммы вручную (V2)
Кнопка	Button accent fullWidth: «Пополнить на N тк». POST /api/billing/checkout
→ После клика «Пополнить» → редирект на страницу ЮKassa → возврат на /billing

4.4 TransactionHistory
Колонка	Описание
Дата	DD.MM.YYYY HH:mm
Тип	Badge: TOPUP (зелёный) | DEBIT (серый) | BONUS (акцент) | REFUND (синий)
Описание	Название инструмента для DEBIT, «Пополнение» для TOPUP
Сумма	+ N тк зелёным или − N тк серым
→ Пагинация: 20 записей на страницу. Первая страница — по умолчанию

4.5 Состояния Billing Page
Состояние	Что показывается
loading	Skeleton для BalanceOverview и таблицы
empty	BalanceOverview с нулями. TransactionHistory: «Транзакций пока нет»
filled	Всё показано
no_balance	BalanceOverview красный. TopupBlock с акцентом на пополнение

5. История использования / Usage Logs Page
Маршрут: /logs
Файл: app/(dashboard)/logs/page.tsx
Лог всех запусков инструментов пользователя.

5.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: «История использования»
LogsFilter	<LogsFilter />	Фильтр по инструменту и дате (V2). MVP — только таблица
LogsTable	<LogsTable />	Таблица из usage_log

5.2 LogsTable
Колонка	Источник	Описание
Дата	usage_log.created_at	DD.MM.YYYY HH:mm
Инструмент	usage_log + tools.name	Название инструмента
Токены	usage_log.tokens_used	Потрачено токенов
Стоимость	usage_log.cost_usd	Себестоимость в $ (только для admin)
Время	usage_log.latency_ms	Время выполнения в сек
Статус	usage_log статус	Badge: success | error
→ Колонка «Стоимость $» видна только admin. Для обычного пользователя скрыта
→ Пагинация: 20 записей на страницу

5.3 Состояния
Состояние	Что показывается
loading	Skeleton таблицы — 5 строк-заглушек
empty	Иконка + «Вы ещё не запускали инструменты»
filled	Таблица с данными

6. Профиль / Profile Page
Маршрут: /profile
Файл: app/(dashboard)/profile/page.tsx
Данные аккаунта пользователя и управление паролем.

6.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: «Профиль»
AccountInfo	<AccountInfo />	Email, ID аккаунта, дата регистрации
ChangePassword	<ChangePassword />	Форма смены пароля: старый → новый → подтверждение

6.2 AccountInfo
Поле	Значение	Редактируемое
Email	session.user.email	Нет (MVP)
ID аккаунта	user.id (RA001 формат)	Нет
Дата регистрации	user.created_at	Нет
Токенов получено	Сумма BONUS + TOPUP	Нет

6.3 ChangePassword
Поле	Валидация
Текущий пароль	Обязательное
Новый пароль	Мин 8 символов, буквы + цифры
Повторить пароль	Совпадает с новым
→ POST /api/me/password. При успехе — Toast success. При ошибке старого пароля — error на поле

6.4 Состояния
Состояние	Что показывается
loading	Skeleton для AccountInfo
filled	Данные показаны. Форма пустая
saving	Кнопка «Сохранить» в состоянии loading
success	Toast: «Пароль изменён»
error	Ошибка под соответствующим полем

7. Админка / Admin Page
Маршрут: /admin
Файл: app/(dashboard)/admin/page.tsx
Управление пользователями, инструментами и логами. Только для role=admin.

→ Защита: middleware проверяет session.user.role === admin. Иначе → 403 или редирект на /dashboard

7.1 Зоны страницы
Зона	Компонент	Описание
PageHeader	<PageHeader />	H1: «Админка»
AdminTabs	<AdminTabs />	Табы: Дашборд | Пользователи | Инструменты | Логи
TabContent	по активному табу	Содержимое активного таба

7.2 Таб: Дашборд
Метрика	Источник	Описание
Пользователей всего	GET /api/admin/dashboard	Число
Запусков сегодня	GET /api/admin/dashboard	Число
Выручка сегодня	GET /api/admin/dashboard	Сумма TOPUP за сегодня
Активных jobs	GET /api/admin/dashboard	Текущие async задачи

7.3 Таб: Пользователи
Колонка	Действия
ID, Email, Дата регистрации	Только просмотр
Баланс	Только просмотр
Роль	PATCH /api/admin/users/:id — изменить роль
Статус	PATCH /api/admin/users/:id — заблокировать/разблокировать (V2)

7.4 Таб: Инструменты
Поле	Редактируемое	Описание
Название, описание	Нет	Только из manifest.json
Модель (model)	Да	PATCH /api/admin/tools/:id — меняется в БД без деплоя
Промпт (prompt)	Да	PATCH /api/admin/tools/:id — меняется в БД без деплоя
Стоимость (token_cost)	Да	PATCH /api/admin/tools/:id
Статус	Да	active | beta | disabled
→ Это главная фича админки — промпт и модель меняются мгновенно, без деплоя (Registry pattern)

7.5 Таб: Логи
Аналогично Usage Logs Page, но по всем пользователям. Дополнительная колонка: Email пользователя.

7.6 Состояния
Состояние	Что показывается
loading	Skeleton для активного таба
403	Если не admin: «Доступ запрещён» + кнопка на /dashboard
filled	Данные показаны

8. Страницы входа и регистрации / Auth Pages
Не используют оболочку кабинета (нет Sidebar и Header). Отдельный layout: app/(auth)/layout.tsx.
→ Auth layout: белый фон, логотип в верхнем левом углу, форма по центру экрана

8.1 Вход / Login
Маршрут: /login
Файл: app/(auth)/login/page.tsx

Зона	Компонент	Описание
Логотип	Статика	Верхний левый угол. Иконка + «Таймтуаск»
AuthCard	<AuthCard />	По центру: заголовок + форма + ссылка

Элемент	Описание
Заголовок	«Войти в Таймтуаск», size=3xl, bold, по центру
Input Email	type=email, label=«Email», floating label
Input Пароль	type=password, label=«Пароль», floating label
Ошибка	Текст «Неверный email или пароль» под полем пароля, цвет error
Button «Войти»	variant=accent, fullWidth. POST /api/auth/login
Ссылка	У вас ещё нет аккаунта? Регистрация → /register

8.2 Регистрация — шаг 1: Email
Маршрут: /register
Файл: app/(auth)/register/page.tsx

Элемент	Описание
Заголовок	«Регистрация в Таймтуаск», size=3xl, bold
Input Email	type=email, label=«Email»
Button «Регистрация»	variant=accent, fullWidth. POST /api/auth/register → отправляет код
Ссылка	Уже есть аккаунт? Войти → /login

8.3 Регистрация — шаг 2: Подтверждение email
Маршрут: /register/verify
Файл: app/(auth)/register/verify/page.tsx

Элемент	Описание
Заголовок	«Подтвердите email»
Подзаголовок	«Мы отправили код подтверждения на {email}»
Input «Код из письма»	Числовой код, валидация на 4–6 символов
Ошибка	«Неверный код» под полем, цвет error
Button «Подтвердить»	variant=accent, fullWidth. POST /api/auth/verify-email
Ссылка	Нет письма? Отправить повторно → повторный запрос

8.4 Регистрация — шаг 3: Пароль
Маршрут: /register/password
Файл: app/(auth)/register/password/page.tsx

Элемент	Описание
Заголовок	«Придумайте пароль»
Input «Пароль»	type=password. Ошибка: «Пароль слишком простой. Используйте не менее 8 символов, включая буквы и цифры»
Input «Повторить пароль»	type=password. Ошибка: «Пароли не совпадают. Проверьте введённые данные»
Button «Завершить регистрацию»	variant=accent, fullWidth. POST /api/auth/reset-password/confirm

8.5 Сброс пароля
Маршрут: /reset-password
Файл: app/(auth)/reset-password/page.tsx
Те же паттерны что у регистрации. Email → код → новый пароль.

9. Как добавить новую страницу
Алгоритм добавления страницы в кабинет — 4 шага, ничего лишнего менять не нужно:

1.	Создать файл: app/(dashboard)/[page-name]/page.tsx
→ Использовать каркас из раздела 1 этого документа
2.	Добавить пункт в nav-конфиг: config/nav.ts
→ { label: "Название", href: "/page-name", icon: IconName } — Sidebar подхватит автоматически
3.	Описать зоны и состояния страницы в этом файле (UI_PAGES.md)
→ Чтобы Cursor понимал что рендерить при следующих задачах
4.	Всё остальное — Sidebar, Header, Layout, Auth-защита — работает автоматически
→ Middleware защищает все маршруты внутри (dashboard) без дополнительной настройки

Что НЕ нужно трогать при добавлении страницы:
•	app/(dashboard)/layout.tsx — оболочка не меняется
•	middleware.ts — защита работает по группе маршрутов
•	components/app/sidebar.tsx — nav берётся из конфига автоматически
•	Любые другие существующие страницы

Правила использования
•	Каждый блок страницы — изолированный компонент со своим хуком
•	Страница не делает fetch напрямую — только через хуки
•	Все состояния (loading, empty, error, filled) обязательны для каждого блока с данными
•	Skeleton при загрузке — всегда, никаких spinner-ов на всю страницу
•	Этот файл синхронизируется с: UI_COMPONENTS.md, UX_SCENARIOS.md, FRONTEND_ONBOARDING.md
