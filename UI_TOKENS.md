UI_TOKENS.md
Визуальная ДНК — единственный источник правды по внешнему виду
Продукт: Таймтуаск  ·  app.site.ru  ·  Версия: 1.0 MVP

Назначение документа
Этот файл — единственное место где хранятся все визуальные значения продукта. Ни один компонент, страница или стиль не задаёт цвет, шрифт или отступ напрямую — только через токены из этого документа.
Cursor читает этот файл перед любой задачей связанной с фронтендом.

Правило:
•	Изменить цвет акцента → поменять одну переменную здесь → обновится весь продукт
•	Добавить новый компонент → использовать только токены из этого файла
•	Хардкод значений (#A6E800 прямо в компоненте) — запрещён

1. Цвета / Color Tokens
Тема: только светлая (light). Тёмная тема — вне скоупа MVP.

1.1 Основная палитра
Токен	HEX	Где используется
--color-accent	  #A6E800	Кнопка primary, кнопка «Пополнить», активный пункт меню
--color-bg-page	  #FFFFFF	Фон всего приложения, ContentArea
--color-bg-sidebar	  #F5F5F5	Фон сайдбара
--color-bg-surface	  #FFFFFF	Фон карточек, модалок, инпутов
--color-border	  #E0E0E0	Граница инпутов, разделители, граница между Sidebar и ContentArea
--color-text-primary	  #1A1A1A	Заголовки, основной текст, label в инпуте
--color-text-secondary	  #6B6B6B	Вспомогательный текст, placeholder, подписи
--color-text-link	  #007AFF	Ссылки: «Регистрация», «Войти», «Отправить повторно»
--color-error	  #FF3B30	Текст ошибки под полем, border инпута в состоянии error
--color-success	  #34C759	Успешное действие, подтверждение

1.2 Производные токены (не задавать вручную)
Токен	Значение	Описание
--color-accent-hover	color-mix(in srgb, #A6E800 85%, black)	Кнопка primary при hover
--color-accent-disabled	color-mix(in srgb, #A6E800 40%, white)	Кнопка primary disabled
--color-border-error	  #FF3B30	Border инпута при ошибке — alias для --color-error
--color-border-focus	  #1A1A1A	Border инпута при фокусе

1.3 Tailwind — конфиг
В tailwind.config.ts все токены регистрируются через CSS-переменные:
colors: { accent: 'var(--color-accent)', 'bg-page': 'var(--color-bg-page)', ... }
→ Нельзя использовать bg-[#A6E800] или text-[#1A1A1A] напрямую в классах — только через алиасы

2. Типографика / Typography
Шрифт: Inter (Google Fonts). Подключается через next/font/google.

2.1 Шкала размеров
Токен	px / rem	Tailwind-класс	Где используется
--text-xs	12px / 0.75rem	text-xs	Подписи, метки, ID аккаунта в хедере
--text-sm	14px / 0.875rem	text-sm	Вспомогательный текст, nav-пункты, placeholder
--text-base	16px / 1rem	text-base	Основной текст, значения инпутов, контент страниц
--text-lg	18px / 1.125rem	text-lg	Подзаголовки секций
--text-xl	20px / 1.25rem	text-xl	Заголовки блоков внутри страниц
--text-2xl	24px / 1.5rem	text-2xl	Заголовки страниц (H1 внутри ContentArea)
--text-3xl	30px / 1.875rem	text-3xl	Крупный акцентный заголовок (auth-экраны: «Войти в Таймтуаск»)

2.2 Веса
Токен	font-weight	Tailwind-класс	Где используется
--font-regular	400	font-normal	Основной текст, значения полей
--font-medium	500	font-medium	Nav-пункты, лейблы инпутов, badge
--font-bold	700	font-bold	Заголовки страниц, текст кнопки primary, баланс токенов в хедере

2.3 Line-height
Контекст	line-height	Tailwind-класс
Заголовки	1.2	leading-tight
Основной текст	1.5	leading-normal
Мелкий текст	1.4	leading-snug

3. Отступы и сетка / Spacing & Grid
Базовая единица: 4px. Все отступы кратны 4px.

3.1 Шкала отступов
Токен	px	Tailwind	Где используется
--space-1	4px	p-1 / gap-1	Минимальный зазор внутри badge, между иконкой и текстом
--space-2	8px	p-2 / gap-2	Padding внутри nav-пункта по вертикали
--space-3	12px	p-3 / gap-3	Отступ между пунктами меню
--space-4	16px	p-4 / gap-4	Padding карточки, padding хедера по вертикали
--space-5	20px	p-5 / gap-5	Padding сайдбара по горизонтали
--space-6	24px	p-6 / gap-6	Padding ContentArea, отступ между блоками внутри страницы
--space-8	32px	p-8 / gap-8	Крупные секционные отступы

3.2 Размеры зон layout
Зона	Размер	Описание
Sidebar — ширина	220px	Фиксированная. MVP: статичная. V2: сворачивается до 56px (иконки)
Header — высота	52px	Фиксированная. Один ряд элементов
ContentArea	flex: 1	Занимает оставшееся пространство. Overflow-y: auto
ContentArea padding	24px (--space-6)	Внутренний отступ со всех сторон

3.3 Breakpoints
Breakpoint	px	Поведение
sm	640px	Не используется в MVP (продукт desktop-first)
md	768px	Sidebar скрывается, появляется бургер-кнопка
lg	1024px	Базовый desktop-layout: Sidebar + Header + ContentArea
xl	1280px	ContentArea расширяется, max-width контента: 960px
2xl	1536px	Без изменений от xl

4. Радиусы и тени / Radius & Shadows
4.1 Радиусы скруглений
Токен	px	Tailwind	Где используется
--radius-sm	6px	rounded	Badge, tag, мелкие метки
--radius-md	10px	rounded-lg	Инпуты, кнопки, пункты меню при hover
--radius-lg	12px	rounded-xl	Карточки инструментов, модалки, блоки на странице
--radius-full	9999px	rounded-full	Аватар пользователя
→ Из макета: инпуты и кнопки имеют радиус ~10px, карточки ~12px

4.2 Тени
Токен	Значение	Где используется
--shadow-none	none	По умолчанию для всех элементов
--shadow-sm	0 1px 3px rgba(0,0,0,0.08)	Карточки инструментов при hover
--shadow-md	0 4px 12px rgba(0,0,0,0.10)	Дропдаун меню пользователя, модалки
→ Тени минимальны — продукт плоский. Глубина достигается цветом фона, а не тенями

5. Z-index
Токен	Значение	Что
--z-base	0	Обычный контент страницы
--z-sidebar	10	Sidebar (над контентом на мобайле)
--z-header	20	Header (всегда поверх контента)
--z-dropdown	30	Дропдаун меню пользователя
--z-modal	50	Модальное окно
--z-toast	60	Toast-уведомления (поверх всего)

6. Состояния компонентов / Component States
Каждый интерактивный компонент имеет 5 состояний. Токены для каждого:

6.1 Кнопка primary (акцентная)
Состояние	Background	Text	Border	Cursor
default	--color-accent (#A6E800)	--color-text-primary	none	pointer
hover	--color-accent-hover (чуть темнее)	--color-text-primary	none	pointer
focus	--color-accent	--color-text-primary	2px solid --color-border-focus	pointer
loading	--color-accent-disabled	--color-text-primary	none	not-allowed
disabled	--color-accent-disabled	--color-text-secondary	none	not-allowed

6.2 Инпут (текстовое поле)
Состояние	Border	Label color	Background
default	--color-border (#E0E0E0)	--color-text-secondary	--color-bg-surface
focus	--color-border-focus (#1A1A1A) 1.5px	--color-text-primary	--color-bg-surface
filled	--color-border (#E0E0E0)	--color-text-secondary	--color-bg-surface
error	--color-error (#FF3B30) 1.5px	--color-error	--color-bg-surface
disabled	--color-border (#E0E0E0)	--color-text-secondary	--color-bg-sidebar
→ Label — floating: маленький сверху при filled/focus, обычный размер при empty

6.3 Nav-пункт сайдбара
Состояние	Background	Text	Icon
default	transparent	--color-text-secondary	--color-text-secondary
hover	--color-border (#E0E0E0)	--color-text-primary	--color-text-primary
active	--color-accent (#A6E800)	--color-text-primary	--color-text-primary

7. Итоговый globals.css
Все токены объявляются один раз в :root. Это единственное место правды.

:root {
/* Цвета */
--color-accent: #A6E800;
--color-accent-hover: color-mix(in srgb, #A6E800 85%, black);
--color-accent-disabled: color-mix(in srgb, #A6E800 40%, white);
--color-bg-page: #FFFFFF;
--color-bg-sidebar: #F5F5F5;
--color-bg-surface: #FFFFFF;
--color-border: #E0E0E0;
--color-border-focus: #1A1A1A;
--color-border-error: #FF3B30;
--color-text-primary: #1A1A1A;
--color-text-secondary: #6B6B6B;
--color-text-link: #007AFF;
--color-error: #FF3B30;
--color-success: #34C759;
/* Типографика */
--font-regular: 400;
--font-medium: 500;
--font-bold: 700;
/* Радиусы */
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 12px;
--radius-full: 9999px;
/* Тени */
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 4px 12px rgba(0,0,0,0.10);
/* Z-index */
--z-base: 0;
--z-sidebar: 10;
--z-header: 20;
--z-dropdown: 30;
--z-modal: 50;
--z-toast: 60;
}

Правила использования
•	Все цвета, размеры и отступы — только через CSS-переменные или Tailwind-алиасы
•	Хардкод hex/px значений в компонентах — запрещён
•	Новый токен добавляется сначала сюда, затем в tailwind.config.ts, затем используется
•	Тёмная тема — вне скоупа MVP. Не закладывать переключатель темы
•	Этот файл синхронизируется с: UI_COMPONENTS.md, UI_PAGES.md, tailwind.config.ts, globals.css
