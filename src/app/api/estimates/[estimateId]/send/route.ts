import { NextRequest, NextResponse } from 'next/server';
import type { EstimateDocumentVersion } from '@/lib/estimate';
import { getRequestOrigin } from '@/lib/server/app-base-url';
import { EstimateWorkflowValidationError } from '@/lib/server/estimate-preflight-service';
import { sendEstimateWorkflow } from '@/lib/server/send-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
  ) {
  try {
    const { estimateId } = await params;
    const body = (await request.json()) as {
      recipientEmail: string;
      recipientName?: string;
      documentVersion: EstimateDocumentVersion;
      sentByName?: string;
      sentByEmail?: string;
    };

    const result = await sendEstimateWorkflow({
      estimateId,
      documentVersion: body.documentVersion,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      sentByName: body.sentByName,
      sentByEmail: body.sentByEmail,
      requestOrigin: getRequestOrigin(request),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EstimateWorkflowValidationError) {
      return NextResponse.json(
        { error: error.message, preflight: error.preflight ?? null },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send estimate' },
      { status: 500 },
    );
  }
}
