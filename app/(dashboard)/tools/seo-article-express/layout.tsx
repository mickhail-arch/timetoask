export default function SeoArticleExpressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full -m-6">
      {children}
    </div>
  );
}
