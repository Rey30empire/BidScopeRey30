import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, degrees, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { EstimatePremiumRenderModel } from '@/lib/estimates/estimate-render-model';
import { PREMIUM_TOKENS, type PremiumStyleTokens } from '@/lib/pdf/pdf-premium-style-tokens';

export type PremiumFontPack = {
  sansRegular: PDFFont;
  sansBold: PDFFont;
  serifBold: PDFFont;
};

export type PremiumPdfState = {
  pdf: PDFDocument;
  page: PDFPage;
  model: EstimatePremiumRenderModel;
  fonts: PremiumFontPack;
  tokens: PremiumStyleTokens;
  pageNumber: number;
  cursorY: number;
  logoImage?: PDFImage | null;
};

let premiumFontBytesPromise: Promise<{ sansRegular: Buffer; sansBold: Buffer; serifBold: Buffer }> | null = null;

function fontAssetPath(fileName: string) {
  return path.join(process.cwd(), 'src', 'assets', 'fonts', fileName);
}

async function loadPremiumFontBytes() {
  premiumFontBytesPromise ??= Promise.all([
    readFile(fontAssetPath('NotoSans-Regular.ttf')),
    readFile(fontAssetPath('NotoSans-Bold.ttf')),
    readFile(fontAssetPath('NotoSerif-Bold.ttf')),
  ]).then(([sansRegular, sansBold, serifBold]) => ({ sansRegular, sansBold, serifBold }));

  return premiumFontBytesPromise;
}

export async function loadPremiumFonts(pdf: PDFDocument): Promise<PremiumFontPack> {
  pdf.registerFontkit(fontkit);
  const fontBytes = await loadPremiumFontBytes();
  return {
    sansRegular: await pdf.embedFont(fontBytes.sansRegular, { subset: true }),
    sansBold: await pdf.embedFont(fontBytes.sansBold, { subset: true }),
    serifBold: await pdf.embedFont(fontBytes.serifBold, { subset: true }),
  };
}

function drawCornerFlourish(page: PDFPage, x: number, y: number, rotate = 0) {
  const path = 'M 0 0 C 8 -4 14 -12 16 -22 C 21 -14 28 -6 38 -2 C 28 2 20 11 17 20 C 12 12 6 4 0 0';
  page.drawSvgPath(path, {
    x,
    y,
    rotate: degrees(rotate),
    scale: 0.95,
    color: PREMIUM_TOKENS.frame,
    borderColor: PREMIUM_TOKENS.frame,
    borderWidth: 0.8,
    opacity: 0.75,
  });
}

export function drawDividerFlourish(page: PDFPage, centerX: number, y: number, width = 148) {
  page.drawLine({
    start: { x: centerX - width / 2, y },
    end: { x: centerX - 28, y },
    thickness: 0.8,
    color: PREMIUM_TOKENS.frame,
    opacity: 0.7,
  });
  page.drawLine({
    start: { x: centerX + 28, y },
    end: { x: centerX + width / 2, y },
    thickness: 0.8,
    color: PREMIUM_TOKENS.frame,
    opacity: 0.7,
  });
  page.drawSvgPath('M 0 0 C 10 8 18 8 28 0 C 18 -8 10 -8 0 0 Z', {
    x: centerX - 14,
    y: y - 2,
    color: PREMIUM_TOKENS.frame,
    opacity: 0.75,
  });
}

function drawMiniFallbackEmblem(page: PDFPage, centerX: number, topY: number) {
  const roofColor = PREMIUM_TOKENS.accent;
  const slateColor = PREMIUM_TOKENS.ink;
  page.drawSvgPath('M 0 0 L 12 10 L 24 0 L 24 -3 L 12 6 L 0 -3 Z', {
    x: centerX - 12,
    y: topY,
    color: roofColor,
  });
  page.drawSvgPath('M 0 0 L 10 9 L 20 0 L 20 -3 L 10 4 L 0 -3 Z', {
    x: centerX + 3,
    y: topY + 3,
    color: slateColor,
  });
}

