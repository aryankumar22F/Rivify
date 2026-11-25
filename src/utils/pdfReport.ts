import type { HistoryItem, QuizAttempt } from '../types';
import type { GamificationSummary } from '../engine/gamification';

export function triggerHaptic(enabled: boolean, pattern: number | number[] = 12) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // ignore unsupported browsers
  }
}

function escapePdfText(text: string): string {
  // Replace non-ASCII symbols with clean ASCII approximations for standard PDF Helvetica encoding
  const ascii = text
    .replace(/∂/g, 'd')
    .replace(/∇/g, 'grad')
    .replace(/·/g, '*')
    .replace(/×/g, 'x')
    .replace(/⟨/g, '<')
    .replace(/⟩/g, '>')
    .replace(/−/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/[^\x20-\x7E]/g, ' ');
  return ascii.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line: string, maxChars = 84): string[] {
  if (line.length <= maxChars) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > maxChars) {
    let split = rest.lastIndexOf(' ', maxChars);
    if (split <= 20) split = maxChars;
    out.push(rest.slice(0, split));
    rest = rest.slice(split).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

export function downloadCalculusPdfReport(
  history: HistoryItem[],
  quizAttempts: QuizAttempt[],
  gamification: GamificationSummary
) {
  const lines: { text: string; size: number; bold?: boolean }[] = [];
  const push = (text: string, size = 10, bold = false) => {
    for (const part of wrapLine(text, size > 12 ? 62 : 84)) {
      lines.push({ text: part, size, bold });
    }
  };

  push('RIVIFY - Advanced Mathematics Progress & Calculation Report', 15, true);
  push(`Generated: ${new Date().toLocaleString()}`, 9);
  push(' ', 8);

  const totalQuiz = quizAttempts.length;
  const correctQuiz = quizAttempts.filter((a) => a.correct).length;
  const accuracy = totalQuiz > 0 ? `${Math.round((correctQuiz / totalQuiz) * 100)}%` : 'N/A';

  push('1. Learning & Quiz Performance Summary', 12, true);
  push(`Level: ${gamification.level}   |   Total XP: ${gamification.xp}   |   Current Streak: ${gamification.currentStreak} day(s)`);
  push(`Calculations Saved: ${history.length}   |   Quiz Questions Answered: ${totalQuiz}   |   Quiz Accuracy: ${accuracy}`);
  push(' ', 8);

  // Topic breakdown
  const topicMap = new Map<string, { total: number; correct: number }>();
  for (const att of quizAttempts) {
    const cur = topicMap.get(att.category) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (att.correct) cur.correct += 1;
    topicMap.set(att.category, cur);
  }
  if (topicMap.size > 0) {
    push('2. Topic-Wise Quiz Breakdown', 12, true);
    for (const [cat, st] of topicMap.entries()) {
      const pct = Math.round((st.correct / st.total) * 100);
      push(`- ${cat}: ${st.correct}/${st.total} correct (${pct}%)`);
    }
    push(' ', 8);
  }

  push('3. Recent Symbolic Calculations', 12, true);
  if (history.length === 0) {
    push('No calculations recorded yet.');
  } else {
    for (const item of history.slice(0, 18)) {
      const dateStr = new Date(item.timestamp).toLocaleDateString();
      push(`[${dateStr}] ${item.toolLabel}: f = ${item.expression}`, 10, true);
      push(`   Result: ${item.resultPlain}`, 10);
    }
  }

  const blob = buildPdfFromLines(lines);
  triggerBlobDownload(blob, `rivify-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadSingleSolutionPdf(opts: {
  title: string;
  expression: string;
  secondary?: string;
  resultPlain: string;
  steps?: { rule: string; description: string; latex: string }[];
}) {
  const lines: { text: string; size: number; bold?: boolean }[] = [];
  const push = (text: string, size = 10, bold = false) => {
    for (const part of wrapLine(text, size > 12 ? 62 : 84)) {
      lines.push({ text: part, size, bold });
    }
  };

  push(`RIVIFY Solution - ${opts.title}`, 14, true);
  push(`Exported: ${new Date().toLocaleString()}`, 9);
  push(' ', 8);
  push(`Input Expression: ${opts.expression}`, 11, true);
  if (opts.secondary) {
    push(`Parameters: ${opts.secondary}`, 10);
  }
  push(`Result: ${opts.resultPlain}`, 11, true);
  push(' ', 8);

  if (opts.steps && opts.steps.length > 0) {
    push('Step-by-Step Derivation:', 12, true);
    opts.steps.forEach((st, idx) => {
      push(`${idx + 1}. ${st.rule}`, 10, true);
      push(`   ${st.description}`, 9);
      push(`   Formula: ${st.latex}`, 9);
    });
  }

  const blob = buildPdfFromLines(lines);
  triggerBlobDownload(blob, `rivify-solution-${Date.now()}.pdf`);
}

export async function shareSolutionText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch {
    // user cancelled or share unsupported in iframe -> fall back to clipboard
  }
  try {
    await navigator.clipboard.writeText(`${title}\n${text}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export interface ExportDocumentItem {
  heading: string;
  subtitle?: string;
  plainText: string;
  latex?: string;
}

export function downloadCustomPdfReport(opts: {
  title: string;
  author?: string;
  items: ExportDocumentItem[];
  filename?: string;
}) {
  const lines: { text: string; size: number; bold?: boolean }[] = [];
  const push = (text: string, size = 10, bold = false) => {
    for (const part of wrapLine(text, size > 12 ? 62 : 84)) {
      lines.push({ text: part, size, bold });
    }
  };

  push(opts.title, 15, true);
  push(
    `Generated by RIVIFY${opts.author ? ` | ${opts.author}` : ''} | ${new Date().toLocaleString()}`,
    9
  );
  push(' ', 8);

  if (opts.items.length === 0) {
    push('No items selected for export.', 10);
  } else {
    opts.items.forEach((item, idx) => {
      push(`${idx + 1}. ${item.heading}`, 11, true);
      if (item.subtitle) push(`   ${item.subtitle}`, 9);
      if (item.plainText) push(`   ${item.plainText}`, 10);
      if (item.latex) push(`   LaTeX: ${item.latex}`, 9);
      push(' ', 6);
    });
  }

  const blob = buildPdfFromLines(lines);
  triggerBlobDownload(
    blob,
    opts.filename ?? `rivify-export-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

export function buildLatexDocument(opts: {
  title: string;
  author?: string;
  items: ExportDocumentItem[];
}): string {
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([%$#_{}&])/g, '\\$1')
      .replace(/\^/g, '\\^{}');

  const body = opts.items
    .map((item, idx) => {
      const blocks = [`\\section*{${idx + 1}. ${esc(item.heading)}}`];
      if (item.subtitle) blocks.push(`\\textit{${esc(item.subtitle)}}\\\\`);
      if (item.plainText) blocks.push(`${esc(item.plainText)}`);
      if (item.latex) {
        blocks.push(`\\[\n${item.latex}\n\\]`);
      }
      return blocks.join('\n');
    })
    .join('\n\n');

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage{amsmath, amssymb, geometry}
\\geometry{margin=1in}
\\title{${esc(opts.title)}}
\\author{${esc(opts.author || 'RIVIFY Engineering Mathematics')}}
\\date{\\today}

\\begin{document}
\\maketitle

${body || '\\noindent No items selected.'}

\\end{document}
`;
}

export function downloadLatexFile(texContent: string, filename = 'rivify-export.tex') {
  const blob = new Blob([texContent], { type: 'application/x-tex;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}

export function downloadImagePdf(
  jpegDataUrl: string,
  title: string,
  widthPx: number,
  heightPx: number,
  filename = `rivify-whiteboard-${Date.now()}.pdf`
) {
  const base64Match = jpegDataUrl.match(/^data:image\/jpeg;base64,(.+)$/);
  if (!base64Match) return;
  const binStr = atob(base64Match[1]);
  const imgBytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    imgBytes[i] = binStr.charCodeAt(i);
  }

  const encoder = new TextEncoder();
  const pageW = 612;
  const pageH = 792;
  const maxW = pageW - 72;
  const maxH = pageH - 130;
  const ratio = Math.min(maxW / Math.max(1, widthPx), maxH / Math.max(1, heightPx));
  const drawW = Math.round(widthPx * ratio);
  const drawH = Math.round(heightPx * ratio);
  const drawX = Math.round((pageW - drawW) / 2);
  const drawY = Math.round(pageH - 96 - drawH);

  const contentStream = `BT
/F1 14 Tf
1 0 0 1 36 748 Tm
(${escapePdfText(title)}) Tj
/F1 9 Tf
1 0 0 1 36 732 Tm
(${escapePdfText(`Exported from RIVIFY Math Whiteboard | ${new Date().toLocaleString()}`)}) Tj
ET
q
${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm
/Im1 Do
Q`;

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    totalLen += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    totalLen += b.length;
  };

  const offsets: number[] = [0];
  pushStr('%PDF-1.4\n');

  // 1: Catalog
  offsets.push(totalLen);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  offsets.push(totalLen);
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  offsets.push(totalLen);
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 4 0 R >> /XObject << /Im1 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );

  // 4: Font
  offsets.push(totalLen);
  pushStr('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  // 5: Image XObject (DCTDecode)
  offsets.push(totalLen);
  pushStr(
    `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(widthPx)} /Height ${Math.round(
      heightPx
    )} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
  );
  pushBytes(imgBytes);
  pushStr('\nendstream\nendobj\n');

  // 6: Content stream
  const contentBytes = encoder.encode(contentStream);
  offsets.push(totalLen);
  pushStr(`6 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('\nendstream\nendobj\n');

  const xrefPos = totalLen;
  pushStr(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const merged = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  triggerBlobDownload(new Blob([merged], { type: 'application/pdf' }), filename);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildPdfFromLines(lines: { text: string; size: number; bold?: boolean }[]): Blob {
  const pagesLines: typeof lines[] = [];
  let currentPage: typeof lines = [];
  let y = 745;
  for (const l of lines) {
    const step = l.size + 5;
    if (y - step < 52) {
      pagesLines.push(currentPage);
      currentPage = [];
      y = 745;
    }
    currentPage.push(l);
    y -= step;
  }
  if (currentPage.length > 0) pagesLines.push(currentPage);

  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pagesPlaceholderId = addObj('');
  const pageIds: number[] = [];

  for (const pageItems of pagesLines) {
    let stream = 'BT\n';
    let curY = 745;
    for (const item of pageItems) {
      const fontName = item.bold ? '/F2' : '/F1';
      stream += `${fontName} ${item.size} Tf\n1 0 0 1 48 ${curY} Tm\n(${escapePdfText(item.text)}) Tj\n`;
      curY -= item.size + 5;
    }
    stream += 'ET';

    const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesPlaceholderId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesPlaceholderId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(' ')}] /Count ${pageIds.length} >>`;

  const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesPlaceholderId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}
