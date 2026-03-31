import { db } from '@/lib/db';
import { resolveAppBaseUrl } from '@/lib/server/app-base-url';
import { buildEstimateDeliveryNotificationSubject } from '@/lib/server/estimate-prompts';
import { sendEstimateEmail } from '@/lib/server/email';
import { logEstimateActivity } from '@/lib/server/event-log-service';

function getNotificationRecipient(): string {
  return (
    process.env.ESTIMATE_NOTIFICATION_EMAIL?.trim() ||
    process.env.ESTIMATE_TEST_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ||
    process.env.EMAIL_FROM?.trim() ||
    'rey30empire@gmail.com'
  );
}

export async function notifyEstimateOpened(input: {
  estimateOpenEventId: string;
}) {
  const event = await db.estimateOpenEvent.findUnique({
    where: { id: input.estimateOpenEventId },
    include: {
      estimateSend: {
        include: {
          estimate: {
            include: {
              project: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error('Estimate open event not found.');
  }

  const estimate = event.estimateSend.estimate;
  const project = estimate.project;
  const recipient = getNotificationRecipient();
  const baseUrl = resolveAppBaseUrl({
    fallbackAbsoluteUrl: event.estimateSend.secureViewUrl || event.estimateSend.secureDownloadUrl,
  })?.url || 'http://localhost:3000';
  const detailsUrl = `${baseUrl}/?project=${project.id}&estimate=${estimate.id}`;
  const sourceLabel = event.eventType === 're_open'
    ? `re_open via ${event.sourceType ?? 'unknown'}`
    : event.eventType;

  const limitationsNote =
    event.sourceType === 'pixel' || event.eventType === 'pixel_open'
      ? 'This open was inferred from an email tracking pixel and may be affected by image blocking, privacy features, or caching.'
      : 'This open was recorded from a direct portal view or tracked download link.';

  const subject = buildEstimateDeliveryNotificationSubject(project.name, estimate.estimateNumber);
  const text = [
    `Estimate #: ${estimate.estimateNumber}`,
    `Project: ${project.name}`,
    `Recipient: ${event.estimateSend.recipientEmail}`,
    `Type: ${estimate.estimateType}`,
    `Opened at: ${event.openedAt.toISOString()}`,
    `Open count: ${event.openCountAtEvent}`,
    `Event type: ${sourceLabel}`,
    `Sent by: ${event.estimateSend.sentByEmail || event.estimateSend.sentByName || 'Not recorded'}`,
    `View event details: ${detailsUrl}`,
    '',
    limitationsNote,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#15202b;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d8e1ec;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#12324a,#0f5d8c);color:#ffffff;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Estimate Activity</p>
          <h1 style="margin:0;font-size:24px;line-height:1.2;">Estimate opened</h1>
          <p style="margin:10px 0 0 0;font-size:15px;opacity:0.92;">${estimate.estimateNumber} · ${project.name}</p>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 10px 0;"><strong>Estimate #:</strong> ${estimate.estimateNumber}</p>
          <p style="margin:0 0 10px 0;"><strong>Project:</strong> ${project.name}</p>
          <p style="margin:0 0 10px 0;"><strong>Recipient:</strong> ${event.estimateSend.recipientEmail}</p>
          <p style="margin:0 0 10px 0;"><strong>Type:</strong> ${estimate.estimateType}</p>
          <p style="margin:0 0 10px 0;"><strong>Opened at:</strong> ${event.openedAt.toISOString()}</p>
          <p style="margin:0 0 10px 0;"><strong>Open count:</strong> ${event.openCountAtEvent}</p>
          <p style="margin:0 0 10px 0;"><strong>Event type:</strong> ${sourceLabel}</p>
          <p style="margin:0 0 18px 0;"><strong>Sent by:</strong> ${event.estimateSend.sentByEmail || event.estimateSend.sentByName || 'Not recorded'}</p>
          <p style="margin:0 0 18px 0;color:#526071;">${limitationsNote}</p>
          <a href="${detailsUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#12324a;color:#ffffff;text-decoration:none;font-weight:700;">View event details</a>
        </div>
      </div>
    </div>
  `.trim();

  const emailResult = await sendEstimateEmail({
    to: recipient,
    subject,
    html,
    text,
  });

  await db.estimateNotificationEvent.create({
    data: {
      estimateSendId: event.estimateSendId,
      estimateOpenEventId: event.id,
      recipientInternalEmail: recipient,
      deliveryStatus: 'sent',
      providerMessageId: emailResult.id,
    },
  });

  await logEstimateActivity({
    estimateId: estimate.id,
    estimateSendId: event.estimateSendId,
    activityType: 'notification_sent',
    title: 'Open notification sent',
    description: `Open notification emailed to ${recipient} for ${sourceLabel}.`,
    metadata: {
      recipientInternalEmail: recipient,
      eventType: event.eventType,
      sourceType: event.sourceType,
      providerMessageId: emailResult.id,
      openCount: event.openCountAtEvent,
    },
  });

  return emailResult;
}
