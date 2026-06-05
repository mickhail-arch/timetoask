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
    <div className="flex h-screen bg-[var(--color-bg-page)]">
      <Sidebar />
      <div className="flex flex-1 flex-col bg-[var(--color-bg-page)]">
        <ImpersonationBanner />
        <Header />
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-page)]">
          <div className="min-h-full p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
