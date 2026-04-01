import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getEmailConfigurationError, sendEstimateEmail } from '@/lib/server/email';
import {
  buildProjectReport,
  buildProjectReportHtml,
  buildProjectReportPdf,
  buildProjectReportText,
} from '@/lib/server/report';
import { getProjectWithFilesAndAnalysis } from '@/lib/server/project-query-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const body = (await request.json().catch(() => ({}))) as { to?: string };
    const recipient =
      body.to?.trim() ||
      process.env.ESTIMATE_TEST_EMAIL?.trim() ||
      'rey30empire@gmail.com';

    const configError = getEmailConfigurationError();
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    const project = await getProjectWithFilesAndAnalysis(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.analysis) {
      return NextResponse.json({ error: 'Run the analysis before emailing an estimate brief.' }, { status: 400 });
    }

    const report = buildProjectReport(project);
    const pdf = await buildProjectReportPdf(report);
    const emailResult = await sendEstimateEmail({
      to: recipient,
      subject: `BitScopeRey30 estimate brief - ${report.projectName}`,
      html: buildProjectReportHtml(report),
      text: buildProjectReportText(report),
      attachments: [
        {
          filename: `${report.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_estimate_brief.pdf`,
          contentBase64: Buffer.from(pdf).toString('base64'),
        },
      ],
    });

    return NextResponse.json({
      success: true,
      emailId: emailResult.id,
      provider: emailResult.provider,
      to: recipient,
    });
  } catch (error) {
    console.error('Error sending estimate email:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send estimate email',
      },
      { status: 500 },
    );
  }
}
