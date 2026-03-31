import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { db } from '@/lib/db';
import {
  buildBatchClassificationPrompt,
  buildBatchMetadataExtractionPrompt,
  buildClassificationPrompt,
  buildExecutiveSummaryPrompt,
  buildScopeAnalysisPrompt,
  buildTimeEstimatePrompt,
} from '@/lib/prompts';
import { TRADE_OPTIONS } from '@/lib/constants';
import { generateJson, isOpenAIConfigured } from '@/lib/server/openai';
import {
  extractHeuristicMetadataFromDocuments,
  type ExtractedMetadata,
} from '@/lib/server/project-metadata-extraction';
import { getWeatherImpact } from '@/lib/server/weather';
import type {
  ExecutiveSummary,
  MaterialInsight,
  RFISuggestion,
  RiskItem,
  TimeEstimate,
  WeatherImpact,
} from '@/lib/types';

type ClassificationResult = {
  category?: string;
  confidence?: number;
  summary?: string;
  keywords?: string[];
  relevantToTrade?: boolean;
  reason?: string;
  sheetReferences?: Array<{ number?: string; title?: string }>;
};

type ScopeAnalysisResult = {
  probableScope?: string;
  confidence?: number;
  priorityDocs?: string[];
  keySheets?: Array<{ number?: string; title?: string; relevance?: string; elements?: string[]; confidence?: number }>;
  keySpecs?: string[];
  inclusions?: string[];
  exclusions?: string[];
  risks?: RiskItem[];
  rfis?: RFISuggestion[];
  alternates?: Array<Record<string, unknown>>;
  allowances?: Array<Record<string, unknown>>;
  materials?: MaterialInsight[];
  scheduleConstraints?: string[];
  insuranceReqs?: string[];
  proposalReqs?: string[];
  assumptions?: string[];
};

type ExecutiveSummaryResult = Partial<ExecutiveSummary> & {
  weatherImpact?: WeatherImpact;
};

type FileExcerpt = {
  fileId: string;
  fileName: string;
  text: string;
  fileType: string;
};

type BatchClassificationResponse = {
  documents?: Array<ClassificationResult & { fileId?: string }>;
};

const ANALYSIS_PROGRESS = {
  extracting: { progress: 15, message: 'Reading uploaded documents...' },
  classifying: { progress: 38, message: 'Classifying the bid package...' },
  analyzing_scope: { progress: 62, message: 'Building the trade scope analysis...' },
  analyzing_weather: { progress: 74, message: 'Checking weather and site conditions...' },
  estimating_time: { progress: 86, message: 'Estimating labor and durations...' },
  generating_summary: { progress: 94, message: 'Generating the estimator summary...' },
  complete: { progress: 100, message: 'Analysis complete.' },
  error: { progress: 100, message: 'Analysis failed.' },
} as const;

const PDF_WORKER_SRC = pathToFileURL(
  join(process.cwd(), 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'web', 'pdf.worker.mjs')
).href;

async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    if (fileType === 'pdf') {
      const { PDFParse } = await import('pdf-parse');
      const buffer = await readFile(filePath);
      PDFParse.setWorker(PDF_WORKER_SRC);
      const parser = new PDFParse({ data: buffer });

      try {
        const data = await parser.getText();
        return data.text || '';
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }

    if (fileType === 'text') {
      return await readFile(filePath, 'utf-8');
    }

    if (fileType === 'docx') {
      const mammoth = await import('mammoth');
      const buffer = await readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    }

    if (fileType === 'spreadsheet') {
      const XLSX = await import('xlsx');
      const buffer = await readFile(filePath);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `--- Sheet: ${sheetName} ---\n`;
        text += XLSX.utils.sheet_to_csv(sheet);
        text += '\n';
      }

      return text;
    }

    return '';
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error);
    return '';
  }
}

function mergeStringLists(base: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  const merged = [...(base ?? []), ...(incoming ?? [])]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value): value is string => Boolean(value));

  return merged.length ? Array.from(new Set(merged)) : undefined;
}

function normalizeStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => normalizeStringValue(item))
    .filter((item): item is string => Boolean(item));

  return normalized.length ? normalized : undefined;
}

type MetadataScalarField =
  | 'projectName'
  | 'client'
  | 'contact'
  | 'email'
  | 'bidDueDate'
  | 'rfiDueDate'
  | 'address'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'projectSize'
  | 'trade';