function drawPremiumRunningFooter(state: PremiumPdfState) {
  const y = 28;
  const leftX = state.tokens.contentInset + 6;
  const rightX = state.tokens.pageWidth - state.tokens.contentInset - 6;
  const centerX = state.tokens.pageWidth / 2;
  const estimateNumber = state.model.metaFields.find((field) => field.label === 'Estimate #')?.value || state.model.infoRight.find((field) => field.label === 'Estimate #')?.value || '';
  const generatedText = state.model.footerGeneratedByText.toUpperCase();
  const pageText = `Page ${state.pageNumber}`;

  state.page.drawLine({
    start: { x: leftX, y: y + 14 },
    end: { x: rightX, y: y + 14 },
    thickness: 0.35,
    color: state.tokens.line,
    opacity: 0.6,
  });

  if (estimateNumber) {
    state.page.drawText(estimateNumber, {
      x: leftX,
      y,
      font: state.fonts.sansRegular,
      size: 7.4,
      color: state.tokens.muted,
    });
  }

  const generatedWidth = state.fonts.sansBold.widthOfTextAtSize(generatedText, 7.5);
  state.page.drawText(generatedText, {
    x: centerX - generatedWidth / 2,
    y,
    font: state.fonts.sansBold,
    size: 7.5,
    color: state.tokens.accent,
  });

  const pageWidth = state.fonts.sansRegular.widthOfTextAtSize(pageText, 7.4);
  state.page.drawText(pageText, {
    x: rightX - pageWidth,
    y,
    font: state.fonts.sansRegular,
    size: 7.4,
    color: state.tokens.muted,
  });
}

export function drawPremiumPageChrome(state: PremiumPdfState, continuation = false) {
  const { page, tokens } = state;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: tokens.pageWidth,
    height: tokens.pageHeight,
    color: tokens.paper,
  });

  page.drawRectangle({
    x: tokens.outerFrameInset,
    y: tokens.outerFrameInset,
    width: tokens.pageWidth - tokens.outerFrameInset * 2,
    height: tokens.pageHeight - tokens.outerFrameInset * 2,
    borderColor: tokens.frame,
    borderWidth: 0.9,
  });

  page.drawRectangle({
    x: tokens.innerFrameInset,
    y: tokens.innerFrameInset,
    width: tokens.pageWidth - tokens.innerFrameInset * 2,
    height: tokens.pageHeight - tokens.innerFrameInset * 2,
    borderColor: tokens.line,
    borderWidth: 0.45,
  });

  drawCornerFlourish(page, 28, tokens.pageHeight - 24, 0);
  drawCornerFlourish(page, tokens.pageWidth - 66, tokens.pageHeight - 24, 90);
  drawCornerFlourish(page, 28, 66, -90);
  drawCornerFlourish(page, tokens.pageWidth - 66, 66, 180);
  drawDividerFlourish(page, tokens.pageWidth / 2, tokens.pageHeight - 25, 92);
  drawPremiumRunningFooter(state);

  if (continuation) {
    page.drawRectangle({
      x: tokens.contentInset,
      y: tokens.pageHeight - 74,
      width: tokens.pageWidth - tokens.contentInset * 2,
      height: 30,
      color: tokens.paperShade,
      borderColor: tokens.line,
      borderWidth: 0.5,
    });
    page.drawLine({
      start: { x: tokens.contentInset + 12, y: tokens.pageHeight - 59 },
      end: { x: tokens.pageWidth - tokens.contentInset - 12, y: tokens.pageHeight - 59 },
      thickness: 0.6,
      color: tokens.frame,
      opacity: 0.55,
    });
  }
}

export function createPremiumState(
  pdf: PDFDocument,
  model: EstimatePremiumRenderModel,
  fonts: PremiumFontPack,
  options?: { logoImage?: PDFImage | null },
): PremiumPdfState {
  const page = pdf.addPage([PREMIUM_TOKENS.pageWidth, PREMIUM_TOKENS.pageHeight]);
  const state: PremiumPdfState = {
    pdf,
    page,
    model,
    fonts,
    tokens: PREMIUM_TOKENS,
    pageNumber: 1,
    cursorY: PREMIUM_TOKENS.pageHeight - PREMIUM_TOKENS.contentInset,
    logoImage: options?.logoImage ?? null,
  };
  drawPremiumPageChrome(state, false);
  return state;
}

