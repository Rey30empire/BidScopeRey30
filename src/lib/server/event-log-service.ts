import { db } from '@/lib/db';

export async function logEstimateActivity(input: {
  estimateId: string;
  estimateSendId?: string | null;
  activityType: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return db.estimateActivityEvent.create({
    data: {
      estimateId: input.estimateId,
      estimateSendId: input.estimateSendId ?? null,
      activityType: input.activityType,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