const METADATA_PLACEHOLDER_REGEX = /\b(tbd|pending|unknown|n\/a|na|to be determined|not provided|not available)\b/i;
const METADATA_EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const METADATA_STATE_REGEX = /^[A-Z]{2}$/;
const METADATA_ZIP_REGEX = /^\d{5}(?:-\d{4})?$/;
const METADATA_ADDRESS_REGEX =
  /\b\d{2,6}\s+[A-Za-z0-9.'#\- ]+\b(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Trail|Trl|Highway|Hwy|Freeway|Fwy|Parkway|Pkwy|Loop|Terrace|Ter)\b\.?/i;

function isWeakMetadataValue(field: MetadataScalarField, value: string | undefined) {
  if (!value) {
    return true;
  }

  if (METADATA_PLACEHOLDER_REGEX.test(value)) {
    return true;
  }

  switch (field) {
    case 'email':
      return !METADATA_EMAIL_REGEX.test(value);
    case 'bidDueDate':
    case 'rfiDueDate':
      return !safeDate(value);
    case 'state':
      return !METADATA_STATE_REGEX.test(value.trim().toUpperCase());
    case 'zipCode':
      return !METADATA_ZIP_REGEX.test(value.trim());
    case 'address':
      return !METADATA_ADDRESS_REGEX.test(value) || value.length > 180;
    case 'trade':
      return !findTradeOption(value);
    case 'city':
      return /\d/.test(value) || value.length > 60;
    case 'projectName':
      return value.length > 140 || /^(?:project|project name|job name|information|details)$/i.test(value);
    case 'client':
      return value.length > 140 || METADATA_EMAIL_REGEX.test(value) || /^(?:client|gc|owner|contractor)$/i.test(value);
    case 'contact':
      return value.length > 100 || METADATA_EMAIL_REGEX.test(value);
    case 'projectSize':
      return value.length > 60;
    default:
      return false;
  }
}

function shouldPreferIncomingMetadataValue(
  field: MetadataScalarField,
  current: string | undefined,
  incoming: string | undefined,
  preferIncomingTrustedSignals: boolean,
) {
  if (!incoming) {
    return false;
  }

  if (!current) {
    return true;
  }

  if (!preferIncomingTrustedSignals) {
    return false;
  }

  const currentWeak = isWeakMetadataValue(field, current);
  const incomingWeak = isWeakMetadataValue(field, incoming);

  if (currentWeak && !incomingWeak) {
    return true;
  }

  if (incomingWeak) {
    return false;
  }

  switch (field) {
    case 'projectName':
    case 'client':
    case 'contact':
      return current.length > incoming.length * 1.6;
    case 'email':
      return !METADATA_EMAIL_REGEX.test(current) && METADATA_EMAIL_REGEX.test(incoming);
    case 'bidDueDate':
    case 'rfiDueDate':
      return !safeDate(current) && Boolean(safeDate(incoming));
    case 'address':
      return !METADATA_ADDRESS_REGEX.test(current) && METADATA_ADDRESS_REGEX.test(incoming);
    case 'state':
      return !METADATA_STATE_REGEX.test(current.trim().toUpperCase()) && METADATA_STATE_REGEX.test(incoming.trim().toUpperCase());
    case 'zipCode':
      return !METADATA_ZIP_REGEX.test(current.trim()) && METADATA_ZIP_REGEX.test(incoming.trim());
    case 'trade':
      return Boolean(findTradeOption(incoming) && !findTradeOption(current));
    case 'city':
      return /\d/.test(current) && !/\d/.test(incoming);
    default:
      return false;
  }
}

function pickMergedMetadataValue(
  field: MetadataScalarField,
  current: unknown,
  incoming: unknown,
  preferIncomingTrustedSignals: boolean,
) {
  const currentValue = normalizeStringValue(current);
  const incomingValue = normalizeStringValue(incoming);

  if (shouldPreferIncomingMetadataValue(field, currentValue, incomingValue, preferIncomingTrustedSignals)) {
    return incomingValue;
  }

  return currentValue || incomingValue;
}

export function mergeMetadata(
  current: ExtractedMetadata,
  incoming: ExtractedMetadata,
  options?: { preferIncomingTrustedSignals?: boolean },
): ExtractedMetadata {
  const preferIncomingTrustedSignals = options?.preferIncomingTrustedSignals ?? false;

  return {
    projectName: pickMergedMetadataValue('projectName', current.projectName, incoming.projectName, preferIncomingTrustedSignals),
    client: pickMergedMetadataValue('client', current.client, incoming.client, preferIncomingTrustedSignals),
    contact: pickMergedMetadataValue('contact', current.contact, incoming.contact, preferIncomingTrustedSignals),
    email: pickMergedMetadataValue('email', current.email, incoming.email, preferIncomingTrustedSignals),
    bidDueDate: pickMergedMetadataValue('bidDueDate', current.bidDueDate, incoming.bidDueDate, preferIncomingTrustedSignals),
    rfiDueDate: pickMergedMetadataValue('rfiDueDate', current.rfiDueDate, incoming.rfiDueDate, preferIncomingTrustedSignals),
    address: pickMergedMetadataValue('address', current.address, incoming.address, preferIncomingTrustedSignals),
    city: pickMergedMetadataValue('city', current.city, incoming.city, preferIncomingTrustedSignals),
    state: pickMergedMetadataValue('state', current.state, incoming.state, preferIncomingTrustedSignals),
    zipCode: pickMergedMetadataValue('zipCode', current.zipCode, incoming.zipCode, preferIncomingTrustedSignals),
    projectSize: pickMergedMetadataValue('projectSize', current.projectSize, incoming.projectSize, preferIncomingTrustedSignals),
    trade: pickMergedMetadataValue('trade', current.trade, incoming.trade, preferIncomingTrustedSignals),
    scopeHints: mergeStringLists(normalizeStringArray(current.scopeHints), normalizeStringArray(incoming.scopeHints)),
    proposalReqs: mergeStringLists(normalizeStringArray(current.proposalReqs), normalizeStringArray(incoming.proposalReqs)),
    insuranceReqs: mergeStringLists(normalizeStringArray(current.insuranceReqs), normalizeStringArray(incoming.insuranceReqs)),
    scheduleConstraints: mergeStringLists(
      normalizeStringArray(current.scheduleConstraints),
      normalizeStringArray(incoming.scheduleConstraints)
    ),
  };
}

function buildLocationQuery(project: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null; location?: string | null }, metadata: ExtractedMetadata): string {
  const fullAddress = metadata.address || project.address;
  if (fullAddress) {
    return fullAddress;
  }

  const cityLine = [metadata.city || project.city, metadata.state || project.state, metadata.zipCode || project.zip]
    .filter(Boolean)
    .join(', ');

  return cityLine || metadata.projectName || project.location || '';
}

function safeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeMaterials(value: ScopeAnalysisResult['materials'] | ExecutiveSummaryResult['materialsDetected']): MaterialInsight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = value.map((item): MaterialInsight | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name) {
        return null;
      }

      return {
        name,
        category: typeof record.category === 'string' ? record.category : 'general',
        estimatedQty: typeof record.estimatedQty === 'number' ? record.estimatedQty : undefined,
        unit: typeof record.unit === 'string' ? record.unit : undefined,
        notes: typeof record.notes === 'string' ? record.notes : undefined,
      };
    })
    .filter((item): item is MaterialInsight => Boolean(item));

  return items;
}

function normalizeRiskItems(value: ScopeAnalysisResult['risks'] | ExecutiveSummaryResult['risks']): RiskItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = value
    .map((item, index): RiskItem | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const description = typeof record.description === 'string' ? record.description.trim() : '';
      if (!description) {
        return null;
      }

      const severity = typeof record.severity === 'string' ? record.severity : 'medium';
      const likelihood = typeof record.likelihood === 'string' ? record.likelihood : 'possible';

      return {
        id: typeof record.id === 'string' ? record.id : `risk-${index + 1}`,
        category: typeof record.category === 'string' ? record.category : 'general',
        description,
        severity: ['low', 'medium', 'high', 'critical'].includes(severity) ? (severity as RiskItem['severity']) : 'medium',
        likelihood: ['unlikely', 'possible', 'likely', 'very_likely'].includes(likelihood)
          ? (likelihood as RiskItem['likelihood'])
          : 'possible',
        impact: typeof record.impact === 'string' ? record.impact : 'Review before pricing.',
        mitigation: typeof record.mitigation === 'string' ? record.mitigation : undefined,
        source: typeof record.source === 'string' ? record.source : 'inferred',
      };
    })
    .filter((item): item is RiskItem => Boolean(item));

  return items;
}

function normalizeRfis(value: ScopeAnalysisResult['rfis'] | ExecutiveSummaryResult['rfis']): RFISuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = value
    .map((item, index): RFISuggestion | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const question = typeof record.question === 'string' ? record.question.trim() : '';
      if (!question) {
        return null;
      }

      const priority = typeof record.priority === 'string' ? record.priority : 'medium';

      return {
        id: typeof record.id === 'string' ? record.id : `rfi-${index + 1}`,
        question,
        reason: typeof record.reason === 'string' ? record.reason : 'Clarify before final pricing.',
        referenceDoc: typeof record.referenceDoc === 'string' ? record.referenceDoc : undefined,
        referenceSheet: typeof record.referenceSheet === 'string' ? record.referenceSheet : undefined,
        priority: ['low', 'medium', 'high'].includes(priority) ? (priority as RFISuggestion['priority']) : 'medium',
        category: typeof record.category === 'string' ? record.category : 'general',
      };
    })
    .filter((item): item is RFISuggestion => Boolean(item));

  return items;
}