function drawPremiumContinuationHeader(state: PremiumPdfState, sectionTitle?: string) {
  const panelX = state.tokens.contentInset;
  const panelY = state.tokens.pageHeight - 42;
  const panelWidth = state.tokens.pageWidth - state.tokens.contentInset * 2;
  const panelHeight = 70;
  const metaWidth = 172;
  const brandWidth = panelWidth - metaWidth - 18;
  const brandCenterX = panelX + brandWidth / 2;
  const estimateNumber = state.model.metaFields.find((field) => field.label === 'Estimate #')?.value || '';
  const version = state.model.metaFields.find((field) => field.label === 'Version')?.value || '';
  const pageText = `Page ${state.pageNumber}`;
  const sectionText = (sectionTitle || `${state.model.estimateTitle} Continued`).toUpperCase();

  state.page.drawRectangle({
    x: panelX,
    y: panelY - panelHeight,
    width: panelWidth,
    height: panelHeight,
    color: state.tokens.paper,
    borderColor: state.tokens.line,
    borderWidth: 0.55,
  });

  if (state.logoImage) {
    const scaled = state.logoImage.scale(0.095);
    state.page.drawImage(state.logoImage, {
      x: brandCenterX - scaled.width / 2,
      y: panelY - scaled.height - 2,
      width: scaled.width,
      height: scaled.height,
      opacity: 0.95,
    });
  } else {
    drawMiniFallbackEmblem(state.page, brandCenterX, panelY - 12);
  }

  const companySize = fitTextSize(state.fonts.serifBold, state.model.branding.companyName.toUpperCase(), brandWidth - 30, 12.5, 9);
  const companyWidth = state.fonts.serifBold.widthOfTextAtSize(state.model.branding.companyName.toUpperCase(), companySize);
  state.page.drawText(state.model.branding.companyName.toUpperCase(), {
    x: brandCenterX - companyWidth / 2,
    y: panelY - 30,
    font: state.fonts.serifBold,
    size: companySize,
    color: state.tokens.ink,
  });

  const subtitleText = state.model.branding.subtitle.toUpperCase();
  const subtitleWidth = state.fonts.sansBold.widthOfTextAtSize(subtitleText, 7.8);
  state.page.drawText(subtitleText, {
    x: brandCenterX - subtitleWidth / 2,
    y: panelY - 42,
    font: state.fonts.sansBold,
    size: 7.8,
    color: state.tokens.accent,
  });

  const sectionWidth = state.fonts.serifBold.widthOfTextAtSize(sectionText, 11.4);
  state.page.drawText(sectionText, {
    x: brandCenterX - sectionWidth / 2,
    y: panelY - 58,
    font: state.fonts.serifBold,
    size: 11.4,
    color: state.tokens.ink,
  });

  const metaX = panelX + panelWidth - metaWidth;
  state.page.drawRectangle({
    x: metaX,
    y: panelY - panelHeight,
    width: metaWidth,
    height: panelHeight,
    color: state.tokens.paperShade,
    borderColor: state.tokens.line,
    borderWidth: 0.45,
  });

  const metaRows = [
    { label: 'Estimate #', value: estimateNumber },
    { label: 'Version', value: version },
    { label: 'Section', value: sectionTitle || 'Continuation' },
    { label: 'Page', value: pageText },
  ];

  let rowY = panelY - 14;
  for (const row of metaRows) {
    state.page.drawText(row.label, {
      x: metaX + 10,
      y: rowY,
      font: state.fonts.sansRegular,
      size: 8.6,
      color: state.tokens.muted,
    });
    const valueWidth = state.fonts.sansBold.widthOfTextAtSize(row.value, 8.6);
    state.page.drawText(row.value, {
      x: metaX + metaWidth - valueWidth - 10,
      y: rowY,
      font: state.fonts.sansBold,
      size: 8.6,
      color: state.tokens.ink,
    });
    if (row !== metaRows.at(-1)) {
      state.page.drawLine({
        start: { x: metaX + 8, y: rowY - 7 },
        end: { x: metaX + metaWidth - 8, y: rowY - 7 },
        thickness: 0.3,
        color: state.tokens.line,
        opacity: 0.75,
      });
    }
    rowY -= 15;
  }

  drawDividerFlourish(state.page, state.tokens.pageWidth / 2, panelY - panelHeight - 8, 146);
}

export function beginContinuationPage(state: PremiumPdfState, options?: { sectionTitle?: string }) {
  state.page = state.pdf.addPage([state.tokens.pageWidth, state.tokens.pageHeight]);
  state.pageNumber += 1;
  drawPremiumPageChrome(state, true);
  drawPremiumContinuationHeader(state, options?.sectionTitle);
  state.cursorY = state.tokens.pageHeight - 128;
}

export function ensurePremiumSpace(state: PremiumPdfState, neededHeight: number, options?: { sectionTitle?: string }) {
  if (state.cursorY - neededHeight < 90) {
    beginContinuationPage(state, options);
  }
}

