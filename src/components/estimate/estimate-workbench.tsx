'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  CircleDot,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Layers,
  SlidersHorizontal,
  Mail,
  RefreshCw,
  Send,
  Shield,
  TriangleAlert,
} from 'lucide-react';
import {
  ESTIMATE_STATUS,
  formatEstimateDate,
  formatEstimateStatusLabel,
  getDocumentVersionLabel,
  toCurrency,
  type EstimateCostItem,
  type EstimateDocumentVersion,
  type EstimatePricingSummary,
  type EstimateType,
} from '@/lib/estimate';
import type { ProjectData } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EstimateQuestionnaire } from '@/components/estimating/estimate-questionnaire';

type EstimateRecord = {
  id: string;
  estimateType: EstimateType;
  estimateNumber: string;
  title: string;
  versionLabel: string;
  status: string;
  validForDays: number;
  preparedBy?: string | null;
  preparedByTitle?: string | null;
  reviewedBy?: string | null;
  reviewedByTitle?: string | null;
  companyName?: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  companyAddress?: string | null;
  clientRecipientName?: string | null;
  clientRecipientEmail?: string | null;
  executiveSummary?: string | null;
  scopeOfWork?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  clarifications?: string | null;
  qualifications?: string | null;
  proposalNotes?: string | null;
  keyDocuments?: string | null;
  keyPlansAndSpecs?: string | null;
  costItems?: string | null;
  pricingSummary?: string | null;
  internalAssumptions?: string | null;
  internalInferredData?: string | null;
  internalTechnicalBacking?: string | null;
  internalAnalysisNotes?: string | null;
  internalReviewComments?: string | null;
  riskRegister?: string | null;
  rfiRegister?: string | null;
  weatherNotes?: string | null;
  timeEstimateNotes?: string | null;
  acceptanceEnabled: boolean;
  clientDisclaimer?: string | null;
  internalDisclaimer?: string | null;
  humanApprovedForClientExport: boolean;
  humanApprovedForSend: boolean;
  sentCount: number;
  openCount: number;
  firstOpenedAt?: string | null;
  lastOpenedAt?: string | null;
  sends: Array<{
    id: string;
    documentVersion: EstimateDocumentVersion;
    recipientEmail: string;
    recipientName?: string | null;
    secureViewUrl?: string | null;
    status: string;
    openCount: number;
    sentAt: string;
    lastOpenedAt?: string | null;
    openEvents: Array<{
      id: string;
      openedAt: string;
      userAgent?: string | null;
      eventType: string;
      sourceType?: string | null;
      openCountAtEvent: number;
    }>;
    notificationEvents: Array<{ id: string }>;
  }>;
  activity: Array<{
    id: string;
    activityType: string;
    title: string;
    description?: string | null;
    createdAt: string;
  }>;
  clientPreflight?: EstimatePreflightReport | null;
};

type EstimatePreflightIssue = {
  code: string;
  severity: 'blocking' | 'warning';
  field: string;
  title: string;
  description: string;
};

type EstimatePreflightReport = {
  checkedAt: string;
  contentReady: boolean;
  readyForClientExport: boolean;
  readyForSend: boolean;
  blockingIssues: EstimatePreflightIssue[];
  warnings: EstimatePreflightIssue[];
  approvals: {
    clientExportApproved: boolean;
    sendApproved: boolean;
  };
};

type EstimateFormState = {
  title: string;
  status: string;
  preparedBy: string;
  preparedByTitle: string;
  reviewedBy: string;
  reviewedByTitle: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  clientRecipientName: string;
  clientRecipientEmail: string;
  executiveSummary: string;
  scopeOfWork: string;
  inclusions: string[];
  exclusions: string[];
  clarifications: string[];
  qualifications: string[];
  proposalNotes: string[];
  keyDocuments: string[];
  keyPlansAndSpecs: string[];
  costItems: EstimateCostItem[];
  pricingSummary: EstimatePricingSummary;
  internalAssumptions: string[];
  internalInferredData: string[];
  internalTechnicalBacking: string[];
  internalAnalysisNotes: string[];
  internalReviewComments: string[];
  riskRegister: string[];
  rfiRegister: string[];
  weatherNotes: string[];
  timeEstimateNotes: string[];
  clientDisclaimer: string;
  internalDisclaimer: string;
  validForDays: number;
  acceptanceEnabled: boolean;
};

const STATUS_SEQUENCE = ['Draft', 'AI Processed', 'Needs Human Review', 'Review In Progress', 'Internal Review Complete', 'Client Version Ready', 'Approved for Client Export', 'Approved for Send', 'Sent', 'Opened', 'Re-opened'] as const;
const EMPTY_SUMMARY: EstimatePricingSummary = { directSubtotal: 0, overheadPercent: 8, overheadAmount: 0, profitPercent: 5, profitAmount: 0, contingencyPercent: 3, contingencyAmount: 0, bondPercent: 0, bondAmount: 0, taxPercent: 0, taxAmount: 0, total: 0, validityDays: 30, budgetary: false, proposalLabel: 'Trade Estimate' };

function parseList(value?: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'description' in item && typeof item.description === 'string') return item.description.trim();
      if (item && typeof item === 'object' && 'question' in item && typeof item.question === 'string') return item.question.trim();
      return '';
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function parseCostItems(value?: string | null): EstimateCostItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as EstimateCostItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSummary(value: string | null | undefined, type: EstimateType): EstimatePricingSummary {
  try {
    const parsed = value ? JSON.parse(value) as Partial<EstimatePricingSummary> : {};
    return {
      ...EMPTY_SUMMARY,
      contingencyPercent: type === 'global' ? 5 : 3,
      budgetary: type === 'global',
      proposalLabel: type === 'global' ? 'Budgetary Estimate' : 'Trade Estimate',
      ...parsed,
    };
  } catch {
    return { ...EMPTY_SUMMARY, contingencyPercent: type === 'global' ? 5 : 3, budgetary: type === 'global', proposalLabel: type === 'global' ? 'Budgetary Estimate' : 'Trade Estimate' };
  }
}

