import { Buffer } from 'node:buffer';
import type { Analysis, BidFile, Project } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ForecastDay, MaterialInsight, RFISuggestion, RiskItem, TimeEstimate, WeatherImpact } from '@/lib/types';
import { safeJsonParse } from '@/lib/server/json';

type ProjectReportSource = Project & {
  files: BidFile[];
  analysis: Analysis | null;
};

interface RelevantSheet {
  sheetNumber?: string;
  sheetTitle?: string;
  fileName?: string;
  reason?: string;
  confidence?: number;
}

interface ImportantDate {
  label?: string;
  date?: string;
}

interface ExecutiveSummaryPayload {
  probableScope?: string;
  keyDocuments?: string[];
  keySheets?: RelevantSheet[];
  importantDates?: ImportantDate[];
  materialsDetected?: MaterialInsight[];
  nextSteps?: string[];
  inclusions?: string[];
  exclusions?: string[];
}

interface ScopeAnalysisPayload {
  probableScope?: string;
  priorityDocs?: string[];
  keySheets?: RelevantSheet[];
  relevantSheets?: RelevantSheet[];
  keySpecs?: string[];
  risks?: Array<{ description?: string }>;
  exclusions?: string[];
  rfis?: Array<{ question?: string }>;
  inclusions?: string[];
}

export interface ProjectReport {
  projectId: string;
  projectName: string;
  client: string;
  trade: string;
  contact: string;
  email: string;
  location: string;
  bidDueDate: string;
  rfiDueDate: string;
  probableScope: string;
  totalFiles: number;
  relevantFiles: number;
  keyDocuments: string[];
  keySheets: RelevantSheet[];
  keySpecs: string[];
  materials: MaterialInsight[];
  risks: RiskItem[];
  rfis: RFISuggestion[];
  weather: WeatherImpact | null;
  timeEstimate: TimeEstimate | null;
  nextSteps: string[];
  inclusions: string[];
  exclusions: string[];
}

