import type { PDFImage } from 'pdf-lib';
import type { PremiumPdfState } from '@/lib/pdf/pdf-premium-layout';
import { drawPremiumSignatureBlock } from '@/lib/pdf/pdf-signature-block';

export function drawPremiumFooter(input: {
  state: PremiumPdfState;
  signatureImage?: PDFImage | null;
}) {
  const { state, signatureImage } = input;
  const footerY = 86;

  drawPremiumSignatureBlock({
    state,
    x: state.tokens.contentInset + 180,
    y: footerY + 48,
    width: 184,
    signatureImage,
  });

  const legalWidth = state.fonts.sansRegular.widthOfTextAtSize(state.model.footerLegalText, 6.9);
  state.page.drawText(state.model.footerLegalText, {
    x: state.tokens.pageWidth / 2 - Math.min(legalWidth, state.tokens.pageWidth - 120) / 2,
    y: 36,
    font: state.fonts.sansRegular,
    size: 6.9,
    color: state.tokens.muted,
  });
}
