import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'TimeToAsk',
  description: 'AI-powered marketing tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body>
        <div id="mobile-stub">
          <span>Таймтуаск</span>
          <p>Сервис доступен только на десктопе</p>
          <p>Откройте сайт на компьютере</p>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
