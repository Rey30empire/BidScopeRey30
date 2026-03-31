import type { EstimateDocumentVersion } from '@/lib/estimate';
import { sendEstimateDelivery } from '@/lib/server/estimate-delivery-service';

export async function sendEstimateWorkflow(input: {
  estimateId: string;
  documentVersion: EstimateDocumentVersion;
  recipientEmail: string;
  recipientName?: string;
  sentByName?: string;
  sentByEmail?: string;
  requestOrigin?: string | null;
}) {
  return sendEstimateDelivery(input);
}