function formatDateValue(value: Date | string | null | undefined): string {
  if (!value) {
    return 'Not provided';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function cleanText(value: string | null | undefined, fallback = 'Not provided'): string {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function joinLocation(parts: Array<string | null | undefined>): string {
  const filtered = uniqueStrings(parts);
  return filtered.length > 0 ? filtered.join(', ') : 'Not provided';
}

function getSummaryPayload(analysis: Analysis | null): ExecutiveSummaryPayload {
  return safeJsonParse<ExecutiveSummaryPayload>(analysis?.executiveSummary, {});
}

function getScopePayload(analysis: Analysis | null): ScopeAnalysisPayload {
  return safeJsonParse<ScopeAnalysisPayload>(analysis?.scopeAnalysis, {});
}

export function buildProjectReport(project: ProjectReportSource): ProjectReport {
  const analysis = project.analysis;
  const summary = getSummaryPayload(analysis);
  const scope = getScopePayload(analysis);
  const weather = safeJsonParse<WeatherImpact | null>(analysis?.weatherImpact, null);
  const timeEstimate = safeJsonParse<TimeEstimate | null>(analysis?.timeEstimate, null);
  const materials = safeJsonParse<MaterialInsight[]>(analysis?.materials, summary.materialsDetected ?? []);
  const risks = safeJsonParse<RiskItem[]>(analysis?.riskItems, []);
  const rfis = safeJsonParse<RFISuggestion[]>(analysis?.rfiSuggestions, []);
  const relevantSheets = safeJsonParse<RelevantSheet[]>(
    analysis?.relevantSheets,
    summary.keySheets ?? scope.relevantSheets ?? scope.keySheets ?? [],
  );

  return {
    projectId: project.id,
    projectName: cleanText(analysis?.projectName || project.name),
    client: cleanText(analysis?.client || project.client),
    trade: cleanText(analysis?.trade || project.trade),
    contact: cleanText(analysis?.contact),
    email: cleanText(analysis?.email),
    location: joinLocation([
      analysis?.address || project.address,
      analysis?.city || project.city,
      analysis?.state || project.state,
      analysis?.zipCode || project.zip,
    ]),
    bidDueDate: formatDateValue(analysis?.bidDueDate || project.bidDueDate),
    rfiDueDate: formatDateValue(analysis?.rfiDueDate || project.rfiDueDate),
    probableScope: cleanText(summary.probableScope || scope.probableScope),
    totalFiles: project.files.length,
    relevantFiles: project.files.filter((file) => file.isRelevant).length,
    keyDocuments: uniqueStrings([
      ...(summary.keyDocuments ?? []),
      ...(scope.priorityDocs ?? []),
      ...project.files
        .filter((file) => file.isRelevant)
        .sort((left, right) => (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0))
        .slice(0, 8)
        .map((file) => file.originalName),
    ]),
    keySheets: relevantSheets,
    keySpecs: uniqueStrings([
      ...(scope.keySpecs ?? []),
      ...safeJsonParse<string[]>(analysis?.keySpecs, []),
    ]),
    materials,
    risks,
    rfis,
    weather,
    timeEstimate,
    nextSteps: uniqueStrings(summary.nextSteps ?? []),
    inclusions: uniqueStrings([
      ...(summary.inclusions ?? []),
      ...(scope.inclusions ?? []),
      ...safeJsonParse<string[]>(analysis?.inclusions, []),
    ]),
    exclusions: uniqueStrings([
      ...(summary.exclusions ?? []),
      ...(scope.exclusions ?? []),
      ...safeJsonParse<string[]>(analysis?.exclusions, []),
    ]),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return '<p style="margin:0;color:#526071;">Not available</p>';
  }

  return `<ul style="margin:8px 0 0 18px;padding:0;">${items
    .map((item) => `<li style="margin:0 0 6px 0;">${escapeHtml(item)}</li>`)
    .join('')}</ul>`;
}

export function buildProjectReportHtml(report: ProjectReport): string {
  const sheetItems = report.keySheets.map((sheet) =>
    [sheet.sheetNumber, sheet.sheetTitle, sheet.reason].filter(Boolean).join(' - '),
  );

  const materialItems = report.materials.map((material) =>
    [
      material.name,
      material.category ? `(${material.category})` : null,
      material.estimatedQty !== undefined ? `${material.estimatedQty}${material.unit ? ` ${material.unit}` : ''}` : null,
    ]
      .filter(Boolean)
      .join(' '),
  );

  const riskItems = report.risks.map((risk) =>
    [risk.description, risk.severity ? `[${risk.severity}]` : null, risk.mitigation ? `Mitigation: ${risk.mitigation}` : null]
      .filter(Boolean)
      .join(' '),
  );

  const rfiItems = report.rfis.map((rfi) =>
    [rfi.question, rfi.priority ? `[${rfi.priority}]` : null, rfi.reason ? `Reason: ${rfi.reason}` : null]
      .filter(Boolean)
      .join(' '),
  );

  const forecastItems =
    report.weather?.forecastDays.map(
      (day: ForecastDay) =>
        `${day.date}: ${day.conditions}, high ${day.high}, low ${day.low}, rain ${day.precipitation}%`,
    ) ?? [];

  return `
    <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;color:#15202b;">
      <div style="max-width:800px;margin:0 auto;background:#ffffff;border:1px solid #d8e1ec;border-radius:18px;overflow:hidden;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#12324a,#0f5d8c);color:#ffffff;">
          <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">BitScopeRey30 Estimate Brief</p>
          <h1 style="margin:0;font-size:28px;line-height:1.15;">${escapeHtml(report.projectName)}</h1>
          <p style="margin:10px 0 0 0;font-size:15px;opacity:0.9;">${escapeHtml(report.probableScope)}</p>
        </div>
        <div style="padding:24px 32px;">
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;margin-bottom:24px;">
            <p style="margin:0;"><strong>Client:</strong> ${escapeHtml(report.client)}</p>
            <p style="margin:0;"><strong>Trade:</strong> ${escapeHtml(report.trade)}</p>
            <p style="margin:0;"><strong>Bid Due:</strong> ${escapeHtml(report.bidDueDate)}</p>
            <p style="margin:0;"><strong>RFI Due:</strong> ${escapeHtml(report.rfiDueDate)}</p>
            <p style="margin:0;"><strong>Location:</strong> ${escapeHtml(report.location)}</p>
            <p style="margin:0;"><strong>Relevant Files:</strong> ${report.relevantFiles} of ${report.totalFiles}</p>
          </div>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Key Documents</h2>
            ${renderList(report.keyDocuments)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Key Sheets</h2>
            ${renderList(sheetItems)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Materials</h2>
            ${renderList(materialItems)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Risks</h2>
            ${renderList(riskItems)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Suggested RFIs</h2>
            ${renderList(rfiItems)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Time Estimate</h2>
            <p style="margin:0;color:#15202b;">
              ${
                report.timeEstimate
                  ? `${report.timeEstimate.totalHours} hours, ${report.timeEstimate.totalDays} days, crew ${report.timeEstimate.crewSize}.`
                  : 'Not available.'
              }
            </p>
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Weather Impact</h2>
            <p style="margin:0 0 10px 0;color:#15202b;">${escapeHtml(report.weather?.impactSummary || 'Not available.')}</p>
            ${renderList(forecastItems)}
          </section>

          <section style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Inclusions</h2>
            ${renderList(report.inclusions)}
          </section>

          <section style="margin-bottom:0;">
            <h2 style="margin:0 0 8px 0;font-size:18px;color:#12324a;">Exclusions & Next Steps</h2>
            ${renderList([...report.exclusions, ...report.nextSteps])}
          </section>
        </div>
      </div>
    </div>
  `.trim();
}

export function buildProjectReportText(report: ProjectReport): string {
  const lines: string[] = [
    `BitScopeRey30 Estimate Brief`,
    `Project: ${report.projectName}`,
    `Client: ${report.client}`,
    `Trade: ${report.trade}`,
    `Location: ${report.location}`,
    `Bid Due: ${report.bidDueDate}`,
    `RFI Due: ${report.rfiDueDate}`,
    `Probable Scope: ${report.probableScope}`,
    `Files: ${report.relevantFiles}/${report.totalFiles} relevant`,
    '',
    'Key Documents:',
    ...(report.keyDocuments.length > 0 ? report.keyDocuments.map((item) => `- ${item}`) : ['- Not available']),
    '',
    'Key Sheets:',
    ...(report.keySheets.length > 0
      ? report.keySheets.map((sheet) => `- ${[sheet.sheetNumber, sheet.sheetTitle, sheet.reason].filter(Boolean).join(' - ')}`)
      : ['- Not available']),
    '',
    'Materials:',
    ...(report.materials.length > 0
      ? report.materials.map((material) =>
          `- ${[material.name, material.category ? `(${material.category})` : null].filter(Boolean).join(' ')}${
            material.estimatedQty !== undefined ? ` - ${material.estimatedQty}${material.unit ? ` ${material.unit}` : ''}` : ''
          }`,
        )
      : ['- Not available']),
    '',
    'Risks:',
    ...(report.risks.length > 0
      ? report.risks.map((risk) => `- ${risk.description}${risk.severity ? ` [${risk.severity}]` : ''}`)
      : ['- Not available']),
    '',
    'Suggested RFIs:',
    ...(report.rfis.length > 0
      ? report.rfis.map((rfi) => `- ${rfi.question}${rfi.priority ? ` [${rfi.priority}]` : ''}`)
      : ['- Not available']),
    '',
    'Time Estimate:',
    report.timeEstimate
      ? `- ${report.timeEstimate.totalHours} hours, ${report.timeEstimate.totalDays} days, crew ${report.timeEstimate.crewSize}`
      : '- Not available',
    '',
    'Weather Impact:',
    `- ${report.weather?.impactSummary || 'Not available'}`,
    '',
    'Next Steps:',
    ...([...report.nextSteps, ...report.exclusions].length > 0
      ? [...report.nextSteps, ...report.exclusions].map((item) => `- ${item}`)
      : ['- Not available']),
  ];

  return lines.join('\n');
}

function csvCell(value: string | number): string {
  const normalized = String(value).replaceAll('"', '""');
  return `"${normalized}"`;
}

export function buildProjectReportCsv(report: ProjectReport): string {
  const rows: Array<[string, string, string | number]> = [
    ['Project', 'Name', report.projectName],
    ['Project', 'Client', report.client],
    ['Project', 'Trade', report.trade],
    ['Project', 'Location', report.location],
    ['Project', 'Bid Due Date', report.bidDueDate],
    ['Project', 'RFI Due Date', report.rfiDueDate],
    ['Project', 'Probable Scope', report.probableScope],
    ['Files', 'Total', report.totalFiles],
    ['Files', 'Relevant', report.relevantFiles],
  ];

  for (const document of report.keyDocuments) {
    rows.push(['Document', 'Key Document', document]);
  }

  for (const sheet of report.keySheets) {
    rows.push(['Sheet', sheet.sheetNumber || 'Sheet', [sheet.sheetTitle, sheet.reason].filter(Boolean).join(' - ')]);
  }

  for (const material of report.materials) {
    rows.push([
      'Material',
      material.name,
      [material.category, material.estimatedQty !== undefined ? `${material.estimatedQty}${material.unit ? ` ${material.unit}` : ''}` : null]
        .filter(Boolean)
        .join(' - '),
    ]);
  }

  for (const risk of report.risks) {
    rows.push(['Risk', risk.description, [risk.severity, risk.likelihood].filter(Boolean).join(' - ')]);
  }

  for (const rfi of report.rfis) {
    rows.push(['RFI', rfi.question, rfi.priority || '']);
  }

  return [
    ['Category', 'Item', 'Value'].map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [''];
  }

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] ?? '';

  for (const word of words.slice(1)) {
    const candidate = `${currentLine} ${word}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}

export async function buildProjectReportPdf(report: ProjectReport): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  const textSize = 10;
  const lineHeight = 14;
  let page = pdf.addPage(pageSize);
  let cursorY = page.getHeight() - margin;

  const ensureSpace = (linesNeeded = 1) => {
    if (cursorY - linesNeeded * lineHeight < margin) {
      page = pdf.addPage(pageSize);
      cursorY = page.getHeight() - margin;
    }
  };

  const drawWrapped = (text: string, font: PDFFont, fontSize: number, color = rgb(0.1, 0.15, 0.2)) => {
    const lines = wrapText(text, font, fontSize, contentWidth);
    ensureSpace(lines.length);
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y: cursorY,
        size: fontSize,
        font,
        color,
      });
      cursorY -= lineHeight;
    }
  };

  const drawSection = (title: string, items: string[]) => {
    cursorY -= 6;
    drawWrapped(title, bold, 13, rgb(0.07, 0.2, 0.29));
    if (items.length === 0) {
      drawWrapped('- Not available', regular, textSize);
      return;
    }
    for (const item of items) {
      drawWrapped(`- ${item}`, regular, textSize);
    }
  };

  drawWrapped('BitScopeRey30 Estimate Brief', bold, 18, rgb(0.05, 0.22, 0.34));
  drawWrapped(report.projectName, bold, 14, rgb(0.08, 0.36, 0.55));
  cursorY -= 4;

  for (const item of [
    `Client: ${report.client}`,
    `Trade: ${report.trade}`,
    `Location: ${report.location}`,
    `Bid Due: ${report.bidDueDate}`,
    `RFI Due: ${report.rfiDueDate}`,
    `Probable Scope: ${report.probableScope}`,
    `Relevant Files: ${report.relevantFiles} of ${report.totalFiles}`,
  ]) {
    drawWrapped(item, regular, textSize);
  }

  drawSection('Key Documents', report.keyDocuments);
  drawSection(
    'Key Sheets',
    report.keySheets.map((sheet) => [sheet.sheetNumber, sheet.sheetTitle, sheet.reason].filter(Boolean).join(' - ')),
  );
  drawSection(
    'Materials',
    report.materials.map((material) =>
      [
        material.name,
        material.category ? `(${material.category})` : null,
        material.estimatedQty !== undefined ? `${material.estimatedQty}${material.unit ? ` ${material.unit}` : ''}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );
  drawSection(
    'Risks',
    report.risks.map((risk) => [risk.description, risk.severity ? `[${risk.severity}]` : null].filter(Boolean).join(' ')),
  );
  drawSection(
    'Suggested RFIs',
    report.rfis.map((rfi) => [rfi.question, rfi.priority ? `[${rfi.priority}]` : null].filter(Boolean).join(' ')),
  );
  drawSection(
    'Time Estimate',
    report.timeEstimate
      ? [`${report.timeEstimate.totalHours} hours, ${report.timeEstimate.totalDays} days, crew ${report.timeEstimate.crewSize}`]
      : [],
  );
  drawSection(
    'Weather Impact',
    [
      report.weather?.impactSummary || 'Not available',
      ...(report.weather?.forecastDays.map(
        (day) => `${day.date}: ${day.conditions}, high ${day.high}, low ${day.low}, rain ${day.precipitation}%`,
      ) ?? []),
    ],
  );
  drawSection('Next Steps', [...report.nextSteps, ...report.exclusions]);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