function money(value: number) {
  return Math.round((value || 0) * 100) / 100;
}

function recomputeSummary(type: EstimateType, items: EstimateCostItem[], summary: EstimatePricingSummary): EstimatePricingSummary {
  const directSubtotal = money(items.reduce((sum, item) => sum + money(item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost), 0));
  const overheadAmount = money((directSubtotal * (summary.overheadPercent || 0)) / 100);
  const profitAmount = money((directSubtotal * (summary.profitPercent || 0)) / 100);
  const contingencyAmount = money((directSubtotal * (summary.contingencyPercent || 0)) / 100);
  const bondAmount = money((directSubtotal * (summary.bondPercent || 0)) / 100);
  const taxAmount = money(((directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount) * (summary.taxPercent || 0)) / 100);
  return { ...summary, budgetary: type === 'global', directSubtotal, overheadAmount, profitAmount, contingencyAmount, bondAmount, taxAmount, total: money(directSubtotal + overheadAmount + profitAmount + contingencyAmount + bondAmount + taxAmount) };
}

function linesToText(value: string[]) {
  return value.join('\n');
}

function textToLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'TBD';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'TBD';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function getClientPreflight(estimate?: Pick<EstimateRecord, 'humanApprovedForClientExport' | 'humanApprovedForSend' | 'clientPreflight'> | null): EstimatePreflightReport {
  if (estimate?.clientPreflight) {
    return estimate.clientPreflight;
  }

  return {
    checkedAt: '',
    contentReady: false,
    readyForClientExport: false,
    readyForSend: false,
    blockingIssues: [
      {
        code: 'missing_preflight',
        severity: 'blocking',
        field: 'preflight',
        title: 'Client preflight has not been loaded',
        description: 'Refresh the estimate list so the client delivery gate can be validated before export or send.',
      },
    ],
    warnings: [],
    approvals: {
      clientExportApproved: Boolean(estimate?.humanApprovedForClientExport),
      sendApproved: Boolean(estimate?.humanApprovedForSend),
    },
  };
}

