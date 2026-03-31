export interface PremiumBrandingModel {
  companyName: string;
  subtitle: string;
  logoUrl?: string | null;
  signatureImageUrl?: string | null;
  signatureTextFallback: string;
  footerGeneratedByText: string;
  footerLegalText: string;
  accentColor: string;
  accentSoftColor: string;
  inkColor: string;
  paperColor: string;
  frameColor: string;
}

export interface EstimateMetaField {
  label: string;
  value: string;
}

export interface EstimateInfoField {
  label: string;
  value: string;
}

export interface EstimateSelectionOption {
  label: string;
  description?: string;
  emphasis?: string;
  active?: boolean;
}

export interface EstimateSelectionBlock {
  title: string;
  prompt: string;
  answer: string;
  supportingText?: string;
  amountLabel?: string;
  options: EstimateSelectionOption[];
}

export interface EstimatePricingField {
  label: string;
  value: string;
}

export interface EstimateCostBreakdownRow {
  item: string;
  description: string;
  quantity: string;
  unit: string;
  material: string;
  labor: string;
  equipment: string;
  subtotal: string;
}

export interface EstimateSummaryRow {
  label: string;
  value: string;
  emphasize?: boolean;
}

export interface EstimatePremiumRenderModel {
  branding: PremiumBrandingModel;
  estimateTitle: string;
  estimateSubtitle: string;
  statusLabel: string;
  executiveSummary: string;
  scopeOfWork: string;
  inclusions: string[];
  exclusions: string[];
  metaFields: EstimateMetaField[];
  infoLeft: EstimateInfoField[];
  infoRight: EstimateInfoField[];
  preliminaryNote: string;
  materialSectionTitle: string;
  materialSelectionBlocks: EstimateSelectionBlock[];
  pricingFields: EstimatePricingField[];
  costBreakdownNotes: string[];
  costRows: EstimateCostBreakdownRow[];
  summaryRows: EstimateSummaryRow[];
  finalTotal: string;
  clarifications: string[];
  qualifications: string[];
  proposalNotes: string[];
  internalSections: Array<{
    title: string;
    items: string[];
  }>;
  signatureLabel: string;
  signatureName: string;
  signatureNote: string;
  footerGeneratedByText: string;
  footerLegalText: string;
}
