import Link from 'next/link';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobilePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-white">
      <div className="absolute left-6 top-6 flex items-center gap-2">
        <Zap size={28} className="text-accent" />
        <span className="text-lg font-bold text-text-primary">Таймтуаск</span>
      </div>
      <div className="flex flex-col items-center text-center px-6">
        <h1 className="text-xl font-bold text-text-primary">
          Сервис доступен только на десктопе
        </h1>
        <p className="text-sm text-text-secondary mt-2">
          Откройте Таймтуаск на компьютере для работы с инструментами
        </p>
        <Button asChild variant="accent" className="mt-6">
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
