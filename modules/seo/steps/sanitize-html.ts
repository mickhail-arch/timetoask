const FORBIDDEN_TAGS = ['h4', 'h5', 'h6', 'div', 'span', 'section', 'article', 'header', 'footer', 'main'];

const PRESERVED_CLASS_PREFIXES = ['callout', 'tldr', 'toc', 'article-meta', 'author', 'date', 'reading-time'];

export function sanitizeArticleHtml(html: string): string {
  let result = html;

  result = result.replace(/\s+style="[^"]*"/gi, '');

  for (const tag of FORBIDDEN_TAGS) {
    result = result.replace(new RegExp(`<${tag}\\b[^>]*>`, 'gi'), '');
    result = result.replace(new RegExp(`</${tag}>`, 'gi'), '');
  }

  // nav: protect <nav class="toc..."> with placeholders, strip the rest
  const navPlaceholders: string[] = [];
  result = result.replace(/<nav\b([^>]*class\s*=\s*"toc[^"]*"[^>]*)>/gi, (_m, attrs) => {
    navPlaceholders.push(attrs);
    return `__NAV_TOC_${navPlaceholders.length - 1}__`;
  });
  result = result.replace(/<nav\b[^>]*>/gi, '');

  // For closing </nav>: scan left-to-right, pair each with nearest unmatched toc-placeholder
  let closeCount = 0;
  result = result.replace(/<\/nav>/gi, () => {
    const idx = closeCount;
    if (idx < navPlaceholders.length) {
      closeCount++;
      return '__NAV_TOC_CLOSE__';
    }
    return '';
  });

  // Restore toc nav tags
  for (let i = 0; i < navPlaceholders.length; i++) {
    result = result.replace(`__NAV_TOC_${i}__`, `<nav${navPlaceholders[i]}>`);
  }
  result = result.replace(/__NAV_TOC_CLOSE__/g, '</nav>');

  // Strip class attributes except those starting with preserved prefixes
  const prefixPattern = PRESERVED_CLASS_PREFIXES.join('|');
  result = result.replace(/\s+class="([^"]*)"/gi, (match, value: string) => {
    if (new RegExp(`^(?:${prefixPattern})`).test(value)) return match;
    return '';
  });

  result = result.replace(/<(\w+)(\s[^>]*)?>(\s|&nbsp;)*<\/\1>/gi, '');

  result = result.replace(/\n{2,}/g, '\n');

  return result;
}
