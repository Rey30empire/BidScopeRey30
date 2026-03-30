import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/projects - List all projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        files: { orderBy: { createdAt: 'desc' } },
        analysis: true,
      },
    });
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

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name,
        client: client || null,
        location: location || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        projectSize: projectSize || null,
        trade: trade || null,
        bidDueDate: bidDueDate ? new Date(bidDueDate) : null,
        rfiDueDate: rfiDueDate ? new Date(rfiDueDate) : null,
        notes: notes || null,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
