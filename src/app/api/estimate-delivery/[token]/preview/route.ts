import { NextResponse } from 'next/server';
import { buildEstimatePdf } from '@/lib/server/estimate-document-service';
import { resolveEstimateSendByToken } from '@/lib/server/open-tracking-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const send = await resolveEstimateSendByToken(token);

  if (!send) {
    return NextResponse.json({ error: 'Secure estimate link is invalid or expired.' }, { status: 404 });
  }

  const pdf = await buildEstimatePdf(
    { project: send.estimate.project, estimate: send.estimate },
    send.documentVersion as 'client_trade' | 'client_global' | 'internal_review',
    send.secureViewUrl || undefined,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${send.estimate.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, no-store',
    },
  });
}
