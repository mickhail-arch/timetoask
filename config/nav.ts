export const NAV_ITEMS = [
  { label: 'Баланс и пополнение', href: '/billing', icon: 'Wallet' },
] as const;
// Инструменты добавляются динамически из GET /api/tools
// Этот файл — только статичные пункты меню