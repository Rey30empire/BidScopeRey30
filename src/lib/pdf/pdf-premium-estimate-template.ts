import type { EstimatePremiumRenderModel } from '@/lib/estimates/estimate-render-model';
import { renderPremiumPdf } from '@/lib/pdf/render-premium-pdf';

export async function buildPremiumEstimateTemplate(model: EstimatePremiumRenderModel) {
  return renderPremiumPdf(model);
}
