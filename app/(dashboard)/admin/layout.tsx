import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminTabs } from '@/components/app/admin-tabs';
import { HealthStatus } from '@/components/app/health-status';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') redirect('/tools');

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pt-6 pb-10">
      <h1 className="mb-1 text-2xl font-bold text-[var(--color-text-primary)]">Админ-панель</h1>
      <AdminTabs />
      <div className="mt-4 mb-6">
        <HealthStatus />
      </div>
      {children}
    </div>
  );
}
