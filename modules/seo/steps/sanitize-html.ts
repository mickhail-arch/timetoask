const FORBIDDEN_TAGS = ['h4', 'h5', 'h6', 'div', 'span', 'section', 'article', 'header', 'footer', 'main'];

const PRESERVED_CLASS_PREFIXES = ['callout', 'tldr', 'toc', 'article-meta', 'author', 'date', 'reading-time'];

/**
 * Закрывает незакрытые <a> теги.
 * Сканирует HTML, если встретил <a> без </a> до следующего блочного тега (h1-h6, p, ul, ol, blockquote, figure, table) или до конца строки — вставляет </a> перед этим блочным тегом.
 */
function closeUnclosedAnchors(html: string): string {
  const BLOCK_TAGS_RE = /<(h[1-6]|p|ul|ol|blockquote|figure|table|nav|hr)\b/i;
  let result = '';
  let i = 0;
  let openA = 0;

  while (i < html.length) {
    const remaining = html.slice(i);

    // Проверяем открывающий <a>
    const openMatch = remaining.match(/^<a\b[^>]*>/i);
    if (openMatch) {
      openA++;
      result += openMatch[0];
      i += openMatch[0].length;
      continue;
    }

    // Проверяем закрывающий </a>
    if (remaining.match(/^<\/a>/i)) {
      if (openA > 0) openA--;
      result += '</a>';
      i += 4;
      continue;
    }

    // Если есть открытый <a> и встретили блочный тег — закрываем <a> ДО блочного тега
    if (openA > 0) {
      const blockMatch = remaining.match(BLOCK_TAGS_RE);
      if (blockMatch && blockMatch.index === 0) {
        result += '</a>';
        openA--;
        continue; // не инкрементируем i — обработаем блочный тег на следующей итерации
      }
    }

    result += html[i];
    i++;
  }

  // Если в конце остались открытые <a> — закрываем все
  while (openA > 0) {
    result += '</a>';
    openA--;
  }

  return result;
}

/**
 * Удаляет упоминания TL;DR во всех вариантах.
 * Работает на финальном HTML, без привязки к конкретным тегам.
 */
function removeTldrMentions(html: string): string {
  let result = html;

  // 1. Внутри strong: "Кратко (TL;DR)" → "Кратко"
  result = result.replace(/(<strong[^>]*>)([^<]*?)\s*\(?\s*TL\s*;?\s*DR\s*\)?\s*:?\s*([^<]*)(<\/strong>)/gi, (_m, open, before, after, close) => {
    const cleaned = (before + after).trim();
    return `${open}${cleaned || 'Кратко'}${close}`;
  });

  // 2. Внутри h2/h3: "Кратко (TL;DR)" → "Кратко"
  result = result.replace(/(<h[23][^>]*>)([^<]*?)\s*\(?\s*TL\s*;?\s*DR\s*\)?\s*:?\s*([^<]*)(<\/h[23]>)/gi, (_m, open, before, after, close) => {
    const cleaned = (before + after).trim();
    return `${open}${cleaned || 'Кратко'}${close}`;
  });

  // 3. Голый текст вне тегов: "(TL;DR)", " TL;DR ", "TLDR:" — удаляем
  result = result.replace(/\s*\(\s*TL\s*;?\s*DR\s*\)\s*/gi, ' ');
  result = result.replace(/\bTL\s*;?\s*DR\s*:?\s*/gi, '');
  result = result.replace(/\bTLDR\s*:?\s*/gi, '');

  // 4. Подчистка двойных пробелов после удаления
  result = result.replace(/\s{2,}/g, ' ');

  return result;
}

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

  let closeCount = 0;
  result = result.replace(/<\/nav>/gi, () => {
    const idx = closeCount;
    if (idx < navPlaceholders.length) {
      closeCount++;
      return '__NAV_TOC_CLOSE__';
    }
    return '';
  });

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

  // Закрываем сиротские <a> теги — лечит ссылки, расползшиеся на весь текст
  result = closeUnclosedAnchors(result);

  // Удаляем все упоминания TL;DR
  result = removeTldrMentions(result);

  return result;
}
