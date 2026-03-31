import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { drawDividerFlourish, fitTextSize } from '@/lib/pdf/pdf-premium-layout';

export function drawPremiumTitle(state: PremiumPdfState) {
  const titleY = state.cursorY;
  const titleText = state.model.estimateTitle.toUpperCase();
  const titleSize = fitTextSize(state.fonts.serifBold, titleText, 360, 27, 18);
  const titleWidth = state.fonts.serifBold.widthOfTextAtSize(titleText, titleSize);

  state.page.drawText(state.model.estimateTitle.toUpperCase(), {
    x: state.tokens.pageWidth / 2 - titleWidth / 2,
    y: titleY,
    font: state.fonts.serifBold,
    size: titleSize,
    color: state.tokens.ink,
  });

  const subtitleWidth = state.fonts.sansBold.widthOfTextAtSize(state.model.estimateSubtitle.toUpperCase(), 10.5);
  state.page.drawText(state.model.estimateSubtitle.toUpperCase(), {
    x: state.tokens.pageWidth / 2 - subtitleWidth / 2,
    y: titleY - 20,
    font: state.fonts.sansBold,
    size: 10.5,
    color: state.tokens.accent,
  });

  drawDividerFlourish(state.page, state.tokens.pageWidth / 2, titleY - 34, 176);
  state.cursorY = titleY - 56;
}
