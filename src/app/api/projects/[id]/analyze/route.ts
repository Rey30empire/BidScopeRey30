import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { db } from '@/lib/db';
import {
  buildClassificationPrompt,
  buildExecutiveSummaryPrompt,
  buildMetadataExtractionPrompt,
  buildScopeAnalysisPrompt,
  buildTimeEstimatePrompt,
} from '@/lib/prompts';
import { TRADE_OPTIONS } from '@/lib/constants';
import { generateJson, isOpenAIConfigured } from '@/lib/server/openai';
import { getWeatherImpact } from '@/lib/server/weather';
import type {
  ExecutiveSummary,
  MaterialInsight,
  RFISuggestion,
  RiskItem,
  TimeEstimate,
  WeatherImpact,
} from '@/lib/types';

type ExtractedMetadata = Partial<{
  projectName: string;
  client: string;
  contact: string;
  email: string;
  bidDueDate: string;
  rfiDueDate: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  projectSize: string;
  trade: string;
  scopeHints: string[];
  proposalReqs: string[];
  insuranceReqs: string[];
  scheduleConstraints: string[];
}>;

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

async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    if (fileType === 'pdf') {
      const pdfParse = (await import('pdf-parse')) as unknown as (buffer: Buffer) => Promise<{ text: string }>;
      const buffer = await readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
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
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return merged.length ? Array.from(new Set(merged)) : undefined;
}

function mergeMetadata(current: ExtractedMetadata, incoming: ExtractedMetadata): ExtractedMetadata {
  return {
    projectName: current.projectName || incoming.projectName,
    client: current.client || incoming.client,
    contact: current.contact || incoming.contact,
    email: current.email || incoming.email,
    bidDueDate: current.bidDueDate || incoming.bidDueDate,
    rfiDueDate: current.rfiDueDate || incoming.rfiDueDate,
    address: current.address || incoming.address,
    city: current.city || incoming.city,
    state: current.state || incoming.state,
    zipCode: current.zipCode || incoming.zipCode,
    projectSize: current.projectSize || incoming.projectSize,
    trade: current.trade || incoming.trade,
    scopeHints: mergeStringLists(current.scopeHints, incoming.scopeHints),
    proposalReqs: mergeStringLists(current.proposalReqs, incoming.proposalReqs),
    insuranceReqs: mergeStringLists(current.insuranceReqs, incoming.insuranceReqs),
    scheduleConstraints: mergeStringLists(current.scheduleConstraints, incoming.scheduleConstraints),
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
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

    void (async () => {
      try {
        const tradeConfig = TRADE_OPTIONS.find((tradeOption) => tradeOption.value === project.trade);
        const tradeKeywords = [...(tradeConfig?.keywords ?? [])];
        const tradeLabel = tradeConfig?.label || project.trade || 'General';

        let extractedMetadata: ExtractedMetadata = {};
        const fileContents: FileExcerpt[] = [];

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

          if (fileContents.length <= 3 && text.length > 200) {
            try {
              const metadataPrompt = buildMetadataExtractionPrompt(text, file.originalName);
              const metadataResult = await generateJson<ExtractedMetadata>({
                prompt: metadataPrompt,
                label: `metadata:${file.originalName}`,
              });
              extractedMetadata = mergeMetadata(extractedMetadata, metadataResult);
            } catch (error) {
              console.error(`Metadata extraction failed for ${file.originalName}:`, error);
            }
          }
        }

        await db.analysis.upsert({
          where: { projectId },
          create: { projectId, status: 'processing' },
          update: { status: 'processing', error: null },
        });

        const classificationResults: Array<{ fileId: string; fileName: string; classification: ClassificationResult }> = [];

        for (const excerpt of fileContents.slice(0, 15)) {
          try {
            const prompt = buildClassificationPrompt(excerpt.text, excerpt.fileName, tradeKeywords);
            const classification = await generateJson<ClassificationResult>({
              prompt,
              label: `classification:${excerpt.fileName}`,
            });

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

        const classifiedDocsSummary = classificationResults
          .map(({ fileName, classification }) => {
            return `- ${fileName}: category=${classification.category ?? 'unknown'}; relevant=${Boolean(
              classification.relevantToTrade
            )}; summary=${classification.summary ?? 'No summary'}; reason=${classification.reason ?? 'n/a'}`;
          })
          .join('\n');

        const scopePrompt = buildScopeAnalysisPrompt(
          JSON.stringify(extractedMetadata, null, 2),
          classifiedDocsSummary,
          tradeLabel,
          tradeKeywords as string[]
        );

        const scopeData = await generateJson<ScopeAnalysisResult>({
          prompt: scopePrompt,
          label: `scope:${projectId}`,
        });

        const locationQuery = buildLocationQuery(project, extractedMetadata);
        const weatherImpact = await getWeatherImpact(locationQuery, project.trade ?? tradeLabel);

        const summaryPrompt = buildExecutiveSummaryPrompt(
          JSON.stringify(
            {
              metadata: extractedMetadata,
              classifications: classificationResults,
              scope: scopeData,
              weatherImpact,
            },
            null,
            2
          )
        );

        const executiveData = await generateJson<ExecutiveSummaryResult>({
          prompt: summaryPrompt,
          label: `summary:${projectId}`,
        });

        const timePrompt = buildTimeEstimatePrompt(
          tradeLabel,
          scopeData.probableScope || '',
          JSON.stringify(scopeData.materials ?? []),
          project.projectSize || extractedMetadata.projectSize || 'Unknown',
          weatherImpact?.impactSummary || 'No weather impact available'
        );

        const timeData = await generateJson<Partial<TimeEstimate>>({
          prompt: timePrompt,
          label: `time:${projectId}`,
        });

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
        await db.analysis.upsert({
          where: { projectId },
          create: { projectId, status: 'error', error: String(error) },
          update: { status: 'error', error: String(error) },
        });
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
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
