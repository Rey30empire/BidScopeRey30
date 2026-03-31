import { db } from '@/lib/db';
import { logEstimateActivity } from '@/lib/server/event-log-service';
import { notifyEstimateOpened } from '@/lib/server/notification-service';
import type { EstimateOpenEventType } from '@/lib/estimate';

function canStoreIpAddress(): boolean {
  return (process.env.ENABLE_TRACKING_IP_ADDRESS || 'false').trim().toLowerCase() === 'true';
}

function shouldEnablePixel(): boolean {
  return (process.env.ENABLE_OPEN_TRACKING_PIXEL || 'true').trim().toLowerCase() !== 'false';
}

function normalizeIpAddress(value: string | null | undefined) {
  const first = value?.split(',')[0]?.trim() || '';
  return first.replace(/^::ffff:/, '').trim() || null;
}

function normalizeUserAgent(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function normalizeReferrer(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 500) : null;
}

function getTrackingWindowMs() {
  const seconds = Number(process.env.TRACKING_RATE_LIMIT_WINDOW_SECONDS || 60);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000;
}

function getMaxEventsPerSendWindow() {
  const value = Number(process.env.TRACKING_RATE_LIMIT_MAX_EVENTS_PER_SEND || 30);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function getDedupWindowSeconds(sourceType: 'portal' | 'pixel' | 'download') {
  const envKey =
    sourceType === 'pixel'
      ? 'TRACKING_PIXEL_DEDUP_SECONDS'
      : sourceType === 'portal'
        ? 'TRACKING_PORTAL_DEDUP_SECONDS'
        : 'TRACKING_DOWNLOAD_DEDUP_SECONDS';
  const value = Number(process.env[envKey] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function isRateLimitedBySendWindow(sendId: string) {
  const since = new Date(Date.now() - getTrackingWindowMs());
  const recentCount = await db.estimateOpenEvent.count({
    where: {
      estimateSendId: sendId,
      openedAt: { gte: since },
    },
  });

  return recentCount >= getMaxEventsPerSendWindow();
}

async function findRecentDuplicateEvent(input: {
  sendId: string;
  sourceType: 'portal' | 'pixel' | 'download';
  ipAddress?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}) {
  const dedupSeconds = getDedupWindowSeconds(input.sourceType);
  if (!dedupSeconds) {
    return null;
  }

  const since = new Date(Date.now() - dedupSeconds * 1000);
  const filters: Record<string, unknown> = {
    estimateSendId: input.sendId,
    sourceType: input.sourceType,
    openedAt: { gte: since },
  };

  if (input.userAgent) {
    filters.userAgent = input.userAgent;
  }

  if (input.referrer) {
    filters.referrer = input.referrer;
  }

  if (input.ipAddress && canStoreIpAddress()) {
    filters.ipAddress = input.ipAddress;
  }

  if (!filters.userAgent && !filters.referrer && !filters.ipAddress) {
    return null;
  }

  return db.estimateOpenEvent.findFirst({
    where: filters,
    orderBy: { openedAt: 'desc' },
  });
}

export async function resolveEstimateSendByToken(token: string) {
  const send = await db.estimateSend.findUnique({
    where: { secureToken: token },
    include: {
      estimate: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!send) {
    return null;
  }

  if (send.linkExpiresAt && send.linkExpiresAt.getTime() < Date.now()) {
    return null;
  }

  return send;
}

export async function recordEstimateOpenEvent(input: {
  token: string;
  sourceType: 'portal' | 'pixel' | 'download';
  requestMeta?: {
    ipAddress?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  };
}) {
  if (input.sourceType === 'pixel' && !shouldEnablePixel()) {
    return null;
  }

  const send = await resolveEstimateSendByToken(input.token);
  if (!send) {
    return null;
  }

  const normalizedMeta = {
    ipAddress: normalizeIpAddress(input.requestMeta?.ipAddress),
    userAgent: normalizeUserAgent(input.requestMeta?.userAgent),
    referrer: normalizeReferrer(input.requestMeta?.referrer),
  };

  if (await isRateLimitedBySendWindow(send.id)) {
    return null;
  }

  const duplicateEvent = await findRecentDuplicateEvent({
    sendId: send.id,
    sourceType: input.sourceType,
    ipAddress: normalizedMeta.ipAddress,
    userAgent: normalizedMeta.userAgent,
    referrer: normalizedMeta.referrer,
  });

  if (duplicateEvent) {
    return null;
  }

  const nextCount = send.openCount + 1;
  const isFirstOpen = nextCount === 1;
  const eventType: EstimateOpenEventType = isFirstOpen
    ? input.sourceType === 'portal'
      ? 'portal_open'
      : input.sourceType === 'download'
        ? 'download_open'
        : 'pixel_open'
    : 're_open';

  const event = await db.estimateOpenEvent.create({
    data: {
      estimateSendId: send.id,
      openedAt: new Date(),
      ipAddress: canStoreIpAddress() ? normalizedMeta.ipAddress : null,
      userAgent: normalizedMeta.userAgent,
      referrer: normalizedMeta.referrer,
      eventType,
      sourceType: input.sourceType,
      isFirstOpen,
      openCountAtEvent: nextCount,
    },
  });

  const firstOpenedAt = send.firstOpenedAt ?? event.openedAt;
  const status = nextCount > 1 ? 'Re-opened' : 'Opened';

  await db.$transaction([
    db.estimateSend.update({
      where: { id: send.id },
      data: {
        openCount: nextCount,
        firstOpenedAt,
        lastOpenedAt: event.openedAt,
        status,
      },
    }),
    db.estimate.update({
      where: { id: send.estimateId },
      data: {
        openCount: { increment: 1 },
        firstOpenedAt: send.estimate.firstOpenedAt ?? event.openedAt,
        lastOpenedAt: event.openedAt,
        status,
      },
    }),
  ]);

  await logEstimateActivity({
    estimateId: send.estimateId,
    estimateSendId: send.id,
    activityType: eventType,
    title: isFirstOpen ? 'Estimate opened' : 'Estimate re-opened',
    description:
      input.sourceType === 'pixel'
        ? 'Open inferred from tracking pixel. This may be affected by image blocking, privacy tools, or caching.'
        : input.sourceType === 'download'
          ? 'Download opened from secure delivery link.'
          : 'Secure portal view opened.',
    metadata: {
      sourceType: input.sourceType,
      openCount: nextCount,
      recipientEmail: send.recipientEmail,
      userAgent: normalizedMeta.userAgent,
    },
  });

  await notifyEstimateOpened({ estimateOpenEventId: event.id });

  return {
    send,
    event,
    openCount: nextCount,
  };
}
