import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Zap } from 'lucide-react';
import { authOptions } from '@/lib/auth';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-page">
      <div className="absolute left-6 top-6 flex items-center gap-2">
        <Zap size={28} className="text-accent" />
        <span className="text-lg font-bold text-text-primary">Таймтуаск</span>
      </div>
      {children}
    </div>
  );
}
