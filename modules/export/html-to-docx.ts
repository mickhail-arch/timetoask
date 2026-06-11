// modules/export/html-to-docx.ts — переиспользуемый конвертер HTML → .docx (Buffer)
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, ExternalHyperlink, BorderStyle } from 'docx';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export interface HtmlToDocxOptions {
  html: string;
  title?: string;
  maxImageWidth?: number;
}

function readPngDims(b: Buffer): { w: number; h: number } | null {
  if (b.length < 24 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

async function loadImage(src: string): Promise<{ data: Buffer; type: 'png' | 'jpg'; w: number; h: number } | null> {
  let buf: Buffer | null = null;
  let type: 'png' | 'jpg' = 'png';
  if (src.startsWith('data:image')) {
    const m = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    type = m[1].toLowerCase().startsWith('jp') ? 'jpg' : 'png';
    buf = Buffer.from(m[2], 'base64');
  } else if (src.startsWith('/uploads/')) {
    const uploadsRoot = resolve(process.cwd(), 'public', 'uploads');
    const candidate = resolve(process.cwd(), 'public', `.${src}`);
    if (candidate !== uploadsRoot && !candidate.startsWith(uploadsRoot + sep)) return null;
    try { buf = await readFile(candidate); } catch { return null; }
    type = /\.jpe?g$/i.test(src) ? 'jpg' : 'png';
  } else {
    return null; // внешние URL не вшиваем
  }
  const dims = type === 'png' ? readPngDims(buf) : null;
  return { data: buf, type, w: dims?.w ?? 1600, h: dims?.h ?? 900 };
}

async function imageParagraphs(src: string, alt: string, maxW: number): Promise<Paragraph[]> {
  const img = await loadImage(src);
  if (!img) {
    return [new Paragraph({ children: [new TextRun({ text: `[Изображение: ${alt}]`, italics: true, color: '666666' })], spacing: { before: 200, after: 200 } })];
  }
  const width = Math.min(maxW, img.w);
  const height = Math.round(width * (img.h / img.w));
  const out: Paragraph[] = [
    new Paragraph({
      children: [new ImageRun({ data: img.data, transformation: { width, height }, type: img.type })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
    }),
  ];
  return out;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function parseInline(html: string, size = 24): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  const cleaned = html.replace(/<br\s*\/?>/gi, '\n');
  const parts = cleaned.split(/(<(?:strong|b|em|i|a|cite)[^>]*>[\s\S]*?<\/(?:strong|b|em|i|a|cite)>)/gi);
  for (const part of parts) {
    let m = part.match(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/i);
    if (m) { runs.push(new TextRun({ text: stripTags(m[1]), bold: true, size })); continue; }
    m = part.match(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/i);
    if (m) { runs.push(new TextRun({ text: stripTags(m[1]), italics: true, size })); continue; }
    m = part.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (m) { runs.push(new ExternalHyperlink({ link: m[1], children: [new TextRun({ text: stripTags(m[2]), color: '2563EB', underline: {}, size })] })); continue; }
    m = part.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
    if (m) { runs.push(new TextRun({ text: stripTags(m[1]), italics: true, size: 20, color: '666666' })); continue; }
    const text = stripTags(part);
    if (text.trim()) {
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        if (idx === 0) {
          if (line) runs.push(new TextRun({ text: line, size }));
        } else {
          runs.push(new TextRun({ text: line, size, break: 1 }));
        }
      });
    }
  }
  return runs;
}

export async function generateDocxBuffer(options: HtmlToDocxOptions): Promise<Buffer> {
  const maxW = options.maxImageWidth ?? 600;
  const children: Paragraph[] = [];

  const blocks = options.html
    .replace(/<article[^>]*>/gi, '').replace(/<\/article>/gi, '')
    .split(/(?=<h[123][^>]*>|<p[^>]*>|<blockquote[^>]*>|<ul[^>]*>|<ol[^>]*>|<figure[^>]*>|<img[^>]*>)/gi)
    .filter((b) => b.trim());

  for (const block of blocks) {
    const t = block.trim();

    let m = t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (m) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInline(m[1], 40), spacing: { after: 200 } })); continue; }
    m = t.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (m) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseInline(m[1], 30), spacing: { before: 300, after: 150 } })); continue; }
    m = t.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (m) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: parseInline(m[1], 26), spacing: { before: 200, after: 100 } })); continue; }

    m = t.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (m) {
      let inner = m[1].replace(/<\/?p[^>]*>/gi, '').trim();
      // после жирной метки в начале (например "Важно") — перенос строки
      inner = inner.replace(/^(\s*[!❗]?\s*<strong[^>]*>[\s\S]*?<\/strong>)/i, '$1<br>');
      children.push(new Paragraph({ children: parseInline(inner), indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'A6E800' } }, spacing: { before: 200, after: 200 } }));
      continue;
    }

    // figure ИЛИ голый img — порядок атрибутов любой
    if (/<img[\s>]/i.test(t)) {
      const src = (t.match(/<img[^>]*src="([^"]*)"/i) || [])[1] ?? '';
      const alt = (t.match(/<img[^>]*alt="([^"]*)"/i) || [])[1] ?? '';
      if (src) { children.push(...(await imageParagraphs(src, alt, maxW))); continue; }
    }

    m = t.match(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/i);
    if (m) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li;
      while ((li = liRegex.exec(m[1])) !== null) {
        children.push(new Paragraph({ children: parseInline(li[1]), bullet: { level: 0 }, spacing: { after: 50 } }));
      }
      continue;
    }

    m = t.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (m) {
      const inner = m[1].trim();
      if (!inner) continue;
      children.push(new Paragraph({ children: parseInline(inner), spacing: { after: 150 } }));
      continue;
    }
  }

  const doc = new Document({
    styles: {
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 40, bold: true, color: '1A1A1A' }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 30, bold: true, color: '1A1A1A' }, paragraph: { spacing: { before: 240, after: 120 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, color: '1A1A1A' }, paragraph: { spacing: { before: 200, after: 100 } } },
      ],
    },
    sections: [{ properties: {}, children }],
  });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