function getStatusTone(status: string) {
  if (['Approved for Send', 'Opened', 'Re-opened'].includes(status)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (['Approved for Client Export', 'Client Version Ready', 'Internal Review Complete'].includes(status)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (['AI Processed', 'Needs Human Review', 'Review In Progress'].includes(status)) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function buildFormState(estimate: EstimateRecord): EstimateFormState {
  const summary = parseSummary(estimate.pricingSummary, estimate.estimateType);
  return {
    title: estimate.title || '',
    status: estimate.status || 'Draft',
    preparedBy: estimate.preparedBy || '',
    preparedByTitle: estimate.preparedByTitle || 'Prepared By',
    reviewedBy: estimate.reviewedBy || '',
    reviewedByTitle: estimate.reviewedByTitle || 'Reviewed By',
    companyName: estimate.companyName || '',
    companyEmail: estimate.companyEmail || '',
    companyPhone: estimate.companyPhone || '',
    companyAddress: estimate.companyAddress || '',
    clientRecipientName: estimate.clientRecipientName || '',
    clientRecipientEmail: estimate.clientRecipientEmail || '',
    executiveSummary: estimate.executiveSummary || '',
    scopeOfWork: estimate.scopeOfWork || '',
    inclusions: parseList(estimate.inclusions),
    exclusions: parseList(estimate.exclusions),
    clarifications: parseList(estimate.clarifications),
    qualifications: parseList(estimate.qualifications),
    proposalNotes: parseList(estimate.proposalNotes),
    keyDocuments: parseList(estimate.keyDocuments),
    keyPlansAndSpecs: parseList(estimate.keyPlansAndSpecs),
    costItems: parseCostItems(estimate.costItems).length ? parseCostItems(estimate.costItems) : [{ id: 'item-1', description: '', quantity: 1, unit: 'LS', materialCost: 0, laborCost: 0, equipmentCost: 0, subcontractCost: 0, subtotal: 0 }],
    pricingSummary: summary,
    internalAssumptions: parseList(estimate.internalAssumptions),
    internalInferredData: parseList(estimate.internalInferredData),
    internalTechnicalBacking: parseList(estimate.internalTechnicalBacking),
    internalAnalysisNotes: parseList(estimate.internalAnalysisNotes),
    internalReviewComments: parseList(estimate.internalReviewComments),
    riskRegister: parseList(estimate.riskRegister),
    rfiRegister: parseList(estimate.rfiRegister),
    weatherNotes: parseList(estimate.weatherNotes),
    timeEstimateNotes: parseList(estimate.timeEstimateNotes),
    clientDisclaimer: estimate.clientDisclaimer || '',
    internalDisclaimer: estimate.internalDisclaimer || '',
    validForDays: estimate.validForDays || summary.validityDays || 30,
    acceptanceEnabled: estimate.acceptanceEnabled,
  };
}

function ListField({ label, value, onChange, description }: { label: string; value: string[]; onChange: (value: string[]) => void; description?: string; }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Textarea value={linesToText(value)} onChange={(event) => onChange(textToLines(event.target.value))} rows={5} className="min-h-[124px]" />
    </div>
  );
}

export function EstimateWorkbench({ project }: { project: ProjectData }) {
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);
  const [form, setForm] = useState<EstimateFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [exportingVersion, setExportingVersion] = useState<EstimateDocumentVersion | null>(null);
  const [sendForm, setSendForm] = useState({ recipientName: '', recipientEmail: '', sentByName: '', sentByEmail: '', documentVersion: 'client_trade' as EstimateDocumentVersion });
  const [lastSendLinks, setLastSendLinks] = useState<{ secureViewUrl?: string | null; secureDownloadUrl?: string | null; pixelUrl?: string | null } | null>(null);

  const loadEstimates = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/estimates`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload?.error || 'Failed to load estimates');
      const nextEstimates = Array.isArray(payload) ? payload as EstimateRecord[] : [];
      setEstimates(nextEstimates);
      setActiveEstimateId((current) => current && nextEstimates.some((item) => item.id === current) ? current : nextEstimates[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load estimates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadEstimates(); }, [project.id]);

  useEffect(() => {
    const estimateId = new URLSearchParams(window.location.search).get('estimate');
    if (!estimateId) return;
    if (estimates.some((item) => item.id === estimateId)) {
      setActiveEstimateId(estimateId);
    }
  }, [estimates]);

  const selectedEstimate = useMemo(() => estimates.find((item) => item.id === activeEstimateId) ?? null, [activeEstimateId, estimates]);

  useEffect(() => {
    if (!selectedEstimate) return;
    setForm(buildFormState(selectedEstimate));
    setSendForm({
      recipientName: selectedEstimate.clientRecipientName || '',
      recipientEmail: selectedEstimate.clientRecipientEmail || '',
      sentByName: selectedEstimate.reviewedBy || selectedEstimate.preparedBy || '',
      sentByEmail: selectedEstimate.companyEmail || '',
      documentVersion: selectedEstimate.estimateType === 'global' ? 'client_global' : 'client_trade',
    });
  }, [selectedEstimate]);

  const summary = useMemo(() => selectedEstimate && form ? recomputeSummary(selectedEstimate.estimateType, form.costItems, { ...form.pricingSummary, validityDays: form.validForDays }) : null, [form, selectedEstimate]);
  const clientVersion = selectedEstimate?.estimateType === 'global' ? 'client_global' : 'client_trade';
  const selectedPreflight = useMemo(() => getClientPreflight(selectedEstimate), [selectedEstimate]);
  const clientExportBlockedReason = !selectedPreflight.contentReady
    ? `Resolve ${selectedPreflight.blockingIssues.length} blocking review item${selectedPreflight.blockingIssues.length === 1 ? '' : 's'} before client export.`
    : !selectedEstimate?.humanApprovedForClientExport
      ? 'Manual client export approval is still pending.'
      : null;
  const selectedSendBlockedReason = sendForm.documentVersion === 'internal_review'
    ? (!selectedEstimate?.humanApprovedForSend ? 'Manual send approval is still pending for this internal review package.' : null)
    : !selectedPreflight.contentReady
      ? `Resolve ${selectedPreflight.blockingIssues.length} blocking review item${selectedPreflight.blockingIssues.length === 1 ? '' : 's'} before sending a client-facing estimate.`
      : !selectedEstimate?.humanApprovedForClientExport
        ? 'Manual client export approval is still pending.'
        : !selectedEstimate?.humanApprovedForSend
          ? 'Manual send approval is still pending.'
          : null;
  const canSendSelectedVersion = sendForm.documentVersion === 'internal_review'
    ? Boolean(selectedEstimate?.humanApprovedForSend)
    : selectedPreflight.readyForSend;
  const openEvents = useMemo(
    () => selectedEstimate
      ? selectedEstimate.sends.flatMap((send) => send.openEvents.map((event) => ({ ...event, recipientEmail: send.recipientEmail }))).sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
      : [],
    [selectedEstimate],
  );
  const activity = useMemo(
    () => selectedEstimate ? [...selectedEstimate.activity].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [],
    [selectedEstimate],
  );

  const applyEstimate = (nextEstimate: EstimateRecord) => {
    setEstimates((current) => current.map((item) => item.id === nextEstimate.id ? nextEstimate : item));
    setActiveEstimateId(nextEstimate.id);
  };

  const saveEstimate = async (override?: Record<string, unknown>) => {
    if (!selectedEstimate || !form || !summary) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/estimates/${selectedEstimate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          status: form.status,
          preparedBy: form.preparedBy,
          preparedByTitle: form.preparedByTitle,
          reviewedBy: form.reviewedBy,
          reviewedByTitle: form.reviewedByTitle,
          companyName: form.companyName,
          companyEmail: form.companyEmail,
          companyPhone: form.companyPhone,
          companyAddress: form.companyAddress,
          clientRecipientName: form.clientRecipientName,
          clientRecipientEmail: form.clientRecipientEmail,
          executiveSummary: form.executiveSummary,
          scopeOfWork: form.scopeOfWork,
          inclusions: form.inclusions,
          exclusions: form.exclusions,
          clarifications: form.clarifications,
          qualifications: form.qualifications,
          proposalNotes: form.proposalNotes,
          keyDocuments: form.keyDocuments,
          keyPlansAndSpecs: form.keyPlansAndSpecs,
          costItems: form.costItems.map((item) => ({ ...item, subtotal: money(item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost) })),
          pricingSummary: summary,
          internalAssumptions: form.internalAssumptions,
          internalInferredData: form.internalInferredData,
          internalTechnicalBacking: form.internalTechnicalBacking,
          internalAnalysisNotes: form.internalAnalysisNotes,
          internalReviewComments: form.internalReviewComments,
          riskRegister: form.riskRegister,
          rfiRegister: form.rfiRegister,
          weatherNotes: form.weatherNotes,
          timeEstimateNotes: form.timeEstimateNotes,
          clientDisclaimer: form.clientDisclaimer,
          internalDisclaimer: form.internalDisclaimer,
          validForDays: form.validForDays,
          acceptanceEnabled: form.acceptanceEnabled,
          ...override,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.id) throw new Error(payload?.error || 'Failed to save estimate');
      applyEstimate(payload as EstimateRecord);
      toast.success('Estimate saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save estimate');
    } finally {
      setSaving(false);
    }
  };

  const updateApproval = async (kind: 'client' | 'send', approved: boolean) => {
    if (!selectedEstimate || !form) return;
    const nextStatus = kind === 'send'
      ? approved ? 'Approved for Send' : selectedEstimate.humanApprovedForClientExport ? 'Approved for Client Export' : 'Client Version Ready'
      : approved ? 'Approved for Client Export' : 'Client Version Ready';
    setForm({ ...form, status: nextStatus });
    await saveEstimate(kind === 'send' ? { humanApprovedForSend: approved, status: nextStatus } : { humanApprovedForClientExport: approved, status: nextStatus });
  };

  const regenerateEstimate = async () => {
    if (!selectedEstimate) return;
    setRegenerating(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimateType: selectedEstimate.estimateType }),
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload?.error || 'Failed to regenerate estimate');
      const nextEstimates = Array.isArray(payload) ? payload as EstimateRecord[] : [];
      setEstimates(nextEstimates);
      setActiveEstimateId(nextEstimates.find((item) => item.estimateType === selectedEstimate.estimateType)?.id ?? nextEstimates[0]?.id ?? null);
      toast.success('Estimate draft regenerated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate estimate');
    } finally {
      setRegenerating(false);
    }
  };

  const exportEstimate = async (documentVersion: EstimateDocumentVersion) => {
    if (!selectedEstimate) return;
    setExportingVersion(documentVersion);
    try {
      const response = await fetch(`/api/estimates/${selectedEstimate.id}/export?documentVersion=${documentVersion}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.preflight) {
          applyEstimate({ ...selectedEstimate, clientPreflight: payload.preflight });
        }
        throw new Error(payload?.error || 'Failed to export estimate');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selectedEstimate.title.replace(/[^a-zA-Z0-9]/g, '_')}_${documentVersion}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${getDocumentVersionLabel(documentVersion)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export estimate');
    } finally {
      setExportingVersion(null);
    }
  };

  const sendEstimate = async () => {
    if (!selectedEstimate) return;
    if (!sendForm.recipientEmail.trim()) {
      toast.error('Recipient email is required');
      return;
    }
    setSending(true);
    try {
      const response = await fetch(`/api/estimates/${selectedEstimate.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendForm),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok && payload?.preflight) {
        applyEstimate({ ...selectedEstimate, clientPreflight: payload.preflight });
      }
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Failed to send estimate');
      setLastSendLinks({ secureViewUrl: payload.secureViewUrl, secureDownloadUrl: payload.secureDownloadUrl, pixelUrl: payload.pixelUrl });
      toast.success(`Estimate sent to ${sendForm.recipientEmail}`);
      await loadEstimates(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send estimate');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading estimate workbench...</CardContent></Card>;
  if (!selectedEstimate || !form || !summary) return <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No estimate drafts available yet.</CardContent></Card>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base"><Layers className="size-4" />Estimate Versions</CardTitle>
            <CardDescription>Separate trade and global estimate packages with manual approvals and tracked delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {estimates.map((estimate) => {
              const estimateSummary = parseSummary(estimate.pricingSummary, estimate.estimateType);
              const active = estimate.id === selectedEstimate.id;
              return (
                <button key={estimate.id} type="button" onClick={() => setActiveEstimateId(estimate.id)} className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${active ? 'text-white/70' : 'text-slate-500'}`}>{estimate.estimateType === 'global' ? 'Global' : 'Trade'}</p>
                      <p className="mt-2 text-lg font-semibold">{estimate.title}</p>
                    </div>
                    <Badge className={active ? 'border-white/15 bg-white/10 text-white' : getStatusTone(formatEstimateStatusLabel(estimate.status, estimate.openCount))}>{formatEstimateStatusLabel(estimate.status, estimate.openCount)}</Badge>
                  </div>
                  <div className={`mt-4 flex items-center justify-between text-sm ${active ? 'text-white/80' : 'text-slate-600'}`}>
                    <span>{estimate.estimateNumber}</span>
                    <strong>{toCurrency(estimateSummary.total)}</strong>
                  </div>
                </button>
              );
            })}
            <Separator />
            <Button variant="outline" onClick={() => void loadEstimates(true)} disabled={refreshing} className="w-full gap-2">{refreshing ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Refresh</Button>
            <Button variant="outline" onClick={regenerateEstimate} disabled={regenerating} className="w-full gap-2">{regenerating ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Regenerate Draft</Button>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-[linear-gradient(135deg,#f8fafc,#eef2ff)] px-6 py-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getStatusTone(formatEstimateStatusLabel(selectedEstimate.status, selectedEstimate.openCount))}>{formatEstimateStatusLabel(selectedEstimate.status, selectedEstimate.openCount)}</Badge>
                    <Badge variant="outline">{selectedEstimate.versionLabel}</Badge>
                    <Badge variant="outline">{selectedEstimate.estimateNumber}</Badge>
                    {selectedPreflight.blockingIssues.length > 0 ? (
                      <Badge className="bg-amber-100 text-amber-900">
                        {selectedPreflight.blockingIssues.length} Preflight Blocker{selectedPreflight.blockingIssues.length === 1 ? '' : 's'}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800">Client Preflight Clean</Badge>
                    )}
                    {selectedEstimate.humanApprovedForClientExport ? <Badge className="bg-blue-100 text-blue-800">Client Export Approved</Badge> : null}
                    {selectedEstimate.humanApprovedForSend ? <Badge className="bg-emerald-100 text-emerald-800">Send Approved</Badge> : null}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{selectedEstimate.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Client output stays commercial and clean. Internal review retains assumptions, inferred data, technical backing, risk review, and RFI guidance.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Estimate</p><p className="mt-3 text-2xl font-semibold text-slate-950">{toCurrency(summary.total)}</p></div>
                  <div className="rounded-2xl border bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Send Count</p><p className="mt-3 text-2xl font-semibold text-slate-950">{selectedEstimate.sentCount}</p></div>
                  <div className="rounded-2xl border bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open Count</p><p className="mt-3 text-2xl font-semibold text-slate-950">{selectedEstimate.openCount}</p></div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 border-t px-6 py-5 lg:grid-cols-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Project</p><p className="mt-2 text-sm font-medium text-slate-900">{project.name}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Client / GC</p><p className="mt-2 text-sm font-medium text-slate-900">{form.clientRecipientName || project.client || 'TBD'}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trade</p><p className="mt-2 text-sm font-medium text-slate-900">{project.trade || selectedEstimate.estimateType}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bid Due</p><p className="mt-2 text-sm font-medium text-slate-900">{formatEstimateDate(project.bidDueDate)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Status Timeline</CardTitle>
          <CardDescription>The system can mark AI processing, sent, opened, and re-opened events, but approvals remain manual.</CardDescription>
        </CardHeader>
        <CardContent><div className="grid gap-3 lg:grid-cols-6">{STATUS_SEQUENCE.map((status) => {
          const active = STATUS_SEQUENCE.indexOf(status) <= STATUS_SEQUENCE.indexOf(formatEstimateStatusLabel(selectedEstimate.status, selectedEstimate.openCount) as typeof STATUS_SEQUENCE[number]);
          return <div key={status} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><div className="flex items-start gap-2">{active ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleDot className="mt-0.5 size-4 shrink-0" />}<span>{status}</span></div></div>;
        })}</div></CardContent>
      </Card>
      <Tabs defaultValue="review" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="review" className="gap-1.5"><FileText className="size-3.5" />Review</TabsTrigger>
          <TabsTrigger value="questionnaire" className="gap-1.5"><SlidersHorizontal className="size-3.5" />Questionnaire</TabsTrigger>
          <TabsTrigger value="delivery" className="gap-1.5"><Send className="size-3.5" />Send &amp; Export</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Eye className="size-3.5" />Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="review" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileCheck className="size-4" />Client-Facing Content</CardTitle>
              <CardDescription>Keep the client copy commercial and professional. Move uncertainty into clarifications, qualifications, exclusions, and assumptions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><Label>Estimate Title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
                <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{ESTIMATE_STATUS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Prepared By</Label><Input value={form.preparedBy} onChange={(event) => setForm({ ...form, preparedBy: event.target.value })} /></div>
                <div className="space-y-2"><Label>Reviewed By</Label><Input value={form.reviewedBy} onChange={(event) => setForm({ ...form, reviewedBy: event.target.value })} /></div>
                <div className="space-y-2"><Label>Client / GC</Label><Input value={form.clientRecipientName} onChange={(event) => setForm({ ...form, clientRecipientName: event.target.value })} /></div>
                <div className="space-y-2"><Label>Client Email</Label><Input value={form.clientRecipientEmail} onChange={(event) => setForm({ ...form, clientRecipientEmail: event.target.value })} /></div>
                <div className="space-y-2"><Label>Company Name</Label><Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></div>
                <div className="space-y-2"><Label>Company Email</Label><Input value={form.companyEmail} onChange={(event) => setForm({ ...form, companyEmail: event.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Executive Summary</Label><Textarea value={form.executiveSummary} onChange={(event) => setForm({ ...form, executiveSummary: event.target.value })} rows={5} /></div>
              <div className="space-y-2"><Label>Scope of Work</Label><Textarea value={form.scopeOfWork} onChange={(event) => setForm({ ...form, scopeOfWork: event.target.value })} rows={6} /></div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ListField label="Inclusions" value={form.inclusions} onChange={(value) => setForm({ ...form, inclusions: value })} />
                <ListField label="Exclusions" value={form.exclusions} onChange={(value) => setForm({ ...form, exclusions: value })} />
                <ListField label="Clarifications" value={form.clarifications} onChange={(value) => setForm({ ...form, clarifications: value })} description="Use this for standard hours, site access assumptions, and commercial basis of pricing." />
                <ListField label="Qualifications" value={form.qualifications} onChange={(value) => setForm({ ...form, qualifications: value })} description="Use this for permits, bonds, taxes, freight, hoisting, patching, temporary protection, supervision, cleanup, and other limits." />
                <ListField label="Proposal Notes" value={form.proposalNotes} onChange={(value) => setForm({ ...form, proposalNotes: value })} />
                <ListField label="Key Documents / Specs" value={form.keyDocuments} onChange={(value) => setForm({ ...form, keyDocuments: value })} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <ListField label="Internal Assumptions" value={form.internalAssumptions} onChange={(value) => setForm({ ...form, internalAssumptions: value })} />
                  <ListField label="Technical Backing" value={form.internalTechnicalBacking} onChange={(value) => setForm({ ...form, internalTechnicalBacking: value })} />
                  <ListField label="Suggested RFIs" value={form.rfiRegister} onChange={(value) => setForm({ ...form, rfiRegister: value })} />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Client Disclaimer</Label><Textarea value={form.clientDisclaimer} onChange={(event) => setForm({ ...form, clientDisclaimer: event.target.value })} rows={6} /></div>
                  <div className="space-y-2"><Label>Internal Disclaimer</Label><Textarea value={form.internalDisclaimer} onChange={(event) => setForm({ ...form, internalDisclaimer: event.target.value })} rows={5} /></div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="size-4" />Pricing Structure</CardTitle>
              <CardDescription>Use a clean breakdown, a strong total, and a single professional pricing summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">The client PDF will show the cost breakdown and total only. Internal reasoning stays out of the client copy.</p>
                <Button variant="outline" onClick={() => setForm({ ...form, costItems: [...form.costItems, { id: `item-${form.costItems.length + 1}`, description: '', quantity: 1, unit: 'LS', materialCost: 0, laborCost: 0, equipmentCost: 0, subcontractCost: 0, subtotal: 0 }] })}>Add Line</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead className="min-w-[220px]">Description</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Material</TableHead><TableHead>Labor</TableHead><TableHead>Equipment</TableHead><TableHead>Subcontract</TableHead><TableHead>Subtotal</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {form.costItems.map((item, index) => {
                    const subtotal = money(item.materialCost + item.laborCost + item.equipmentCost + item.subcontractCost);
                    return (
                      <TableRow key={item.id}>
                        <TableCell><Input value={item.description} onChange={(event) => { const next = [...form.costItems]; next[index] = { ...item, description: event.target.value, subtotal }; setForm({ ...form, costItems: next }); }} /></TableCell>
                        <TableCell><Input type="number" value={item.quantity} onChange={(event) => { const next = [...form.costItems]; next[index] = { ...item, quantity: Number(event.target.value || 0), subtotal }; setForm({ ...form, costItems: next }); }} /></TableCell>
                        <TableCell><Input value={item.unit} onChange={(event) => { const next = [...form.costItems]; next[index] = { ...item, unit: event.target.value || 'LS', subtotal }; setForm({ ...form, costItems: next }); }} /></TableCell>
                        {(['materialCost', 'laborCost', 'equipmentCost', 'subcontractCost'] as const).map((field) => <TableCell key={field}><Input type="number" value={item[field]} onChange={(event) => { const next = [...form.costItems]; const nextItem = { ...item, [field]: Number(event.target.value || 0) } as EstimateCostItem; next[index] = { ...nextItem, subtotal: money(nextItem.materialCost + nextItem.laborCost + nextItem.equipmentCost + nextItem.subcontractCost) }; setForm({ ...form, costItems: next }); }} /></TableCell>)}
                        <TableCell className="font-semibold text-slate-900">{toCurrency(subtotal)}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => setForm({ ...form, costItems: form.costItems.length > 1 ? form.costItems.filter((_, rowIndex) => rowIndex !== index) : [{ id: 'item-1', description: '', quantity: 1, unit: 'LS', materialCost: 0, laborCost: 0, equipmentCost: 0, subcontractCost: 0, subtotal: 0 }] })}>Remove</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Proposal Label</Label><Input value={form.pricingSummary.proposalLabel} onChange={(event) => setForm({ ...form, pricingSummary: { ...form.pricingSummary, proposalLabel: event.target.value } })} /></div>
                  <div className="space-y-2"><Label>Validity (days)</Label><Input type="number" value={form.validForDays} onChange={(event) => setForm({ ...form, validForDays: Number(event.target.value || 0) })} /></div>
                  <div className="space-y-2"><Label>Overhead %</Label><Input type="number" value={form.pricingSummary.overheadPercent} onChange={(event) => setForm({ ...form, pricingSummary: { ...form.pricingSummary, overheadPercent: Number(event.target.value || 0) } })} /></div>
                  <div className="space-y-2"><Label>Profit %</Label><Input type="number" value={form.pricingSummary.profitPercent} onChange={(event) => setForm({ ...form, pricingSummary: { ...form.pricingSummary, profitPercent: Number(event.target.value || 0) } })} /></div>
                  <div className="space-y-2"><Label>Contingency %</Label><Input type="number" value={form.pricingSummary.contingencyPercent} onChange={(event) => setForm({ ...form, pricingSummary: { ...form.pricingSummary, contingencyPercent: Number(event.target.value || 0) } })} /></div>
                  <div className="space-y-2"><Label>Tax %</Label><Input type="number" value={form.pricingSummary.taxPercent} onChange={(event) => setForm({ ...form, pricingSummary: { ...form.pricingSummary, taxPercent: Number(event.target.value || 0) } })} /></div>
                  <div className="flex items-center justify-between rounded-2xl border px-4 py-3 md:col-span-2"><div><Label>Acceptance Area</Label><p className="text-xs text-muted-foreground">Optional client signature block.</p></div><Switch checked={form.acceptanceEnabled} onCheckedChange={(checked) => setForm({ ...form, acceptanceEnabled: checked })} /></div>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    ['Direct Subtotal', toCurrency(summary.directSubtotal)],
                    [`Overhead (${summary.overheadPercent}%)`, toCurrency(summary.overheadAmount)],
                    [`Profit (${summary.profitPercent}%)`, toCurrency(summary.profitAmount)],
                    [`Contingency (${summary.contingencyPercent}%)`, toCurrency(summary.contingencyAmount)],
                    [`Tax (${summary.taxPercent}%)`, toCurrency(summary.taxAmount)],
                  ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl border px-4 py-3"><span className="text-slate-600">{label}</span><strong>{value}</strong></div>)}
                  <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white"><div className="flex items-center justify-between"><span className="text-sm text-white/70">Total Estimate</span><strong className="text-2xl">{toCurrency(summary.total)}</strong></div></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setForm({ ...form, status: 'Review In Progress' })}>Review In Progress</Button>
                  <Button variant="outline" onClick={() => setForm({ ...form, status: 'Internal Review Complete' })}>Internal Review Complete</Button>
                  <Button variant="outline" onClick={() => setForm({ ...form, status: 'Client Version Ready' })}>Client Version Ready</Button>
                </div>
                <Button onClick={() => void saveEstimate()} disabled={saving} className="gap-2">{saving ? <RefreshCw className="size-4 animate-spin" /> : <FileCheck className="size-4" />}Save Estimate</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="questionnaire" className="space-y-4">
          <EstimateQuestionnaire estimateId={selectedEstimate.id} onEstimateApplied={(estimate) => applyEstimate(estimate as EstimateRecord)} />
        </TabsContent>
        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4" />Client Delivery Preflight</CardTitle>
              <CardDescription>Client export and client send stay blocked until the estimate content is commercially ready, not just visually polished.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <div className={`rounded-2xl border px-4 py-4 ${selectedPreflight.contentReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Content Readiness</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedPreflight.contentReady ? 'Clean for client review' : `${selectedPreflight.blockingIssues.length} blocking issue${selectedPreflight.blockingIssues.length === 1 ? '' : 's'} remaining`}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-4 ${selectedEstimate.humanApprovedForClientExport ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Client Export Gate</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedEstimate.humanApprovedForClientExport ? 'Manual approval recorded' : 'Approval still pending'}</p>
                </div>
                <div className={`rounded-2xl border px-4 py-4 ${selectedEstimate.humanApprovedForSend ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Send Gate</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{selectedEstimate.humanApprovedForSend ? 'Manual send approval recorded' : 'Send approval still pending'}</p>
                </div>
              </div>

              {selectedPreflight.blockingIssues.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <TriangleAlert className="size-4" />
                    Resolve these blockers before client export or send
                  </div>
                  {selectedPreflight.blockingIssues.map((issue) => (
                    <div key={issue.code} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="font-medium text-amber-950">{issue.title}</p>
                      <p className="mt-1 text-sm text-amber-900">{issue.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                  Client-facing preflight is clean. The estimate content is ready for approval-driven export and delivery.
                </div>
              )}

              {selectedPreflight.warnings.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Clock className="size-4" />
                    Advisory warnings
                  </div>
                  {selectedPreflight.warnings.map((issue) => (
                    <div key={issue.code} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="font-medium text-slate-900">{issue.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{issue.description}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4" />Manual Approval Gates</CardTitle><CardDescription>No client export or send is approved automatically.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Client Export Approval</p><p className="text-sm text-muted-foreground">Required before a client-facing PDF can be exported or sent.</p></div><Button variant={selectedEstimate.humanApprovedForClientExport ? 'secondary' : 'default'} onClick={() => void updateApproval('client', !selectedEstimate.humanApprovedForClientExport)}>{selectedEstimate.humanApprovedForClientExport ? 'Revoke Client Export Approval' : 'Approve for Client Export'}</Button></div></div>
                <div className="rounded-2xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">Send Approval</p><p className="text-sm text-muted-foreground">Required before email delivery with secure tracking links can be sent.</p></div><Button variant={selectedEstimate.humanApprovedForSend ? 'secondary' : 'default'} onClick={() => void updateApproval('send', !selectedEstimate.humanApprovedForSend)}>{selectedEstimate.humanApprovedForSend ? 'Revoke Send Approval' : 'Approve for Send'}</Button></div></div>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void exportEstimate(clientVersion)} disabled={exportingVersion !== null || !selectedPreflight.readyForClientExport} className="gap-2">{exportingVersion === clientVersion ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}Export {getDocumentVersionLabel(clientVersion)}</Button>
                  <Button variant="outline" onClick={() => void exportEstimate('internal_review')} disabled={exportingVersion !== null} className="gap-2">{exportingVersion === 'internal_review' ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}Export Internal Review PDF</Button>
                </div>
                <p className="text-sm text-muted-foreground">{clientExportBlockedReason || 'Client export is clear. Internal review export remains available even while client blockers are open.'}</p>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950"><div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><p>Portal views and secure downloads are stronger open signals. Pixel opens are inferential only and may be affected by image blocking, privacy features, or caching.</p></div></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="size-4" />Send Estimate</CardTitle><CardDescription>Creates a send record, secure token, secure view URL, secure download URL, and optional tracking pixel.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Recipient Name</Label><Input value={sendForm.recipientName} onChange={(event) => setSendForm({ ...sendForm, recipientName: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Recipient Email</Label><Input value={sendForm.recipientEmail} onChange={(event) => setSendForm({ ...sendForm, recipientEmail: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Document Version</Label><Select value={sendForm.documentVersion} onValueChange={(value) => setSendForm({ ...sendForm, documentVersion: value as EstimateDocumentVersion })}><SelectTrigger className="w-full"><SelectValue placeholder="Select version" /></SelectTrigger><SelectContent><SelectItem value={clientVersion}>{getDocumentVersionLabel(clientVersion)}</SelectItem><SelectItem value="internal_review">Internal Review PDF</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Sent By Name</Label><Input value={sendForm.sentByName} onChange={(event) => setSendForm({ ...sendForm, sentByName: event.target.value })} /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Sent By Email</Label><Input value={sendForm.sentByEmail} onChange={(event) => setSendForm({ ...sendForm, sentByEmail: event.target.value })} /></div>
                </div>
                <Button onClick={sendEstimate} disabled={sending || !sendForm.recipientEmail.trim() || !canSendSelectedVersion} className="w-full gap-2">{sending ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}Send Secure Estimate</Button>
                <p className="text-sm text-muted-foreground">{!sendForm.recipientEmail.trim() ? 'Recipient email is required before sending.' : selectedSendBlockedReason || 'This document version is clear to send.'}</p>
                {lastSendLinks ? <div className="space-y-3 rounded-2xl border bg-slate-50 p-4 text-sm">{lastSendLinks.secureViewUrl ? <a href={lastSendLinks.secureViewUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline"><ExternalLink className="size-4" />Secure portal view</a> : null}{lastSendLinks.secureDownloadUrl ? <a href={lastSendLinks.secureDownloadUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline"><Download className="size-4" />Secure download link</a> : null}<p className="text-xs text-muted-foreground">{lastSendLinks.pixelUrl ? 'Tracking pixel prepared for the email HTML body.' : 'Tracking pixel disabled.'}</p></div> : null}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4" />Delivery History</CardTitle><CardDescription>Every send keeps its own recipient, version, secure link, and open count.</CardDescription></CardHeader>
            <CardContent>{selectedEstimate.sends.length === 0 ? <p className="text-sm text-muted-foreground">No estimate deliveries have been sent yet.</p> : <ScrollArea className="max-h-[360px]"><Table><TableHeader><TableRow><TableHead>Sent At</TableHead><TableHead>Recipient</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Open Count</TableHead><TableHead>Last Opened</TableHead><TableHead>View Link</TableHead></TableRow></TableHeader><TableBody>{selectedEstimate.sends.map((send) => <TableRow key={send.id}><TableCell>{formatDateTime(send.sentAt)}</TableCell><TableCell><div><p className="font-medium">{send.recipientName || 'Recipient'}</p><p className="text-xs text-muted-foreground">{send.recipientEmail}</p></div></TableCell><TableCell>{getDocumentVersionLabel(send.documentVersion)}</TableCell><TableCell>{send.status}</TableCell><TableCell>{send.openCount}</TableCell><TableCell>{formatDateTime(send.lastOpenedAt)}</TableCell><TableCell>{send.secureViewUrl ? <a href={send.secureViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline"><ExternalLink className="size-3.5" />Open</a> : '—'}</TableCell></TableRow>)}</TableBody></Table></ScrollArea>}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">First Opened</p><p className="mt-2 text-sm font-medium">{formatDateTime(selectedEstimate.firstOpenedAt)}</p></div><Eye className="size-5 text-slate-500" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last Opened</p><p className="mt-2 text-sm font-medium">{formatDateTime(selectedEstimate.lastOpenedAt)}</p></div><Clock className="size-5 text-slate-500" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notification Events</p><p className="mt-2 text-sm font-medium">{selectedEstimate.sends.reduce((sum, send) => sum + send.notificationEvents.length, 0)}</p></div><Mail className="size-5 text-slate-500" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tracking Methods</p><p className="mt-2 text-sm font-medium">Portal, pixel, download</p></div><Shield className="size-5 text-slate-500" /></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Eye className="size-4" />Open Events</CardTitle><CardDescription>Each open is recorded separately. Repeated opens generate separate notification events by default.</CardDescription></CardHeader>
            <CardContent>{openEvents.length === 0 ? <p className="text-sm text-muted-foreground">No open events recorded yet.</p> : <ScrollArea className="max-h-[360px]"><Table><TableHeader><TableRow><TableHead>Opened At</TableHead><TableHead>Event Type</TableHead><TableHead>Recipient</TableHead><TableHead>Open Count</TableHead><TableHead>User Agent</TableHead><TableHead>Tracking Note</TableHead></TableRow></TableHeader><TableBody>{openEvents.map((event) => <TableRow key={event.id}><TableCell>{formatDateTime(event.openedAt)}</TableCell><TableCell><div className="space-y-1"><Badge variant="outline">{event.eventType}</Badge><p className="text-xs text-muted-foreground">{event.sourceType || 'unknown source'}</p></div></TableCell><TableCell>{event.recipientEmail}</TableCell><TableCell>{event.openCountAtEvent}</TableCell><TableCell className="max-w-[240px] truncate">{event.userAgent || 'Not captured'}</TableCell><TableCell className="max-w-[260px] whitespace-normal text-xs text-muted-foreground">{event.sourceType === 'pixel' || event.eventType === 'pixel_open' ? 'Pixel tracking is inferential only and may be affected by image blocking, privacy tools, or caching.' : event.sourceType === 'download' ? 'Tracked from a secure download link.' : 'Tracked from a secure portal view.'}</TableCell></TableRow>)}</TableBody></Table></ScrollArea>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" />Activity Log</CardTitle><CardDescription>Status changes, sends, opens, and notification emails are recorded here.</CardDescription></CardHeader>
            <CardContent>{activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : <div className="space-y-3">{activity.map((event) => <div key={event.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-900">{event.title}</p><Badge variant="outline">{event.activityType}</Badge></div>{event.description ? <p className="mt-2 text-sm text-slate-600">{event.description}</p> : null}</div><p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p></div></div>)}</div>}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
