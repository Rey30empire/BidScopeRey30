import { NextRequest, NextResponse } from 'next/server';
import {
  isDocumentVersionAllowedForEstimate,
  type EstimateDocumentVersion,
} from '@/lib/estimate';
import { db } from '@/lib/db';
import { buildEstimatePdf } from '@/lib/server/estimate-document-service';
import {
  ensureEstimateCanExport,
  EstimateWorkflowValidationError,
} from '@/lib/server/estimate-preflight-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { estimateId } = await params;
    const { searchParams } = new URL(request.url);
    const documentVersion = (searchParams.get('documentVersion') || 'client_trade') as EstimateDocumentVersion;

    const estimate = await db.estimate.findUnique({
      where: { id: estimateId },
      include: { project: true },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    if (!isDocumentVersionAllowedForEstimate(estimate.estimateType as 'trade' | 'global', documentVersion)) {
      return NextResponse.json(
        { error: 'The selected document version does not match this estimate type.' },
        { status: 400 },
      );
    }

    ensureEstimateCanExport({ project: estimate.project, estimate }, documentVersion);

    const pdf = await buildEstimatePdf({ project: estimate.project, estimate }, documentVersion);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${estimate.title.replace(/[^a-zA-Z0-9]/g, '_')}_${documentVersion}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof EstimateWorkflowValidationError) {
      return NextResponse.json(
        { error: error.message, preflight: error.preflight ?? null },
        { status: error.statusCode },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export estimate' },
      { status: 500 },
    );
  }
}
