import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { buildEstimateDocumentContext, buildEstimatePdf } from '@/lib/server/estimate-document-service';
import { sendEstimateEmail } from '@/lib/server/email';
import { logEstimateActivity } from '@/lib/server/event-log-service';
import {
  buildEstimateDeliveryEmailHtml,
  buildEstimateDeliveryEmailText,
} from '@/lib/server/estimate-delivery-template';
import {
  ensureEstimateCanSend,
  EstimateWorkflowValidationError,
} from '@/lib/server/estimate-preflight-service';
import {
  isDocumentVersionAllowedForEstimate,
  type EstimateDocumentVersion,
} from '@/lib/estimate';
import { buildEstimatePremiumViewModel } from '@/lib/estimates/estimate-premium-view-model';
import { resolvePremiumBranding } from '@/lib/pdf/pdf-branding';
import { assertSendableAppBaseUrl, resolveAppBaseUrl } from '@/lib/server/app-base-url';

function getTrackingExpirationHours() {
  const value = Number(process.env.TRACKING_LINK_EXPIRATION_HOURS || 240);
  return Number.isFinite(value) && value > 0 ? value : 240;
}

function pixelEnabled() {
  return (process.env.ENABLE_OPEN_TRACKING_PIXEL || 'true').trim().toLowerCase() !== 'false';
}

function createSecureToken() {
  return randomBytes(32).toString('hex');
}

export async function sendEstimateDelivery(input: {
  estimateId: string;
  documentVersion: EstimateDocumentVersion;
  recipientEmail: string;
  recipientName?: string;
  sentByName?: string;
  sentByEmail?: string;
  requestOrigin?: string | null;
}) {
  const estimate = await db.estimate.findUnique({
    where: { id: input.estimateId },
    include: {
      project: true,
    },
  });

  if (!estimate) {
    throw new EstimateWorkflowValidationError('Estimate not found.', { statusCode: 404 });
  }

  if (!isDocumentVersionAllowedForEstimate(estimate.estimateType as 'trade' | 'global', input.documentVersion)) {
    throw new EstimateWorkflowValidationError('The selected estimate version does not match this estimate type.');
  }

  ensureEstimateCanSend({ project: estimate.project, estimate }, input.documentVersion);

  const token = createSecureToken();
  const baseUrl = assertSendableAppBaseUrl(
    resolveAppBaseUrl({ requestOrigin: input.requestOrigin }),
    { recipientEmail: input.recipientEmail },
  ).url;
  const linkExpiresAt = new Date(Date.now() + getTrackingExpirationHours() * 60 * 60 * 1000);
  const secureViewUrl = `${baseUrl}/estimate-delivery/${token}`;
  const secureDownloadUrl = `${baseUrl}/api/estimate-delivery/${token}/download`;
  const htmlTrackingPixelUrl = `${baseUrl}/api/estimate-delivery/${token}/pixel`;

  const createdSend = await db.estimateSend.create({
    data: {
      estimateId: estimate.id,
      documentVersion: input.documentVersion,
      recipientEmail: input.recipientEmail.trim(),
      recipientName: input.recipientName?.trim() || null,
      sentByName: input.sentByName?.trim() || null,
      sentByEmail: input.sentByEmail?.trim() || null,
      secureToken: token,
      secureViewUrl,
      secureDownloadUrl,
      htmlTrackingPixelUrl: pixelEnabled() ? htmlTrackingPixelUrl : null,
      status: 'Sent',
      linkExpiresAt,
    },
  });

  const source = { project: estimate.project, estimate };
  const context = buildEstimateDocumentContext(source);
  const pdf = await buildEstimatePdf(source, input.documentVersion, secureViewUrl);
  const branding = resolvePremiumBranding({ companyName: context.companyName });
  const model = buildEstimatePremiumViewModel({
    branding,
    context,
    documentVersion: input.documentVersion,
  });
  const emailHtml = buildEstimateDeliveryEmailHtml({
    model,
    documentVersion: input.documentVersion,
    recipientName: input.recipientName,
    secureViewUrl,
    secureDownloadUrl,
    pixelUrl: pixelEnabled() ? htmlTrackingPixelUrl : null,
  });
  const text = buildEstimateDeliveryEmailText({
    model,
    documentVersion: input.documentVersion,
    secureViewUrl,
    secureDownloadUrl,
  });

  const emailResult = await sendEstimateEmail({
    to: input.recipientEmail,
    subject: `${estimate.title} - ${estimate.project.name}`,
    html: emailHtml,
    text,
    attachments: [
      {
        filename: `${estimate.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        contentBase64: pdf.toString('base64'),
      },
    ],
  });

  await db.estimate.update({
    where: { id: estimate.id },
    data: {
      sentCount: { increment: 1 },
      lastSentAt: new Date(),
      status: 'Sent',
    },
  });

  await logEstimateActivity({
    estimateId: estimate.id,
    estimateSendId: createdSend.id,
    activityType: 'sent',
    title: 'Estimate sent',
    description: `Estimate sent to ${input.recipientEmail.trim()} as ${input.documentVersion}.`,
    metadata: {
      documentVersion: input.documentVersion,
      recipientEmail: input.recipientEmail.trim(),
      secureViewUrl,
      providerMessageId: emailResult.id,
    },
  });

  return {
    sendId: createdSend.id,
    providerMessageId: emailResult.id,
    secureViewUrl,
    secureDownloadUrl,
    pixelUrl: createdSend.htmlTrackingPixelUrl,
  };
}