function splitLongToken(font: PDFFont, size: number, token: string, width: number) {
  if (width <= 0 || font.widthOfTextAtSize(token, size) <= width) {
    return [token];
  }

  const segments: string[] = [];
  let current = '';
  for (const char of [...token]) {
    const candidate = `${current}${char}`;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      segments.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) segments.push(current);
  return segments.length ? segments : [token];
}

export function wrapText(font: PDFFont, size: number, text: string, width: number) {
  const paragraphs = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim());

  if (!paragraphs.some(Boolean)) return [''];

  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      if (lines.at(-1) !== '') lines.push('');
      continue;
    }

    const words = paragraph.split(' ').flatMap((word) => splitLongToken(font, size, word, width));
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }

      const candidate = `${current} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines.length ? lines : [''];
}

export function fitTextSize(font: PDFFont, text: string, maxWidth: number, initialSize: number, minSize = 8) {
  let size = initialSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

export function drawWrappedText(input: {
  state: PremiumPdfState;
  text: string;
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  color?: PremiumStyleTokens['ink'];
  lineHeight?: number;
  maxLines?: number;
}) {
  const lines = wrapText(input.font, input.size, input.text, input.width).slice(0, input.maxLines ?? 999);
  const lineHeight = input.lineHeight ?? input.size * 1.35;
  let currentY = input.y;
  for (const line of lines) {
    input.state.page.drawText(line, {
      x: input.x,
      y: currentY,
      font: input.font,
      size: input.size,
      color: input.color ?? input.state.tokens.ink,
    });
    currentY -= lineHeight;
  }
  return {
    lines,
    bottomY: currentY,
    usedHeight: lines.length * lineHeight,
  };
}

export function drawWrappedTextRightAligned(input: {
  state: PremiumPdfState;
  text: string;
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  color?: PremiumStyleTokens['ink'];
  lineHeight?: number;
  maxLines?: number;
}) {
  const lines = wrapText(input.font, input.size, input.text, input.width).slice(0, input.maxLines ?? 999);
  const lineHeight = input.lineHeight ?? input.size * 1.35;
  let currentY = input.y;
  for (const line of lines) {
    input.state.page.drawText(line, {
      x: input.x + input.width - input.font.widthOfTextAtSize(line, input.size),
      y: currentY,
      font: input.font,
      size: input.size,
      color: input.color ?? input.state.tokens.ink,
    });
    currentY -= lineHeight;
  }
  return {
    lines,
    bottomY: currentY,
    usedHeight: lines.length * lineHeight,
  };
}

export function drawPremiumPanel(input: {
  state: PremiumPdfState;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: PremiumStyleTokens['paperShade'];
}) {
  input.state.page.drawRectangle({
    x: input.x,
    y: input.y - input.height,
    width: input.width,
    height: input.height,
    color: input.fill ?? input.state.tokens.paper,
    borderColor: input.state.tokens.line,
    borderWidth: 0.6,
    opacity: 0.96,
  });
}

export function drawSectionRibbon(input: {
  state: PremiumPdfState;
  title: string;
  x: number;
  y: number;
  width: number;
  dark?: boolean;
  amountText?: string;
}) {
  const fill = input.dark ? input.state.tokens.ink : input.state.tokens.paperShade;
  const textColor = input.dark ? input.state.tokens.paper : input.state.tokens.ink;
  input.state.page.drawRectangle({
    x: input.x,
    y: input.y - 18,
    width: input.width,
    height: 18,
    color: fill,
    borderColor: input.state.tokens.line,
    borderWidth: 0.5,
  });
  input.state.page.drawText(input.title, {
    x: input.x + 10,
    y: input.y - 12,
    font: input.state.fonts.serifBold,
    size: 11.2,
    color: textColor,
  });
  if (input.amountText) {
    const amountWidth = input.state.fonts.sansBold.widthOfTextAtSize(input.amountText, 11);
    input.state.page.drawText(input.amountText, {
      x: input.x + input.width - amountWidth - 10,
      y: input.y - 12,
      font: input.state.fonts.sansBold,
      size: 11,
      color: textColor,
    });
  }
}

export function measureWrappedHeight(font: PDFFont, size: number, text: string, width: number, lineHeight = size * 1.35, maxLines?: number) {
  const lines = wrapText(font, size, text, width);
  const count = typeof maxLines === 'number' ? Math.min(lines.length, maxLines) : lines.length;
  return count * lineHeight;
}
