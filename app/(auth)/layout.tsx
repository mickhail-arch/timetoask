import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { authOptions } from '@/lib/auth';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect('/tools');

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-page">
      <div className="absolute left-6 top-6 flex items-center">
        <Image
          src="/logo.svg"
          alt="Таймтуаск"
          width={158}
          height={30}
          className="block h-7 w-auto dark:hidden"
          priority
        />
        <Image
          src="/logo-white.svg"
          alt="Таймтуаск"
          width={158}
          height={30}
          className="hidden h-7 w-auto dark:block"
          priority
        />
      </div>
      {children}
    </div>
  );
}
