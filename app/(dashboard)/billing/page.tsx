export default function BillingPage() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-[480px] text-center">
        <h1 className="mb-4 text-2xl font-bold leading-tight text-[var(--color-text-primary)]">
          Сервис находится в beta-тестировании, модуль оплаты ещё не подключён
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
          Для пополнения баланса обратитесь к администратору
        </p>
        <a
          href="https://t.me/holyfederation"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-6 text-sm font-medium text-black transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#29B6F6" />
            <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.833.933l-1.97 9.281c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.327 13.7l-2.963-.924c-.643-.204-.657-.643.136-.953z" fill="white" />
          </svg>
          Написать
        </a>
      </div>
    </div>
  );
}
