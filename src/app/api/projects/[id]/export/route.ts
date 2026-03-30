import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  buildProjectReport,
  buildProjectReportCsv,
  buildProjectReportPdf,
} from '@/lib/server/report';

// GET /api/projects/[id]/export - Export analysis results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { files: true, analysis: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (format === 'json') {
      return NextResponse.json(project, {
        headers: {
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_bid_analysis.json"`,
        },
      });
    }

    const report = buildProjectReport(project);

    if (format === 'csv') {
      const csv = buildProjectReportCsv(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_bid_analysis.csv"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdf = await buildProjectReportPdf(report);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_bid_analysis.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
