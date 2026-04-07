//lib/seo-article/export.ts

/**
 * Скопировать статью в буфер обмена (HTML + plain text).
 */
export async function copyArticle(html: string): Promise<void> {
  const cleanHtml = html;
  const plainText = cleanHtml.replace(/<[^>]*>/g, '');

  try {
    const htmlBlob = new Blob([cleanHtml], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(plainText);
  }
}

/**
 * Скачать HTML-файл.
 */
export function downloadHTML(html: string, slug: string): void {
  const cleanHtml = html;
  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${slug}</title>
</head>
<body>
${cleanHtml}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${slug}.html`);
}

/**
 * Скачать .docx из base64.
 */
export function downloadDOCX(base64: string, filename: string): void {
  if (!base64) {
    console.warn('[export] No docx data available');
    return;
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  downloadBlob(blob, filename);
}

/**
 * Скачать метаданные .docx из base64.
 */
export function downloadMetadata(base64: string, filename: string): void {
  downloadDOCX(base64, filename);
}

/**
 * Универсальная функция скачивания Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
