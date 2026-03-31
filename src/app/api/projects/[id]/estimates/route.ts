import { NextRequest, NextResponse } from 'next/server';
import { ensureProjectEstimates, regenerateEstimateDraft } from '@/lib/server/estimate-service';
import { decorateEstimateWithClientPreflight } from '@/lib/server/estimate-preflight-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  ) {
  try {
    const { id } = await params;
    const project = await ensureProjectEstimates(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(
      project.estimates.map((estimate) => decorateEstimateWithClientPreflight(estimate, project)),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load estimates' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  ) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { estimateType?: 'trade' | 'global' };
    const project = await regenerateEstimateDraft(id, body.estimateType);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(
      project.estimates.map((estimate) => decorateEstimateWithClientPreflight(estimate, project)),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate estimates' },
      { status: 500 },
    );
  }
}