function normalizeTimeEstimate(value: Partial<TimeEstimate> | null | undefined): TimeEstimate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const phases = Array.isArray(value.phases)
    ? value.phases
        .map((phase, index) => {
          if (!phase || typeof phase !== 'object') {
            return null;
          }

      const record = phase as unknown as Record<string, unknown>;
          return {
            name: typeof record.name === 'string' ? record.name : `Phase ${index + 1}`,
            hours: typeof record.hours === 'number' ? record.hours : 0,
            days: typeof record.days === 'number' ? record.days : 0,
            crew: typeof record.crew === 'number' ? record.crew : 0,
            description: typeof record.description === 'string' ? record.description : '',
          };
        })
        .filter((phase): phase is TimeEstimate['phases'][number] => Boolean(phase))
    : [];

  return {
    totalHours: typeof value.totalHours === 'number' ? value.totalHours : 0,
    totalDays: typeof value.totalDays === 'number' ? value.totalDays : 0,
    crewSize: typeof value.crewSize === 'number' ? value.crewSize : 0,
    phases,
    risks: Array.isArray(value.risks) ? value.risks.filter((risk): risk is string => typeof risk === 'string') : [],
    assumptions: Array.isArray(value.assumptions)
      ? value.assumptions.filter((assumption): assumption is string => typeof assumption === 'string')
      : [],
  };
}

function normalizeKeySheets(
  value: ScopeAnalysisResult['keySheets'] | ExecutiveSummaryResult['keySheets'],
  fallbackFileName?: string
): ExecutiveSummary['keySheets'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const sheetNumber =
        typeof record.sheetNumber === 'string'
          ? record.sheetNumber
          : typeof record.number === 'string'
            ? record.number
            : '';

      const sheetTitle =
        typeof record.sheetTitle === 'string'
          ? record.sheetTitle
          : typeof record.title === 'string'
            ? record.title
            : '';

      if (!sheetNumber && !sheetTitle) {
        return null;
      }

      return {
        sheetNumber,
        sheetTitle,
        fileName: typeof record.fileName === 'string' ? record.fileName : fallbackFileName ?? 'Bid package',
        reason: typeof record.reason === 'string'
          ? record.reason
          : typeof record.relevance === 'string'
            ? record.relevance
            : 'Relevant to the selected trade.',
        elements: Array.isArray(record.elements)
          ? record.elements.filter((element): element is string => typeof element === 'string')
          : [],
        scopeRelation: typeof record.scopeRelation === 'string' ? record.scopeRelation : 'Supports scope review.',
        confidence: typeof record.confidence === 'number' ? record.confidence : 0.6,
      };
    })
    .filter((item): item is ExecutiveSummary['keySheets'][number] => Boolean(item));
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeStringValue(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeSheetReferences(value: unknown): Array<{ number?: string; title?: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: Array<{ number?: string; title?: string }> = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;
    const number = normalizeStringValue(record.number);
    const title = normalizeStringValue(record.title);

    if (!number && !title) {
      continue;
    }

    normalized.push({ number, title });
  }

  return normalized.length ? normalized : undefined;
}

function normalizeClassification(value: unknown): ClassificationResult {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    category: normalizeStringValue(record.category),
    confidence: typeof record.confidence === 'number' ? record.confidence : undefined,
    summary: normalizeStringValue(record.summary),
    keywords: normalizeStringArray(record.keywords),
    relevantToTrade: typeof record.relevantToTrade === 'boolean' ? record.relevantToTrade : undefined,
    reason: normalizeStringValue(record.reason),
    sheetReferences: normalizeSheetReferences(record.sheetReferences),
  };
}

async function setAnalysisStatus(projectId: string, status: string, error: string | null = null) {
  await db.analysis.upsert({
    where: { projectId },
    create: { projectId, status, error },
    update: { status, error },
  });
}

function getAnalysisProgress(status: string | null | undefined) {
  const normalizedStatus = status && status in ANALYSIS_PROGRESS ? status as keyof typeof ANALYSIS_PROGRESS : 'extracting';
  return {
    status: normalizedStatus,
    progress: ANALYSIS_PROGRESS[normalizedStatus].progress,
    message: ANALYSIS_PROGRESS[normalizedStatus].message,
  };
}

