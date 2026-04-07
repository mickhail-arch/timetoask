import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, ExternalHyperlink, BorderStyle } from 'docx';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface DocxOptions {
  html: string;
  title: string;
}

export async function generateDocxFromHtml(options: DocxOptions): Promise<string> {
  const { html, title } = options;
  const children: Paragraph[] = [];

  const blocks = html
    .replace(/<article[^>]*>/gi, '')
    .replace(/<\/article>/gi, '')
    .split(/(?=<h[123][^>]*>|<p[^>]*>|<blockquote[^>]*>|<ul[^>]*>|<ol[^>]*>|<figure[^>]*>)/gi)
    .filter(b => b.trim());

  for (const block of blocks) {
    const trimmed = block.trim();

    // H1
    const h1Match = trimmed.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInlineElements(h1Match[1]),
        spacing: { after: 200 },
      }));
      continue;
    }

    // H2
    const h2Match = trimmed.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInlineElements(h2Match[1]),
        spacing: { before: 300, after: 150 },
      }));
      continue;
    }

    // H3
    const h3Match = trimmed.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (h3Match) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInlineElements(h3Match[1]),
        spacing: { before: 200, after: 100 },
      }));
      continue;
    }

    // Blockquote (callout или цитата)
    const bqMatch = trimmed.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
    if (bqMatch) {
      const inner = bqMatch[1].replace(/<\/?p[^>]*>/gi, '').trim();
      children.push(new Paragraph({
        children: parseInlineElements(inner),
        indent: { left: 720 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: 'A6E800' },
        },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }

    // Figure с картинкой
    const figMatch = trimmed.match(/<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[\s\S]*?<\/figure>/i);
    if (figMatch) {
      const imgSrc = figMatch[1];
      const imgAlt = figMatch[2];

      if (imgSrc.startsWith('/uploads/')) {
        try {
          const filePath = join(process.cwd(), 'public', imgSrc);
          const imageBuffer = await readFile(filePath);
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: imageBuffer,
                transformation: { width: 600, height: 340 },
                type: 'png',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
          }));
          children.push(new Paragraph({
            children: [new TextRun({ text: imgAlt, italics: true, size: 20, color: '666666' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }));
        } catch {
          children.push(new Paragraph({
            children: [new TextRun({ text: `[Изображение: ${imgAlt}]`, italics: true, color: '666666' })],
            spacing: { before: 200, after: 200 },
          }));
        }
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: `[Изображение: ${imgAlt}]`, italics: true, color: '666666' })],
          spacing: { before: 200, after: 200 },
        }));
      }
      continue;
    }

    // UL / OL
    const ulMatch = trimmed.match(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/i);
    if (ulMatch) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(ulMatch[1])) !== null) {
        children.push(new Paragraph({
          children: parseInlineElements(liMatch[1]),
          bullet: { level: 0 },
          spacing: { after: 50 },
        }));
      }
      continue;
    }

    // P
    const pMatch = trimmed.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (pMatch) {
      const inner = pMatch[1].trim();
      if (!inner) continue;
      children.push(new Paragraph({
        children: parseInlineElements(inner),
        spacing: { after: 150 },
      }));
      continue;
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer).toString('base64');
}

function parseInlineElements(html: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  const cleaned = html.replace(/<br\s*\/?>/gi, '\n');

  const parts = cleaned.split(/(<(?:strong|em|a|cite)[^>]*>[\s\S]*?<\/(?:strong|em|a|cite)>)/gi);

  for (const part of parts) {
    const strongMatch = part.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
    if (strongMatch) {
      runs.push(new TextRun({ text: stripTags(strongMatch[1]), bold: true, size: 24 }));
      continue;
    }

    const emMatch = part.match(/<em[^>]*>([\s\S]*?)<\/em>/i);
    if (emMatch) {
      runs.push(new TextRun({ text: stripTags(emMatch[1]), italics: true, size: 24 }));
      continue;
    }

    const linkMatch = part.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      runs.push(new ExternalHyperlink({
        link: linkMatch[1],
        children: [new TextRun({ text: stripTags(linkMatch[2]), color: '2563EB', underline: {}, size: 24 })],
      }));
      continue;
    }

    const citeMatch = part.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i);
    if (citeMatch) {
      runs.push(new TextRun({ text: stripTags(citeMatch[1]), italics: true, size: 20, color: '666666' }));
      continue;
    }

    const text = stripTags(part);
    if (text) {
      runs.push(new TextRun({ text, size: 24 }));
    }
  }

  return runs;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
