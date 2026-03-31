import type { PDFImage } from 'pdf-lib';
import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { drawDividerFlourish, fitTextSize } from '@/lib/pdf/pdf-premium-layout';

function drawFallbackEmblem(state: PremiumPdfState, centerX: number, topY: number) {
  const roofColor = state.tokens.accent;
  const slateColor = state.tokens.ink;
  state.page.drawSvgPath('M 0 0 L 22 20 L 44 0 L 44 -4 L 22 12 L 0 -4 Z', {
    x: centerX - 22,
    y: topY - 2,
    color: roofColor,
  });
  state.page.drawSvgPath('M 0 0 L 18 16 L 36 0 L 36 -4 L 18 8 L 0 -4 Z', {
    x: centerX + 2,
    y: topY + 4,
    color: slateColor,
  });
  state.page.drawRectangle({
    x: centerX - 14,
    y: topY - 24,
    width: 28,
    height: 18,
    borderColor: roofColor,
    borderWidth: 1,
  });
  state.page.drawRectangle({
    x: centerX - 3,
    y: topY - 24,
    width: 6,
    height: 10,
    borderColor: roofColor,
    borderWidth: 1,
  });
}

export function drawPremiumHeader(input: {
  state: PremiumPdfState;
  logoImage?: PDFImage | null;
}) {
  const { state, logoImage } = input;
  const headerTop = state.tokens.pageHeight - 48;
  const centerX = state.tokens.pageWidth / 2;

  if (logoImage) {
    const scaled = logoImage.scale(0.19);
    state.page.drawImage(logoImage, {
      x: centerX - scaled.width / 2,
      y: headerTop - scaled.height,
      width: scaled.width,
      height: scaled.height,
      opacity: 0.96,
    });
  } else {
    drawFallbackEmblem(state, centerX, headerTop - 2);
  }

  const words = state.model.branding.companyName.toUpperCase().split(/\s+/).filter(Boolean);
  const topLineCandidate = words.length > 1 ? words.slice(0, -1).join(' ') : words[0] || state.model.branding.companyName.toUpperCase();
  const bottomLineCandidate = words.length > 1 ? words.at(-1) || '' : '';
  const topLineSize = fitTextSize(state.fonts.serifBold, topLineCandidate, 248, 20, 13);
  const bottomLineSize = bottomLineCandidate ? fitTextSize(state.fonts.serifBold, bottomLineCandidate, 248, 18, 12) : 0;
  const topWidth = state.fonts.serifBold.widthOfTextAtSize(topLineCandidate, topLineSize);
  state.page.drawText(topLineCandidate, {
    x: centerX - topWidth / 2,
    y: headerTop - 58,
    font: state.fonts.serifBold,
    size: topLineSize,
    color: state.tokens.ink,
  });
  if (bottomLineCandidate) {
    const bottomWidth = state.fonts.serifBold.widthOfTextAtSize(bottomLineCandidate, bottomLineSize);
    state.page.drawText(bottomLineCandidate, {
      x: centerX - bottomWidth / 2,
      y: headerTop - 78,
      font: state.fonts.serifBold,
      size: bottomLineSize,
      color: state.tokens.accent,
    });
  }

  drawDividerFlourish(state.page, centerX, headerTop - 94, 212);
  const subtitleWidth = state.fonts.sansBold.widthOfTextAtSize(state.model.branding.subtitle.toUpperCase(), 9.8);
  state.page.drawText(state.model.branding.subtitle.toUpperCase(), {
    x: centerX - subtitleWidth / 2,
    y: headerTop - 100,
    font: state.fonts.sansBold,
    size: 9.8,
    color: state.tokens.accent,
  });

  const metaX = state.tokens.pageWidth - state.tokens.contentInset - 162;
  const metaY = state.tokens.pageHeight - 56;
  state.page.drawRectangle({
    x: metaX,
    y: metaY - 102,
    width: 162,
    height: 102,
    borderColor: state.tokens.line,
    borderWidth: 0.55,
    color: state.tokens.paper,
  });

  let rowY = metaY - 18;
  for (const field of state.model.metaFields) {
    state.page.drawText(field.label, {
      x: metaX + 12,
      y: rowY,
      font: state.fonts.sansRegular,
      size: 10.2,
      color: state.tokens.muted,
    });
    state.page.drawText(field.value, {
      x: metaX + 78,
      y: rowY,
      font: state.fonts.sansBold,
      size: 10.2,
      color: state.tokens.ink,
    });
    state.page.drawLine({
      start: { x: metaX + 10, y: rowY - 8 },
      end: { x: metaX + 152, y: rowY - 8 },
      thickness: 0.35,
      color: state.tokens.line,
      opacity: 0.7,
    });
    rowY -= 22;
  }

  state.cursorY = headerTop - 128;
}