function normalizeTradeToken(value: unknown) {
  const normalizedValue = normalizeStringValue(value);
  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function findTradeOption(value: unknown) {
  const normalized = normalizeTradeToken(value);
  if (!normalized) {
    return null;
  }

  return TRADE_OPTIONS.find((tradeOption) => {
    if (tradeOption.value === normalized) {
      return true;
    }

    if (normalizeTradeToken(tradeOption.label) === normalized) {
      return true;
    }

    return tradeOption.keywords.some((keyword) => {
      const normalizedKeyword = normalizeTradeToken(keyword);
      return normalized.includes(normalizedKeyword) || normalizedKeyword.includes(normalized);
    });
  }) ?? null;
}

// POST /api/projects/[id]/analyze - Trigger analysis
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isOpenAIConfigured()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is missing. Configure it before running analysis.' }, { status: 500 });
    }

    const { id: projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { files: true, analysis: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const processableFiles = project.files.filter(
      (file) => !['zip', 'other', 'image'].includes(file.fileType)
    );

    if (!processableFiles.length) {
      return NextResponse.json({ error: 'No processable files found' }, { status: 400 });
    }

    await db.project.update({
      where: { id: projectId },
      data: { status: 'processing' },
    });

    await setAnalysisStatus(projectId, 'extracting');

    void (async () => {
      try {
        const logStepStart = (step: string) => {
          console.log(`[analysis:${projectId}] ${step}`);
          return Date.now();
        };

        const logStepComplete = (step: string, startedAt: number) => {
          console.log(`[analysis:${projectId}] ${step} complete in ${Date.now() - startedAt}ms`);
        };

        const selectedTrade = findTradeOption(project.trade);
        let tradeKeywords = [...(selectedTrade?.keywords ?? [])];
        let tradeLabel = selectedTrade?.label || project.trade || 'General';
        let storedTradeValue = selectedTrade?.value || project.trade || null;

        let extractedMetadata: ExtractedMetadata = {};
        const fileContents: FileExcerpt[] = [];

        const extractionStart = logStepStart('extracting documents');
        for (const file of processableFiles) {
          const text = await extractTextFromFile(file.filePath, file.fileType);
          if (!text.trim()) {
            continue;
          }

          fileContents.push({
            fileId: file.id,
            fileName: file.originalName,
            text: text.slice(0, 12000),
            fileType: file.fileType,
          });
        }
        logStepComplete('extracting documents', extractionStart);

        const heuristicMetadata = extractHeuristicMetadataFromDocuments(
          fileContents.map((file) => ({
            fileName: file.fileName,
            content: file.text,
          }))
        );

        const metadataBatch = fileContents
          .slice(0, 3)
          .filter((file) => file.text.length > 200)
          .map((file) => ({
            fileId: file.fileId,
            fileName: file.fileName,
            content: file.text,
          }));

        if (metadataBatch.length) {
          const metadataStart = logStepStart('extracting metadata');
          try {
            extractedMetadata = mergeMetadata(
              extractedMetadata,
              await generateJson<ExtractedMetadata>({
                prompt: buildBatchMetadataExtractionPrompt(metadataBatch),
                label: `metadata:${projectId}`,
                timeoutMs: 120000,
              })
            );
          } catch (error) {
            console.error(`Batch metadata extraction failed for project ${projectId}:`, error);

            for (const file of metadataBatch) {
              try {
                const metadataPrompt = buildBatchMetadataExtractionPrompt([file]);
                const metadataResult = await generateJson<ExtractedMetadata>({
                  prompt: metadataPrompt,
                  label: `metadata:${file.fileName}`,
                  timeoutMs: 90000,
                });
                extractedMetadata = mergeMetadata(extractedMetadata, metadataResult);
              } catch (fileError) {
                console.error(`Metadata extraction failed for ${file.fileName}:`, fileError);
              }
            }
          }
          logStepComplete('extracting metadata', metadataStart);
        }

        extractedMetadata = mergeMetadata(extractedMetadata, heuristicMetadata, {
          preferIncomingTrustedSignals: true,
        });

        const inferredTrade = findTradeOption(extractedMetadata.trade);
        if (inferredTrade) {
          tradeKeywords = [...inferredTrade.keywords];
          tradeLabel = inferredTrade.label;
          storedTradeValue = inferredTrade.value;
        } else if (!storedTradeValue && extractedMetadata.trade) {
          tradeLabel = extractedMetadata.trade;
          storedTradeValue = extractedMetadata.trade;
        }

        await setAnalysisStatus(projectId, 'classifying');

        const classificationResults: Array<{ fileId: string; fileName: string; classification: ClassificationResult }> = [];

        const classifyOne = async (excerpt: FileExcerpt) => {
          const prompt = buildClassificationPrompt(excerpt.text, excerpt.fileName, tradeKeywords);
          return normalizeClassification(
            await generateJson<ClassificationResult>({
              prompt,
              label: `classification:${excerpt.fileName}`,
              timeoutMs: 90000,
            })
          );
        };

        const classificationStart = logStepStart('classifying documents');
        for (const batch of chunkArray(fileContents.slice(0, 15), 5)) {
          try {
            const batchPrompt = buildBatchClassificationPrompt(
              batch.map((excerpt) => ({
                fileId: excerpt.fileId,
                fileName: excerpt.fileName,
                content: excerpt.text,
              })),
              tradeKeywords
            );

            const batchResult = await generateJson<BatchClassificationResponse>({
              prompt: batchPrompt,
              label: `classification-batch:${projectId}:${batch[0]?.fileName ?? 'batch'}`,
              timeoutMs: 120000,
            });

            const batchLookup = new Map(
              (batchResult.documents ?? [])
                .filter((document): document is ClassificationResult & { fileId: string } => typeof document?.fileId === 'string')
                .map((document) => [document.fileId, normalizeClassification(document)])
            );

            for (const excerpt of batch) {
              const classification = batchLookup.get(excerpt.fileId) ?? await classifyOne(excerpt);

              classificationResults.push({
                fileId: excerpt.fileId,
                fileName: excerpt.fileName,
                classification,
              });

              await db.bidFile.update({
                where: { id: excerpt.fileId },
                data: {
                  category: classification.category || 'unknown',
                  summary: classification.summary || null,
                  relevanceScore: classification.relevantToTrade
                    ? Math.max(0.55, classification.confidence || 0.55)
                    : Math.min(0.5, classification.confidence || 0.35),
                  isRelevant: Boolean(classification.relevantToTrade),
                  isProcessed: true,
                  error: null,
                  sheetData: classification.sheetReferences?.length
                    ? stringifyJson(classification.sheetReferences)
                    : null,
                  metadata: stringifyJson({
                    keywords: classification.keywords ?? [],
                    reason: classification.reason ?? null,
                  }),
                },
              });
            }
          } catch (batchError) {
            console.error(`Batch classification failed for project ${projectId}:`, batchError);

            for (const excerpt of batch) {
              try {
                const classification = await classifyOne(excerpt);

                classificationResults.push({
                  fileId: excerpt.fileId,
                  fileName: excerpt.fileName,
                  classification,
                });

                await db.bidFile.update({
                  where: { id: excerpt.fileId },
                  data: {
                    category: classification.category || 'unknown',
                    summary: classification.summary || null,
                    relevanceScore: classification.relevantToTrade
                      ? Math.max(0.55, classification.confidence || 0.55)
                      : Math.min(0.5, classification.confidence || 0.35),
                    isRelevant: Boolean(classification.relevantToTrade),
                    isProcessed: true,
                    error: null,
                    sheetData: classification.sheetReferences?.length
                      ? stringifyJson(classification.sheetReferences)
                      : null,
                    metadata: stringifyJson({
                      keywords: classification.keywords ?? [],
                      reason: classification.reason ?? null,
                    }),
                  },
                });
              } catch (error) {
                console.error(`Classification failed for ${excerpt.fileName}:`, error);
                await db.bidFile.update({
                  where: { id: excerpt.fileId },
                  data: {
                    isProcessed: true,
                    error: String(error),
                  },
                });
              }
            }
          }
        }
        logStepComplete('classifying documents', classificationStart);

        const classifiedDocsSummary = classificationResults
          .map(({ fileName, classification }) => {
            return `- ${fileName}: category=${classification.category ?? 'unknown'}; relevant=${Boolean(
              classification.relevantToTrade
            )}; summary=${classification.summary ?? 'No summary'}; reason=${classification.reason ?? 'n/a'}`;
          })
          .join('\n');

        await setAnalysisStatus(projectId, 'analyzing_scope');
        const scopePrompt = buildScopeAnalysisPrompt(
          JSON.stringify(extractedMetadata, null, 2),
          classifiedDocsSummary,
          tradeLabel,
          tradeKeywords as string[]
        );

        const scopeStart = logStepStart('analyzing scope');
        const scopeData = await generateJson<ScopeAnalysisResult>({
          prompt: scopePrompt,
          label: `scope:${projectId}`,
          timeoutMs: 120000,
        });
        logStepComplete('analyzing scope', scopeStart);

        await setAnalysisStatus(projectId, 'analyzing_weather');
        const locationQuery = buildLocationQuery(project, extractedMetadata);
        const weatherStart = logStepStart('analyzing weather');
        const weatherImpact = await getWeatherImpact(locationQuery, project.trade ?? tradeLabel);
        logStepComplete('analyzing weather', weatherStart);

        await setAnalysisStatus(projectId, 'estimating_time');
        const timePrompt = buildTimeEstimatePrompt(
          tradeLabel,
          scopeData.probableScope || '',
          JSON.stringify(scopeData.materials ?? []),
          project.projectSize || extractedMetadata.projectSize || 'Unknown',
          weatherImpact?.impactSummary || 'No weather impact available'
        );

        const timeStart = logStepStart('estimating time');
        const timeData = await generateJson<Partial<TimeEstimate>>({
          prompt: timePrompt,
          label: `time:${projectId}`,
          timeoutMs: 90000,
        });
        logStepComplete('estimating time', timeStart);

        await setAnalysisStatus(projectId, 'generating_summary');
        const summaryPrompt = buildExecutiveSummaryPrompt(
          JSON.stringify(
            {
              metadata: extractedMetadata,
              classifications: classificationResults,
              scope: scopeData,
              weatherImpact,
              timeEstimate: timeData,
            },
            null,
            2
          )
        );

        const summaryStart = logStepStart('generating summary');
        const executiveData = await generateJson<ExecutiveSummaryResult>({
          prompt: summaryPrompt,
          label: `summary:${projectId}`,
          timeoutMs: 120000,
        });
        logStepComplete('generating summary', summaryStart);

        const relevantFilesCount = classificationResults.filter((item) => item.classification.relevantToTrade).length;
        const normalizedRisks = normalizeRiskItems(scopeData.risks ?? executiveData.risks);
        const normalizedRfis = normalizeRfis(scopeData.rfis ?? executiveData.rfis);
        const normalizedMaterials = normalizeMaterials(scopeData.materials ?? executiveData.materialsDetected);
        const normalizedTimeEstimate = normalizeTimeEstimate(timeData ?? executiveData.timeEstimate);
        const normalizedKeySheets = normalizeKeySheets(scopeData.keySheets ?? executiveData.keySheets);

        const executiveSummary: ExecutiveSummary = {
          project: executiveData.project || extractedMetadata.projectName || project.name,
          client: executiveData.client || extractedMetadata.client || project.client || 'TBD',
          location:
            executiveData.location ||
            locationQuery ||
            [project.city, project.state].filter(Boolean).join(', ') ||
            'TBD',
          trade: executiveData.trade || tradeLabel,
          probableScope: executiveData.probableScope || scopeData.probableScope || 'Scope still needs review.',
          totalFiles: executiveData.totalFiles || processableFiles.length,
          relevantFiles: executiveData.relevantFiles || relevantFilesCount,
          keyDocuments: uniqueStrings([
            ...(executiveData.keyDocuments ?? []),
            ...(scopeData.priorityDocs ?? []),
          ]),
          keySheets: executiveData.keySheets?.length ? normalizeKeySheets(executiveData.keySheets) : normalizedKeySheets,
          importantDates: Array.isArray(executiveData.importantDates) ? executiveData.importantDates : [],
          materialsDetected: executiveData.materialsDetected?.length
            ? normalizeMaterials(executiveData.materialsDetected)
            : normalizedMaterials,
          risks: executiveData.risks?.length ? normalizeRiskItems(executiveData.risks) : normalizedRisks,
          rfis: executiveData.rfis?.length ? normalizeRfis(executiveData.rfis) : normalizedRfis,
          timeEstimate:
            executiveData.timeEstimate && typeof executiveData.timeEstimate === 'object'
              ? normalizeTimeEstimate(executiveData.timeEstimate) ?? {
                  totalHours: 0,
                  totalDays: 0,
                  crewSize: 0,
                  phases: [],
                  risks: [],
                  assumptions: [],
                }
              : normalizedTimeEstimate ?? {
                  totalHours: 0,
                  totalDays: 0,
                  crewSize: 0,
                  phases: [],
                  risks: [],
                  assumptions: [],
                },
          weatherImpact: executiveData.weatherImpact ?? weatherImpact ?? undefined,
          nextSteps: Array.isArray(executiveData.nextSteps) ? executiveData.nextSteps : [],
          confidence:
            typeof executiveData.confidence === 'number'
              ? executiveData.confidence
              : typeof scopeData.confidence === 'number'
                ? scopeData.confidence
                : 0.5,
          inclusions: Array.isArray(executiveData.inclusions)
            ? executiveData.inclusions
            : scopeData.inclusions ?? [],
          exclusions: Array.isArray(executiveData.exclusions)
            ? executiveData.exclusions
            : scopeData.exclusions ?? [],
        };

        const analysisPayload = {
          projectName: extractedMetadata.projectName || project.name,
          client: extractedMetadata.client || project.client,
          contact: extractedMetadata.contact || null,
          email: extractedMetadata.email || null,
          bidDueDate: safeDate(extractedMetadata.bidDueDate) || project.bidDueDate?.toISOString() || null,
          rfiDueDate: safeDate(extractedMetadata.rfiDueDate) || project.rfiDueDate?.toISOString() || null,
          address: extractedMetadata.address || project.address,
          city: extractedMetadata.city || project.city,
          state: extractedMetadata.state || project.state,
          zipCode: extractedMetadata.zipCode || project.zip,
          trade: tradeLabel,
          scopeHints: stringifyJson(uniqueStrings([...(extractedMetadata.scopeHints ?? []), ...(scopeData.probableScope ? [scopeData.probableScope] : [])])),
          alternates: stringifyJson(scopeData.alternates ?? []),
          allowances: stringifyJson(scopeData.allowances ?? []),
          proposalReqs: stringifyJson(uniqueStrings([...(extractedMetadata.proposalReqs ?? []), ...(scopeData.proposalReqs ?? [])])),
          insuranceReqs: stringifyJson(uniqueStrings([...(extractedMetadata.insuranceReqs ?? []), ...(scopeData.insuranceReqs ?? [])])),
          scheduleConstraints: stringifyJson(
            uniqueStrings([...(extractedMetadata.scheduleConstraints ?? []), ...(scopeData.scheduleConstraints ?? [])])
          ),
          keySpecs: stringifyJson(scopeData.keySpecs ?? []),
          materials: stringifyJson(normalizedMaterials),
          relevantSheets: stringifyJson(normalizedKeySheets),
          scopeAnalysis: stringifyJson({
            probableScope: scopeData.probableScope,
            priorityDocs: scopeData.priorityDocs ?? [],
            keySheets: normalizedKeySheets,
            keySpecs: scopeData.keySpecs ?? [],
            risks: normalizedRisks,
            exclusions: scopeData.exclusions ?? [],
            inclusions: scopeData.inclusions ?? [],
            rfis: normalizedRfis,
            alternates: scopeData.alternates ?? [],
            allowances: scopeData.allowances ?? [],
            assumptions: scopeData.assumptions ?? [],
            scheduleConstraints: scopeData.scheduleConstraints ?? [],
            insuranceReqs: scopeData.insuranceReqs ?? [],
            proposalReqs: scopeData.proposalReqs ?? [],
          }),
          weatherImpact: stringifyJson(weatherImpact),
          timeEstimate: stringifyJson(normalizedTimeEstimate),
          executiveSummary: stringifyJson(executiveSummary),
          riskItems: stringifyJson(normalizedRisks),
          rfiSuggestions: stringifyJson(normalizedRfis),
          inclusions: stringifyJson(scopeData.inclusions ?? executiveSummary.inclusions),
          exclusions: stringifyJson(scopeData.exclusions ?? executiveSummary.exclusions),
          confidence: executiveSummary.confidence,
          status: 'complete',
          error: null,
        };

        await db.analysis.upsert({
          where: { projectId },
          create: {
            projectId,
            ...analysisPayload,
          },
          update: analysisPayload,
        });

        const projectUpdate: Record<string, unknown> = {
          status: 'complete',
        };

        if (extractedMetadata.projectName) {
          projectUpdate.name = extractedMetadata.projectName;
        }
        if (extractedMetadata.client) {
          projectUpdate.client = extractedMetadata.client;
        }
        if (extractedMetadata.address) {
          projectUpdate.address = extractedMetadata.address;
        }
        if (extractedMetadata.city) {
          projectUpdate.city = extractedMetadata.city;
        }
        if (extractedMetadata.state) {
          projectUpdate.state = extractedMetadata.state;
        }
        if (extractedMetadata.zipCode) {
          projectUpdate.zip = extractedMetadata.zipCode;
        }
        if (extractedMetadata.projectSize) {
          projectUpdate.projectSize = String(extractedMetadata.projectSize);
        }
        if (storedTradeValue) {
          projectUpdate.trade = storedTradeValue;
        }

        const bidDueDate = safeDate(extractedMetadata.bidDueDate);
        if (bidDueDate) {
          projectUpdate.bidDueDate = new Date(bidDueDate);
        }

        const rfiDueDate = safeDate(extractedMetadata.rfiDueDate);
        if (rfiDueDate) {
          projectUpdate.rfiDueDate = new Date(rfiDueDate);
        }

        await db.project.update({
          where: { id: projectId },
          data: projectUpdate,
        });

        console.log(`Analysis complete for project ${projectId}`);
      } catch (error) {
        console.error(`Analysis failed for project ${projectId}:`, error);
        await setAnalysisStatus(projectId, 'error', String(error));
        await db.project.update({
          where: { id: projectId },
          data: { status: 'error' },
        });
      }
    })();

    return NextResponse.json({
      success: true,
      message: 'Analysis started',
      projectId,
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 });
  }
}

// GET /api/projects/[id]/analyze - Get analysis status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const analysis = await db.analysis.findUnique({ where: { projectId } });
    if (!analysis) {
      return NextResponse.json({
        status: 'idle',
        progress: 0,
        message: 'Waiting to start analysis...',
      });
    }

    const progress = getAnalysisProgress(analysis.status);
    return NextResponse.json({
      ...analysis,
      progress: progress.progress,
      message: analysis.status === 'error' ? analysis.error || progress.message : progress.message,
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
