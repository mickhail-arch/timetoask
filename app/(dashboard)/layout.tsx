//app/(dashboard)/layout.tsx

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Sidebar } from '@/components/app/sidebar';
import { Header } from '@/components/app/header';
import { ImpersonationBanner } from '@/components/app/impersonation-banner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-page)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-page)]">
        <ImpersonationBanner />
        <Header />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-bg-page)]">
          {children}
        </main>
      </div>
    </div>
  );
}
