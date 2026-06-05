'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (!session?.impersonatedBy) return null;

  const exit = async () => {
    setLeaving(true);
    try {
      await fetch('/api/admin/impersonate/stop', { method: 'POST' });
      await update({ action: 'stop-impersonate' });
      router.push('/admin/users');
      router.refresh();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-[#B45309] px-4 py-2 text-sm text-white">
      <span>
        Режим поддержки · вы в аккаунте <strong>{session.user.email}</strong>
        {session.impersonationLevel === 'view' && ' (только просмотр)'}
      </span>
      <button
        onClick={exit}
        disabled={leaving}
        className="rounded-md bg-white/20 px-3 py-1 font-medium transition-colors hover:bg-white/30 disabled:opacity-50"
      >
        {leaving ? 'Выход...' : 'Выйти'}
      </button>
    </div>
  );
}
