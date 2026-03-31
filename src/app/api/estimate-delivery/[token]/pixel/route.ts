import { NextRequest, NextResponse } from 'next/server';
import { recordEstimateOpenEvent, resolveEstimateSendByToken } from '@/lib/server/open-tracking-service';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'base64',
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const send = await resolveEstimateSendByToken(token);

  if (send) {
    await recordEstimateOpenEvent({
      token,
      sourceType: 'pixel',
      requestMeta: {
        ipAddress: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer'),
      },
    });
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
      'Content-Length': String(PIXEL.length),
    },
  });
}
