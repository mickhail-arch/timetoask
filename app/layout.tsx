// app/layout.tsx — Root layout
import './globals.css';

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
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
