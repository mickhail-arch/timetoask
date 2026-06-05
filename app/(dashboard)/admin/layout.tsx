import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminTabs } from '@/components/app/admin-tabs';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') redirect('/tools');

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="mb-1 text-2xl font-bold text-[var(--color-text-primary)]">Админ-панель</h1>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Управление сервисом</p>
      <AdminTabs />
      {children}
    </div>
  );
}
