import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProjectWithFilesAndAnalysis } from '@/lib/server/project-query-service';
import { deleteProjectDeep } from '@/lib/server/project-delete-service';

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toAnalysisDateString(value: string | null | undefined) {
  const parsed = parseOptionalDate(value);
  return parsed ? parsed.toISOString() : null;
}

// GET /api/projects/[id] - Get project with files and analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectWithFilesAndAnalysis(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const projectData = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.client !== undefined && { client: body.client }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.zip !== undefined && { zip: body.zip }),
      ...(body.projectSize !== undefined && { projectSize: body.projectSize }),
      ...(body.trade !== undefined && { trade: body.trade }),
      ...(body.bidDueDate !== undefined && { bidDueDate: parseOptionalDate(body.bidDueDate) }),
      ...(body.rfiDueDate !== undefined && { rfiDueDate: parseOptionalDate(body.rfiDueDate) }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.status !== undefined && { status: body.status }),
    };

    const analysisData = {
      ...(body.name !== undefined && { projectName: body.name || null }),
      ...(body.client !== undefined && { client: body.client || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.city !== undefined && { city: body.city || null }),
      ...(body.state !== undefined && { state: body.state || null }),
      ...(body.zip !== undefined && { zipCode: body.zip || null }),
      ...(body.trade !== undefined && { trade: body.trade || null }),
      ...(body.bidDueDate !== undefined && { bidDueDate: toAnalysisDateString(body.bidDueDate) }),
      ...(body.rfiDueDate !== undefined && { rfiDueDate: toAnalysisDateString(body.rfiDueDate) }),
    };

    const project = await db.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id },
        data: projectData,
      });

      if (Object.keys(analysisData).length > 0) {
        await tx.analysis.update({
          where: { projectId: id },
          data: analysisData,
        }).catch(() => undefined);
      }

      return updatedProject;
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteProjectDeep(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
