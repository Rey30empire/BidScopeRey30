import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { drawPremiumPanel, drawSectionRibbon, drawWrappedText, drawWrappedTextRightAligned, measureWrappedHeight } from '@/lib/pdf/pdf-premium-layout';

export function drawPremiumSummaryBox(input: {
  state: PremiumPdfState;
  x: number;
  y: number;
  width: number;
}) {
  const { state, x, y, width } = input;
  const bodyHeight = state.model.summaryRows.reduce((total, row) => {
    const labelSize = row.emphasize ? 11 : 9.6;
    const valueSize = row.emphasize ? 11 : 9.6;
    const lineHeight = row.emphasize ? 13.2 : 11.8;
    const labelHeight = measureWrappedHeight(state.fonts.sansRegular, labelSize, row.label, width - 120, lineHeight);
    const valueHeight = measureWrappedHeight(state.fonts.sansBold, valueSize, row.value, 88, lineHeight);
    return total + Math.max(labelHeight, valueHeight) + (row.emphasize ? 6 : 4);
  }, 0);
  const height = Math.max(118, 30 + bodyHeight + 12);
  drawPremiumPanel({ state, x, y, width, height });
  drawSectionRibbon({
    state,
    title: 'Summary',
    x: x + 1,
    y: y - 2,
    width: width - 2,
    dark: true,
    amountText: state.model.finalTotal,
  });

  let rowY = y - 30;
  for (const row of state.model.summaryRows) {
    const font = row.emphasize ? state.fonts.sansBold : state.fonts.sansRegular;
    const size = row.emphasize ? 11 : 9.6;
    const lineHeight = row.emphasize ? 13.2 : 11.8;
    drawWrappedText({
      state,
      text: row.label,
      x: x + 12,
      y: rowY,
      font,
      size,
      width: width - 120,
      color: state.tokens.ink,
      lineHeight,
    });
    drawWrappedTextRightAligned({
      state,
      text: row.value,
      x: x + width - 100,
      y: rowY,
      font,
      size,
      width: 88,
      color: state.tokens.ink,
      lineHeight,
    });
    const labelHeight = measureWrappedHeight(font, size, row.label, width - 120, lineHeight);
    const valueHeight = measureWrappedHeight(font, size, row.value, 88, lineHeight);
    rowY -= Math.max(labelHeight, valueHeight) + (row.emphasize ? 6 : 4);
  }

  return height;
}
