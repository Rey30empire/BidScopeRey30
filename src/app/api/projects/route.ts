import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { listProjectsWithFilesAndAnalysis } from '@/lib/server/project-query-service';

function buildDraftProjectName(name?: string | null) {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }

  const stamp = new Date()
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');

  return `Bid Intake ${stamp}`;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await listProjectsWithFilesAndAnalysis();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, client, location, address, city, state, zip, projectSize, trade, bidDueDate, rfiDueDate, notes } = body;

    const project = await db.project.create({
      data: {
        name: buildDraftProjectName(name),
        client: client || null,
        location: location || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        projectSize: projectSize || null,
        trade: trade || null,
        bidDueDate: parseOptionalDate(bidDueDate),
        rfiDueDate: parseOptionalDate(rfiDueDate),
        notes: notes || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
