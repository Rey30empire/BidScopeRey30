// Project types
export interface ProjectMetadata {
  projectName: string;
  client?: string;
  contact?: string;
  email?: string;
  bidDueDate?: string;
  rfiDueDate?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  location?: string;
  projectSize?: string;
  trade?: string;
  scopeHints?: string[];
  alternates?: AlternateItem[];
  allowances?: AllowanceItem[];
  proposalReqs?: string[];
  insuranceReqs?: string[];
  scheduleConstraints?: string[];
}

export interface AlternateItem {
  id: string;
  description: string;
  estimatedValue?: number;
  scope?: string;
}

export interface AllowanceItem {
  id: string;
  description: string;
  estimatedValue?: number;
  unit?: string;
  quantity?: number;
}

export interface FileRecord {
  id: string;
  projectId: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  mimeType?: string;
  hash?: string;
  category?: DocumentCategory;
  relevanceScore?: number;
  summary?: string;
  sheetData?: SheetInfo[];
  metadata?: Record<string, unknown>;
  isRelevant?: boolean;
  isProcessed: boolean;
  error?: string;
}

export type DocumentCategory =
  | 'drawings'
  | 'addenda'
  | 'specifications'
  | 'civil'
  | 'structural'
  | 'architectural'
  | 'mep'
  | 'site'
  | 'geotech'
  | 'fire_protection'
  | 'bid_forms'
  | 'rfi'
  | 'unknown'
  | 'irrelevant';

export interface SheetInfo {
  sheetNumber: string;
  sheetTitle: string;
  discipline?: string;
  keywords?: string[];
  relevanceReason?: string;
  relevanceScore?: number;
  elements?: string[];
}

export interface DocumentClassification {
  fileId: string;
  category: DocumentCategory;
  confidence: number;
  summary: string;
  keywords: string[];
  relevantToTrade?: boolean;
  reason?: string;
}

export interface TradeScopeMatch {
  trade: string;
  probableScope: string;
  confidence: number;
  priorityDocs: string[]; // file IDs
  keySheets: SheetInfo[];
  keySpecs: string[];
  risks: RiskItem[];
  exclusions: string[];
  inclusions: string[];
  rfis: RFISuggestion[];
}

export interface RelevantSheet {
  sheetNumber: string;
  sheetTitle: string;
  fileName: string;
  reason: string;
  elements: string[];
  scopeRelation: string;
  confidence: number;
}

export interface WeatherImpact {
  location: string;
  currentTemp?: number;
  currentConditions?: string;
  forecastDays: ForecastDay[];
  impactSummary: string;
  workImpact: string[];
  logisticsImpact: string[];
}

export interface ForecastDay {
  date: string;
  high: number;
  low: number;
  conditions: string;
  precipitation: number;
  windSpeed: number;
  humidity: number;
}

export interface MaterialInsight {
  name: string;
  category: string;
  estimatedQty?: number;
  unit?: string;
  notes?: string;
}

export interface TimeEstimate {
  totalHours: number;
  totalDays: number;
  crewSize: number;
  phases: WorkPhase[];
  risks: string[];
  assumptions: string[];
}

export interface WorkPhase {
  name: string;
  hours: number;
  days: number;
  crew: number;
  description: string;
}

export interface RiskItem {
  id: string;
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  likelihood: 'unlikely' | 'possible' | 'likely' | 'very_likely';
  impact: string;
  mitigation?: string;
  source: string; // 'extracted' | 'inferred'
}

export interface RFISuggestion {
  id: string;
  question: string;
  reason: string;
  referenceDoc?: string;
  referenceSheet?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

export interface ExecutiveSummary {
  project: string;
  client: string;
  location: string;
  trade: string;
  probableScope: string;
  totalFiles: number;
  relevantFiles: number;
  keyDocuments: string[];
  keySheets: RelevantSheet[];
  importantDates: ImportantDate[];
  materialsDetected: MaterialInsight[];
  risks: RiskItem[];
  rfis: RFISuggestion[];
  timeEstimate: TimeEstimate;
  weatherImpact?: WeatherImpact;
  nextSteps: string[];
  confidence: number;
  inclusions: string[];
  exclusions: string[];
}

export interface ImportantDate {
  label: string;
  date: string;
}

export interface CostEstimateItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  materialCost: number;
  laborCost: number;
  subtotal: number;
}

export interface CostEstimate {
  items: CostEstimateItem[];
  directSubtotal: number;
  overheadPercent: number;
  overheadAmount: number;
  profitPercent: number;
  profitAmount: number;
  additionalCosts: number;
  total: number;
  assumptions: string[];
}

// Analysis status
export type AnalysisStatus = 'idle' | 'uploading' | 'extracting' | 'classifying' | 'analyzing_scope' | 'analyzing_weather' | 'estimating_time' | 'generating_summary' | 'complete' | 'error';

export interface AnalysisProgress {
  status: AnalysisStatus;
  progress: number; // 0-100
  message: string;
  details?: string;
}

// Upload types
export type SupportedFileType = 'zip' | 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'other';

// Settings
export interface AppSettings {
  companyName: string;
  estimatorName: string;
  email: string;
  phone: string;
  defaultOverheadPercent: number;
  defaultProfitPercent: number;
  defaultAdditionalPercent: number;
}
