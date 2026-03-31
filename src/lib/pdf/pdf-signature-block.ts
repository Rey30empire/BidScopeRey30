import type { PDFImage } from 'pdf-lib';
import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';

export function drawPremiumSignatureBlock(input: {
  state: PremiumPdfState;
  x: number;
  y: number;
  width: number;
  signatureImage?: PDFImage | null;
}) {
  const { state, x, y, width, signatureImage } = input;

  if (signatureImage) {
    const scaled = signatureImage.scale(0.16);
    state.page.drawImage(signatureImage, {
      x: x + width / 2 - scaled.width / 2,
      y: y - scaled.height + 8,
      width: scaled.width,
      height: scaled.height,
      opacity: 0.92,
    });
  } else {
    const signatureWidth = state.fonts.serifBold.widthOfTextAtSize(state.model.signatureName, 16);
    state.page.drawText(state.model.signatureName, {
      x: x + width / 2 - signatureWidth / 2,
      y: y - 18,
      font: state.fonts.serifBold,
      size: 16,
      color: state.tokens.ink,
    });
  }

  state.page.drawLine({
    start: { x: x + 12, y: y - 24 },
    end: { x: x + width - 12, y: y - 24 },
    thickness: 0.45,
    color: state.tokens.line,
  });
  state.page.drawText(state.model.signatureLabel.toUpperCase(), {
    x: x + 12,
    y: y - 36,
    font: state.fonts.sansBold,
    size: 8.5,
    color: state.tokens.muted,
  });
  state.page.drawText(state.model.signatureNote, {
    x: x + width - state.fonts.sansRegular.widthOfTextAtSize(state.model.signatureNote, 8.5) - 12,
    y: y - 36,
    font: state.fonts.sansRegular,
    size: 8.5,
    color: state.tokens.muted,
  });
}
