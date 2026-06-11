import { ReferralClient } from '@/components/app/referral-client';

export default function ReferralPage() {
  return (
    <div className="mx-auto max-w-[700px] px-6 pt-6 pb-10">
      <h1 className="mb-1 text-2xl font-bold text-[var(--color-text-primary)]">Партнёрская программа</h1>
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Приглашайте пользователей по ссылке и получайте 10% от их платных генераций первые 90 дней — токенами на баланс.
      </p>
      <ReferralClient />
    </div>
  );
}
