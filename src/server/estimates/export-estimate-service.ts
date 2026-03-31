import type { EstimateDocumentVersion } from '@/lib/estimate';
import { buildEstimatePremiumViewModel } from '@/lib/estimates/estimate-premium-view-model';
import { buildPremiumEstimateTemplate } from '@/lib/pdf/pdf-premium-estimate-template';
import { resolvePremiumBranding } from '@/lib/pdf/pdf-branding';
import type { EstimateDocumentContext } from '@/lib/server/estimate-document-service';

export async function exportEstimatePdf(input: {
  context: EstimateDocumentContext;
  documentVersion: EstimateDocumentVersion;
}) {
  const branding = resolvePremiumBranding({
    companyName: input.context.companyName,
  });

  const model = buildEstimatePremiumViewModel({
    branding,
    context: input.context,
    documentVersion: input.documentVersion,
  });

  return buildPremiumEstimateTemplate(model);
}
