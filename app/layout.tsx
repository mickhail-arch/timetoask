// app/layout.tsx — Root layout
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
