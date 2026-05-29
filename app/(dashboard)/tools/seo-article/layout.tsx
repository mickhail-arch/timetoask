//app/(dashboard)/tools/seo-article-express/layout.tsx

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
