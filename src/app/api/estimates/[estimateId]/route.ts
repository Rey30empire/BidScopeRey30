import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logEstimateActivity } from '@/lib/server/event-log-service';
import { decorateEstimateWithClientPreflight } from '@/lib/server/estimate-preflight-service';

function toJsonList(value: unknown) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value === null || value === undefined ? null : JSON.stringify([]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { estimateId } = await params;
    const estimate = await db.estimate.findUnique({
      where: { id: estimateId },
      include: {
        sends: {
          orderBy: { sentAt: 'desc' },
          include: {
            openEvents: { orderBy: { openedAt: 'desc' } },
            notificationEvents: { orderBy: { notifiedAt: 'desc' } },
          },
        },
        activity: {
          orderBy: { createdAt: 'desc' },
        },
        project: true,
      },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    return NextResponse.json(decorateEstimateWithClientPreflight(estimate, estimate.project));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch estimate' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  try {
    const { estimateId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const nextStatus = typeof body.status === 'string' ? body.status.trim() : undefined;
    const approveClientExport = typeof body.humanApprovedForClientExport === 'boolean'
      ? body.humanApprovedForClientExport
      : undefined;
    const approveSend = typeof body.humanApprovedForSend === 'boolean'
      ? body.humanApprovedForSend
      : undefined;

    const data = {
      ...(typeof body.title === 'string' && { title: body.title.trim() }),
      ...(nextStatus && { status: nextStatus }),
      ...(typeof body.preparedBy === 'string' && { preparedBy: body.preparedBy.trim() || null }),
      ...(typeof body.preparedByTitle === 'string' && { preparedByTitle: body.preparedByTitle.trim() || null }),
      ...(typeof body.reviewedBy === 'string' && { reviewedBy: body.reviewedBy.trim() || null }),
      ...(typeof body.reviewedByTitle === 'string' && { reviewedByTitle: body.reviewedByTitle.trim() || null }),
      ...(typeof body.clientRecipientName === 'string' && { clientRecipientName: body.clientRecipientName.trim() || null }),
      ...(typeof body.clientRecipientEmail === 'string' && { clientRecipientEmail: body.clientRecipientEmail.trim() || null }),
      ...(typeof body.companyName === 'string' && { companyName: body.companyName.trim() || null }),
      ...(typeof body.companyEmail === 'string' && { companyEmail: body.companyEmail.trim() || null }),
      ...(typeof body.companyPhone === 'string' && { companyPhone: body.companyPhone.trim() || null }),
      ...(typeof body.companyAddress === 'string' && { companyAddress: body.companyAddress.trim() || null }),
      ...(typeof body.executiveSummary === 'string' && { executiveSummary: body.executiveSummary.trim() || null }),
      ...(typeof body.scopeOfWork === 'string' && { scopeOfWork: body.scopeOfWork.trim() || null }),
      ...(Array.isArray(body.inclusions) && { inclusions: toJsonList(body.inclusions) }),
      ...(Array.isArray(body.exclusions) && { exclusions: toJsonList(body.exclusions) }),
      ...(Array.isArray(body.clarifications) && { clarifications: toJsonList(body.clarifications) }),
      ...(Array.isArray(body.qualifications) && { qualifications: toJsonList(body.qualifications) }),
      ...(Array.isArray(body.proposalNotes) && { proposalNotes: toJsonList(body.proposalNotes) }),
      ...(Array.isArray(body.keyDocuments) && { keyDocuments: toJsonList(body.keyDocuments) }),
      ...(Array.isArray(body.keyPlansAndSpecs) && { keyPlansAndSpecs: toJsonList(body.keyPlansAndSpecs) }),
      ...(Array.isArray(body.costItems) && { costItems: toJsonList(body.costItems) }),
      ...(
        body.pricingSummary && typeof body.pricingSummary === 'object'
          ? { pricingSummary: JSON.stringify(body.pricingSummary) }
          : {}
      ),
      ...(Array.isArray(body.internalAssumptions) && { internalAssumptions: toJsonList(body.internalAssumptions) }),
      ...(Array.isArray(body.internalInferredData) && { internalInferredData: toJsonList(body.internalInferredData) }),
      ...(Array.isArray(body.internalTechnicalBacking) && { internalTechnicalBacking: toJsonList(body.internalTechnicalBacking) }),
      ...(Array.isArray(body.internalAnalysisNotes) && { internalAnalysisNotes: toJsonList(body.internalAnalysisNotes) }),
      ...(Array.isArray(body.internalReviewComments) && { internalReviewComments: toJsonList(body.internalReviewComments) }),
      ...(Array.isArray(body.riskRegister) && { riskRegister: toJsonList(body.riskRegister) }),
      ...(Array.isArray(body.rfiRegister) && { rfiRegister: toJsonList(body.rfiRegister) }),
      ...(Array.isArray(body.weatherNotes) && { weatherNotes: toJsonList(body.weatherNotes) }),
      ...(Array.isArray(body.timeEstimateNotes) && { timeEstimateNotes: toJsonList(body.timeEstimateNotes) }),
      ...(typeof body.clientDisclaimer === 'string' && { clientDisclaimer: body.clientDisclaimer.trim() || null }),
      ...(typeof body.internalDisclaimer === 'string' && { internalDisclaimer: body.internalDisclaimer.trim() || null }),
      ...(typeof body.validForDays === 'number' && { validForDays: body.validForDays }),
      ...(typeof body.acceptanceEnabled === 'boolean' && { acceptanceEnabled: body.acceptanceEnabled }),
      ...(approveClientExport !== undefined && {
        humanApprovedForClientExport: approveClientExport,
        approvedForClientExportAt: approveClientExport ? new Date() : null,
      }),
      ...(approveSend !== undefined && {
        humanApprovedForSend: approveSend,
        approvedForSendAt: approveSend ? new Date() : null,
      }),
    };

    const estimate = await db.estimate.update({
      where: { id: estimateId },
      data,
      include: {
        sends: {
          orderBy: { sentAt: 'desc' },
          include: {
            openEvents: { orderBy: { openedAt: 'desc' } },
            notificationEvents: { orderBy: { notifiedAt: 'desc' } },
          },
        },
        activity: {
          orderBy: { createdAt: 'desc' },
        },
        project: true,
      },
    });

    await logEstimateActivity({
      estimateId,
      activityType: 'status_changed',
      title: 'Estimate updated',
      description: 'Estimate fields or approval gates were updated.',
      metadata: {
        status: estimate.status,
        humanApprovedForClientExport: estimate.humanApprovedForClientExport,
        humanApprovedForSend: estimate.humanApprovedForSend,
      },
    });

    return NextResponse.json(decorateEstimateWithClientPreflight(estimate, estimate.project));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update estimate' },
      { status: 500 },
    );
  }
}
