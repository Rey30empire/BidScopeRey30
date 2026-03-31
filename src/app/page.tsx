'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useProjectStore, type ProjectData, type FileData, type AnalysisData } from '@/store/project-store'
import { TRADE_OPTIONS, DOCUMENT_CATEGORIES, ANALYSIS_STEPS, CATEGORY_COLORS } from '@/lib/constants'
import { APP_NAME, APP_SUMMARY, APP_TAGLINE } from '@/lib/branding'
import { EstimateWorkbench } from '@/components/estimate/estimate-workbench'

// ── shadcn/ui ──────────────────────────────────────────────────────────────
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// ── Lucide icons ───────────────────────────────────────────────────────────
import {
  Plus, Trash2, FileText, Upload, ArrowLeft, ArrowRight, Loader2,
  Building2, MapPin, Calendar, Users, HardHat, Search, Filter,
  Download, RefreshCw, Sun, Moon, FolderOpen, X, Check,
  AlertTriangle, Clock, FileCheck, FileX, FilePlus, BookOpen, Zap,
  Mountain, Flame, ClipboardList, MessageSquare, Archive, Tags,
  ChevronRight, ExternalLink, File, BarChart3, Shield,
  Target, TrendingUp, CircleDot, Info, MoreVertical,
  Construction, Hammer, Ruler, Briefcase, FolderSync,
  FileSpreadsheet, ImageIcon, FileDown, ChevronDown,
  CircleCheckBig, TriangleAlert, CircleX, Lightbulb,
  Wrench, Activity, DollarSign, Scale, Layers, Package,
  CheckCircle2, XCircle, Eye, FileSearch
} from 'lucide-react'

// ── Animation variants ─────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}
const pageTransition = { duration: 0.25, ease: 'easeInOut' as const }
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}
const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    }

    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return dateStr
  }
}

function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr

  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return ''

  return parsed.toISOString().slice(0, 10)
}

function deriveProjectNameFromFiles(files: File[]): string {
  const firstFolderPath = files.find((file) => file.webkitRelativePath)?.webkitRelativePath
  if (firstFolderPath) {
    const folderName = firstFolderPath.split('/').filter(Boolean)[0]
    if (folderName) {
      return folderName
    }
  }

  const zipFile = files.find((file) => file.name.toLowerCase().endsWith('.zip'))
  if (zipFile) {
    return zipFile.name.replace(/\.[^.]+$/, '')
  }

  if (files.length === 1) {
    return files[0].name.replace(/\.[^.]+$/, '')
  }

  return `Bid Intake ${new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

function parseJSON<T>(str: string | null | undefined): T | null {
  if (!str) return null
  try {
    return JSON.parse(str) as T
  } catch {
    return null
  }
}

function getStatusBadge(status: string | undefined) {
  switch (status) {
    case 'complete':
      return <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700 border-transparent">Complete</Badge>
    case 'analyzing':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-transparent">Analyzing</Badge>
    case 'error':
      return <Badge variant="destructive">Error</Badge>
    case 'uploading':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-transparent">Uploading</Badge>
    default:
      return <Badge variant="outline">Draft</Badge>
  }
}

function getFileIcon(fileType: string) {
  const t = fileType.toLowerCase()
  if (t === 'pdf') return <FileText className="size-5 text-red-500" />
  if (t === 'docx' || t === 'doc') return <FileText className="size-5 text-blue-500" />
  if (t === 'xlsx' || t === 'xls' || t === 'csv') return <FileSpreadsheet className="size-5 text-emerald-500" />
  if (t === 'zip') return <Archive className="size-5 text-amber-500" />
  if (['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'webp'].includes(t)) return <ImageIcon className="size-5 text-purple-500" />
  if (t === 'txt') return <FileText className="size-5 text-gray-500" />
  return <File className="size-5 text-muted-foreground" />
}

function getCategoryBadge(category: string | null | undefined) {
  if (!category) return null
  const cat = DOCUMENT_CATEGORIES.find((c) => c.value === category)
  const label = cat?.label ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const colorClass = CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function getLikelihoodColor(likelihood: string) {
  switch (likelihood) {
    case 'very_likely': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    case 'likely': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
    case 'possible': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    case 'unlikely': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
    case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

function getConfidenceColor(confidence: number | null | undefined) {
  if (!confidence) return 'text-muted-foreground'
  if (confidence >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (confidence >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getConfidenceLabel(confidence: number | null | undefined) {
  if (!confidence) return 'Unknown'
  if (confidence >= 80) return 'High'
  if (confidence >= 60) return 'Medium'
  return 'Low'
}

// ── Types for parsed analysis ──────────────────────────────────────────────
interface RiskItem {
  id?: string; category?: string; description?: string; severity?: string;
  likelihood?: string; impact?: string; mitigation?: string; source?: string;
}
interface RFISuggestion {
  id?: string; question?: string; reason?: string; referenceDoc?: string;
  referenceSheet?: string; priority?: string; category?: string;
}
interface TimeEstimate {
  totalHours?: number; totalDays?: number; crewSize?: number;
  phases?: Array<{ name?: string; hours?: number; days?: number; crew?: number; description?: string }>;
  risks?: string[]; assumptions?: string[];
}
interface MaterialInsight {
  name: string; category?: string; estimatedQty?: number; unit?: string; notes?: string;
}
interface RelevantSheet {
  sheetNumber?: string; sheetTitle?: string; fileName?: string;
  reason?: string; confidence?: number; elements?: string[];
}

interface ExecutiveSummaryData {
  project?: string
  client?: string
  location?: string
  trade?: string
  probableScope?: string
  totalFiles?: number
  relevantFiles?: number
  keyDocuments?: string[]
  keySheets?: Array<{ sheetNumber?: string; sheetTitle?: string; fileName?: string; reason?: string; confidence?: number }>
  importantDates?: Array<{ label: string; date: string }>
  materialsDetected?: Array<{ name: string; category?: string; estimatedQty?: number; unit?: string; notes?: string }>
  risks?: Array<{ id?: string; category?: string; description?: string; severity?: string; likelihood?: string; impact?: string; mitigation?: string }>
  rfis?: Array<{ id?: string; question?: string; reason?: string; referenceDoc?: string; referenceSheet?: string; priority?: string; category?: string }>
  timeEstimate?: { totalHours?: number; totalDays?: number; crewSize?: number; phases?: Array<{ name?: string; hours?: number; days?: number; crew?: number; description?: string }>; risks?: string[]; assumptions?: string[] }
  nextSteps?: string[]
  confidence?: number
  inclusions?: string[]
  exclusions?: string[]
}

interface ScopeAnalysisData {
  probableScope?: string
  inclusions?: string[]
  exclusions?: string[]
  keySpecs?: string[]
  relevantSheets?: Array<{ sheetNumber?: string; sheetTitle?: string; fileName?: string; reason?: string; confidence?: number; elements?: string[] }>
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header() {
  const { currentStep, setStep, currentProject } = useProjectStore()
  const { setTheme, resolvedTheme } = useTheme()

  const showBack = currentStep !== 'list'

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                if (currentStep === 'results' || currentStep === 'processing') {
                  setStep('list')
                } else if (currentStep === 'trade') {
                  setStep('upload')
                } else if (currentStep === 'upload') {
                  setStep('list')
                } else {
                  setStep('list')
                }
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <HardHat className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            suppressHydrationWarning
          >
            <Sun className="size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
            <Moon className="absolute size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
          </Button>
        </div>
      </div>
    </header>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-xs text-muted-foreground sm:px-6">
        <span>&copy; {new Date().getFullYear()} {APP_NAME}. {APP_TAGLINE}</span>
        <span className="flex items-center gap-1">
          <HardHat className="size-3" /> Construction Bid Analysis
        </span>
      </div>
    </footer>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 1: Project List
// ══════════════════════════════════════════════════════════════════════════
function ProjectListView() {
  const { projects, setProjects, setCurrentProject, setStep, removeProject } = useProjectStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) throw new Error('Failed to fetch projects')
        const data = await res.json()
        setProjects(data)
      } catch (err) {
        toast.error('Could not load projects')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [setProjects])

  const handleViewProject = (project: ProjectData) => {
    setCurrentProject(project)
    if (project.status === 'processing') {
      setStep('processing')
      return
    }

    setStep(project.analysis ? 'results' : 'upload')
  }

  const handleNewIntake = () => {
    setCurrentProject(null)
    setStep('upload')
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      removeProject(id)
      toast.success('Project deleted')
    } catch {
      toast.error('Could not delete project')
    }
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Upload a bid package and let the intake pipeline fill the project for you</p>
        </div>
        <Button onClick={handleNewIntake} className="gap-2">
          <Plus className="size-4" />
          New Intake
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20"
        >
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="size-8 text-muted-foreground" />
          </div>
          <h2 className="mb-1 text-lg font-semibold">No projects yet</h2>
          <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
            {APP_SUMMARY}
          </p>
          <Button onClick={handleNewIntake} className="gap-2">
            <Plus className="size-4" />
            Start Intake
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-2"
        >
          {projects.map((project) => (
            <motion.div key={project.id} variants={staggerItem}>
              <Card className="group cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleViewProject(project)}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{project.name}</span>
                      {getStatusBadge(project.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {project.client && (
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3.5" /> {project.client}
                        </span>
                      )}
                      {project.trade && (
                        <span className="flex items-center gap-1">
                          <Wrench className="size-3.5" /> {project.trade.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" /> {formatDate(project.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <File className="size-3.5" /> {project.files?.length ?? 0} files
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.status === 'complete' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewProject(project)
                        }}
                        className="gap-1"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete &quot;{project.name}&quot;?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the project and all associated files and analysis data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(project.id)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 2: Create Project
// ══════════════════════════════════════════════════════════════════════════
function CreateProjectView() {
  const { setStep, addProject, setCurrentProject } = useProjectStore()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    client: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    projectSize: '',
    bidDueDate: '',
    rfiDueDate: '',
    notes: '',
  })

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Project name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          client: form.client.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zip: form.zip.trim() || null,
          projectSize: form.projectSize.trim() || null,
          bidDueDate: form.bidDueDate || null,
          rfiDueDate: form.rfiDueDate || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create project')
      }
      const project = await res.json()
      addProject(project)
      setCurrentProject(project)
      toast.success('Project created')
      setStep('upload')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-sm text-muted-foreground">Enter project details to get started</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-5 p-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Riverside Medical Center"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label htmlFor="client">Client / General Contractor</Label>
              <Input
                id="client"
                placeholder="e.g. Turner Construction"
                value={form.client}
                onChange={(e) => updateField('client', e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    placeholder="Street address"
                    value={form.address}
                    onChange={(e) => updateField('address', e.target.value)}
                  />
                </div>
                <Input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="State"
                    value={form.state}
                    onChange={(e) => updateField('state', e.target.value)}
                  />
                  <Input
                    placeholder="ZIP"
                    value={form.zip}
                    onChange={(e) => updateField('zip', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Project Size & Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="size">Project Size (sq ft)</Label>
                <Input
                  id="size"
                  placeholder="e.g. 50000"
                  value={form.projectSize}
                  onChange={(e) => updateField('projectSize', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bidDue">Bid Due Date</Label>
                <Input
                  id="bidDue"
                  type="date"
                  value={form.bidDueDate}
                  onChange={(e) => updateField('bidDueDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfiDue">RFI Due Date</Label>
                <Input
                  id="rfiDue"
                  type="date"
                  value={form.rfiDueDate}
                  onChange={(e) => updateField('rfiDueDate', e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this project..."
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setStep('list')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create &amp; Upload Files
              <ArrowRight className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      </form>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 3: Upload Files
// ══════════════════════════════════════════════════════════════════════════
function UploadFilesView() {
  const {
    currentProject,
    addProject,
    setCurrentProject,
    updateCurrentProject,
    updateProjectFiles,
    setStep,
    setIsAnalyzing,
  } = useProjectStore()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [stageMessage, setStageMessage] = useState('Drop a bid package to begin')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const files = currentProject?.files ?? []

  useEffect(() => {
    const folderInput = folderInputRef.current
    if (!folderInput) return

    folderInput.setAttribute('webkitdirectory', '')
    folderInput.setAttribute('directory', '')
  }, [])

  const ensureProject = async (filesArr: File[]) => {
    if (currentProject) {
      return currentProject
    }

    setStageMessage('Creating an intake workspace...')

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: deriveProjectNameFromFiles(filesArr),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Could not create the intake workspace')
    }

    const project = await res.json()
    addProject(project)
    setCurrentProject(project)
    return project as ProjectData
  }

  const refreshProject = async (projectId: string) => {
    const projectRes = await fetch(`/api/projects/${projectId}`)
    if (!projectRes.ok) {
      return null
    }

    const updated = await projectRes.json()
    updateCurrentProject(updated)
    updateProjectFiles(projectId, updated.files ?? [])
    return updated as ProjectData
  }

  const startAutomaticAnalysis = async (projectId: string) => {
    setStageMessage('Launching the hidden analysis pipeline...')

    const res = await fetch(`/api/projects/${projectId}/analyze`, {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data.error || 'Could not start automatic analysis')
    }

    updateCurrentProject({ status: 'processing' })
    setIsAnalyzing(true)
    setStep('processing')
    toast.success('Files received. BitScopeRey30 is filling the project automatically.')
  }

  const uploadFiles = async (fileList: FileList | File[]) => {
    const filesArr = Array.from(fileList)
    if (filesArr.length === 0) return

    setUploading(true)
    setUploadProgress(8)

    try {
      const projectForUpload = await ensureProject(filesArr)

      // Upload all files in a single request
      const formData = new FormData()
      for (const file of filesArr) {
        formData.append('files', file)
      }

      setStageMessage('Uploading files and unpacking archives...')
      setUploadProgress(28)

      const res = await fetch(`/api/projects/${projectForUpload.id}/files`, {
        method: 'POST',
        body: formData,
      })

      setUploadProgress(72)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }

      setStageMessage('Refreshing project intake...')
      setUploadProgress(88)
      await refreshProject(projectForUpload.id)

      setUploadProgress(100)
      await startAutomaticAnalysis(projectForUpload.id)
    } catch (error) {
      setIsAnalyzing(false)
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      setStageMessage('Drop a bid package to begin')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Start Intake</h1>
        <p className="text-sm text-muted-foreground">
          Upload a ZIP, folder, or bid files. The app will classify documents, infer trade and dates, and build the project automatically.
        </p>
      </div>

      <Card className="mb-6 border-dashed">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {currentProject?.name
              ? `Continuing intake for ${currentProject.name}.`
              : 'No manual setup is required before upload.'}
          </p>
          <p>
            Drop the package first. BitScopeRey30 will parse the documents behind the scenes, fill the project fields, and send you to review only after the pipeline finishes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-4" />
              Choose Files / ZIP
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
            >
              <FolderSync className="size-4" />
              Choose Folder
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      <div
        className={`relative mb-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.csv,.txt,.zip,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-muted">
          <Upload className="size-7 text-muted-foreground" />
        </div>
        <p className="mb-1 text-sm font-medium">
          {dragOver ? 'Drop the package here' : 'Drag & drop a ZIP or bid files'}
        </p>
        <p className="text-xs text-muted-foreground">
          Supports PDF, DOCX, XLSX, CSV, TXT, ZIP, and images. Use the folder button for a full directory upload.
        </p>

        {uploading && (
          <div className="mt-4 w-full max-w-xs">
            <Progress value={uploadProgress} className="h-2" />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {stageMessage} {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Uploaded Files ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    {getFileIcon(file.fileType)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.originalName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.fileSize)}</span>
                        {file.category && getCategoryBadge(file.category)}
                        {file.isProcessed && (
                          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3" /> Processed
                          </span>
                        )}
                        {file.error && (
                          <span className="flex items-center gap-0.5 text-destructive">
                            <AlertTriangle className="size-3" /> {file.error}
                          </span>
                        )}
                      </div>
                    </div>
                    {file.relevanceScore !== null && file.relevanceScore !== undefined && (
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Target className="size-3" />
                        {Math.round(file.relevanceScore * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={() => setStep('list')} className="gap-2">
          <ArrowLeft className="size-4" />
          Back to Projects
        </Button>
        <p className="max-w-sm text-right text-xs text-muted-foreground">
          If the pipeline misses a field, you can edit it on the review screen after analysis finishes.
        </p>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 4: Trade Selection
// ══════════════════════════════════════════════════════════════════════════
function TradeSelectionView() {
  const { currentProject, updateCurrentProject, setStep, setIsAnalyzing } = useProjectStore()
  const [selectedTrade, setSelectedTrade] = useState<string | null>(currentProject?.trade ?? null)
  const [customTrade, setCustomTrade] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  if (!currentProject) return null

  const handleAnalyze = async () => {
    const trade = selectedTrade === 'custom' ? customTrade.trim() : selectedTrade
    if (!trade) {
      toast.error('Please select a trade')
      return
    }

    setAnalyzing(true)
    setIsAnalyzing(true)

    try {
      // Update project with trade selection
      await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade }),
      })
      updateCurrentProject({ ...currentProject, trade })

      // Start analysis
      const res = await fetch(`/api/projects/${currentProject.id}/analyze`, {
        method: 'POST',
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to start analysis')
      }

      toast.success('Analysis started')
      setStep('processing')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start analysis')
      setIsAnalyzing(false)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Select Trade</h1>
        <p className="text-sm text-muted-foreground">
          Choose your trade to focus the analysis on relevant scope items
        </p>
      </div>

      {/* Project Info */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
          <span className="font-semibold">{currentProject.name}</span>
          {currentProject.client && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="size-3.5" /> {currentProject.client}
              </span>
            </>
          )}
          {currentProject.files && currentProject.files.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <File className="size-3.5" /> {currentProject.files.length} files
              </span>
            </>
          )}
        </CardContent>
      </Card>

      {/* Trade Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {TRADE_OPTIONS.map((trade) => (
          <motion.div key={trade.value} variants={staggerItem}>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTrade === trade.value
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'hover:border-primary/30'
              }`}
              onClick={() => setSelectedTrade(trade.value)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    selectedTrade === trade.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {selectedTrade === trade.value ? (
                    <Check className="size-5" />
                  ) : (
                    <Wrench className="size-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium leading-tight">{trade.label}</p>
                  {trade.keywords.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {trade.keywords.slice(0, 5).join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Custom Trade */}
      <Card
        className={`mt-3 cursor-pointer transition-all hover:shadow-md ${
          selectedTrade === 'custom'
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
            : 'hover:border-primary/30'
        }`}
        onClick={() => setSelectedTrade('custom')}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              selectedTrade === 'custom'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Hammer className="size-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Custom Trade</p>
            {selectedTrade === 'custom' && (
              <Input
                placeholder="Enter your trade..."
                value={customTrade}
                onChange={(e) => setCustomTrade(e.target.value)}
                className="mt-2"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={() => setStep('upload')} className="gap-2">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !selectedTrade || (selectedTrade === 'custom' && !customTrade.trim())}
          className="gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <FileSearch className="size-4" />
              Analyze Bid Package
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 5: Processing
// ══════════════════════════════════════════════════════════════════════════
function ProcessingView() {
  const { currentProject, setStep, setIsAnalyzing, updateCurrentProject, updateProjectAnalysis } = useProjectStore()
  const [progress, setProgress] = useState({ status: 'idle', progress: 0, message: '' })
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!currentProject) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${currentProject.id}/analyze`)
        if (!res.ok) throw new Error('Failed to get status')

        const data = await res.json()
        setProgress({
          status: data.status ?? 'idle',
          progress: data.progress ?? 0,
          message: data.message ?? '',
        })

        if (data.status === 'complete') {
          if (pollRef.current) clearInterval(pollRef.current)
          setIsAnalyzing(false)

          // Fetch full project data with analysis
          const projectRes = await fetch(`/api/projects/${currentProject.id}`)
          if (projectRes.ok) {
            const fullProject = await projectRes.json()
            updateCurrentProject(fullProject)
            if (fullProject.analysis) {
              updateProjectAnalysis(currentProject.id, fullProject.analysis)
            }
          }
          setStep('results')
          toast.success('Analysis complete!')
        } else if (data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          setIsAnalyzing(false)
          setError(data.error || data.message || 'Analysis failed')
        }
      } catch {
        // Continue polling on error
      }
    }

    // Initial poll
    poll()
    // Poll every 3 seconds
    pollRef.current = setInterval(poll, 3000)
    startTimeRef.current = Date.now()

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [currentProject, setStep, setIsAnalyzing, updateCurrentProject, updateProjectAnalysis])

  const currentStepIndex = ANALYSIS_STEPS.findIndex((s) => s.key === progress.status)
  const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
  const estimatedTotal = progress.progress > 0 ? Math.round((elapsed / progress.progress) * 100) : 120
  const remaining = Math.max(0, estimatedTotal - elapsed)

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    if (m > 0) return `~${m}m ${s}s`
    return `~${s}s`
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">Analyzing Bid Package</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {progress.message || 'Starting analysis...'}
        </p>

        {error ? (
          <Card className="w-full border-destructive/50">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center justify-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                <span className="font-semibold">Analysis Failed</span>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => setStep('list')} variant="outline" className="gap-2">
                <ArrowLeft className="size-4" />
                Back to Projects
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="mb-6 w-full">
              <Progress value={progress.progress} className="h-3" />
              <p className="mt-2 text-sm text-muted-foreground">
                {Math.round(progress.progress)}% complete
              </p>
            </div>

            {/* Steps */}
            <div className="w-full space-y-3 text-left">
              {ANALYSIS_STEPS.map((step, index) => {
                const isActive = step.key === progress.status
                const isDone = currentStepIndex > index || progress.status === 'complete'
                const isPending = !isDone && !isActive

                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                      isActive
                        ? 'bg-primary/5 text-primary'
                        : isDone
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border">
                      {isDone ? (
                        <Check className="size-4" />
                      ) : isActive ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Estimated Time */}
            <p className="mt-6 text-xs text-muted-foreground">
              Estimated time remaining: {formatTime(remaining)}
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// VIEW 6: Results
// ══════════════════════════════════════════════════════════════════════════

// ── Helper: parse analysis fields ──────────────────────────────────────────
function useParsedAnalysis(analysis: AnalysisData | null | undefined) {
  return useMemo(() => {
    if (!analysis) return { summary: null, scope: null, risks: [], rfis: [], time: null, materials: [], sheets: [] }
    return {
      summary: parseJSON<ExecutiveSummaryData>(analysis.executiveSummary),
      scope: parseJSON<ScopeAnalysisData>(analysis.scopeAnalysis),
      risks: parseJSON<Array<RiskItem>>(analysis.riskItems) ?? [],
      rfis: parseJSON<Array<RFISuggestion>>(analysis.rfiSuggestions) ?? [],
      time: parseJSON<TimeEstimate>(analysis.timeEstimate),
      materials: parseJSON<Array<MaterialInsight>>(analysis.materials) ?? [],
      sheets: parseJSON<Array<RelevantSheet>>(analysis.relevantSheets) ?? [],
    }
  }, [analysis])
}

// ── Tab 1: Executive Summary ──────────────────────────────────────────────
function ExecutiveSummaryTab({ project, analysis }: { project: ProjectData; analysis: AnalysisData }) {
  const { summary } = useParsedAnalysis(analysis)

  const totalFiles = project.files?.length ?? 0
  const relevantFiles = project.files?.filter((f) => f.isRelevant).length ?? 0
  const riskCount = summary?.risks?.length ?? 0
  const rfiCount = summary?.rfis?.length ?? 0
  const confidence = summary?.confidence ?? analysis.confidence ?? null

  return (
    <div className="space-y-6">
      {/* Project Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="size-4" />
            Project Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem icon={<FileText className="size-4" />} label="Project" value={project.name} />
            <InfoItem icon={<Building2 className="size-4" />} label="Client" value={project.client} />
            <InfoItem
              icon={<MapPin className="size-4" />}
              label="Location"
              value={[project.address, project.city, project.state, project.zip].filter(Boolean).join(', ') || '—'}
            />
            <InfoItem
              icon={<Wrench className="size-4" />}
              label="Trade"
              value={analysis.trade ?? project.trade ?? '—'}
            />
            <InfoItem icon={<Calendar className="size-4" />} label="Bid Due" value={formatDate(project.bidDueDate)} />
            <InfoItem icon={<Calendar className="size-4" />} label="RFI Due" value={formatDate(project.rfiDueDate)} />
          </div>
        </CardContent>
      </Card>

      {/* Confidence & Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <Target className="mb-2 size-8 text-primary" />
            <span className="text-3xl font-bold">{confidence !== null ? `${Math.round(confidence)}%` : '—'}</span>
            <span className={`text-sm font-medium ${getConfidenceColor(confidence)}`}>
              {getConfidenceLabel(confidence)} Confidence
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <File className="mb-2 size-8 text-blue-500" />
            <span className="text-3xl font-bold">{summary?.totalFiles ?? totalFiles}</span>
            <span className="text-sm text-muted-foreground">Total Files</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <FileCheck className="mb-2 size-8 text-emerald-500" />
            <span className="text-3xl font-bold">{summary?.relevantFiles ?? relevantFiles}</span>
            <span className="text-sm text-muted-foreground">Relevant Files</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <Shield className="mb-2 size-8 text-amber-500" />
            <span className="text-3xl font-bold">{riskCount}</span>
            <span className="text-sm text-muted-foreground">Risks &amp; {rfiCount} RFIs</span>
          </CardContent>
        </Card>
      </div>

      {/* Scope Overview */}
      {summary?.probableScope && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4" />
              Probable Scope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {summary.probableScope}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Documents */}
      {summary?.keyDocuments && summary.keyDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" />
              Key Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.keyDocuments.map((doc, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CircleCheckBig className="size-4 shrink-0 text-emerald-500" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Inclusions / Exclusions */}
      {(summary?.inclusions?.length || summary?.exclusions?.length) ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {summary?.inclusions && summary.inclusions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Inclusions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {summary.inclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {summary?.exclusions && summary.exclusions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                  <XCircle className="size-4" />
                  Exclusions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {summary.exclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <X className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Next Steps */}
      {summary?.nextSteps && summary.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4" />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {summary.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Tab 2: Scope Analysis ─────────────────────────────────────────────────
function ScopeAnalysisTab({ project, analysis }: { project: ProjectData; analysis: AnalysisData }) {
  const { summary, scope } = useParsedAnalysis(analysis)
  const files = project.files ?? []

  const scopeText = scope?.probableScope ?? summary?.probableScope ?? null
  const inclusions = scope?.inclusions ?? summary?.inclusions ?? []
  const exclusions = scope?.exclusions ?? summary?.exclusions ?? []
  const keySpecs = scope?.keySpecs ?? []
  const relevantSheets = scope?.relevantSheets ?? summary?.keySheets ?? []

  // Files sorted by relevance
  const sortedFiles = [...files].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))

  return (
    <div className="space-y-6">
      {/* Probable Scope */}
      {scopeText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="size-4" />
              Probable Scope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {scopeText}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inclusions / Exclusions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {inclusions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                Inclusions ({inclusions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-72">
                <ul className="space-y-1.5">
                  {inclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        {exclusions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                <XCircle className="size-4" />
                Exclusions ({exclusions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-72">
                <ul className="space-y-1.5">
                  {exclusions.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <X className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Key Specifications */}
      {keySpecs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4" />
              Key Specifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <ul className="space-y-2">
                {keySpecs.map((spec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Ruler className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Relevant Sheets */}
      {relevantSheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" />
              Relevant Sheets ({relevantSheets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {relevantSheets.map((sheet, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary/10">
                      <Layers className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{sheet.sheetNumber ?? `Sheet ${i + 1}`}</span>
                        <span className="text-sm text-muted-foreground">&mdash; {sheet.sheetTitle ?? 'Untitled'}</span>
                      </div>
                      {sheet.fileName && (
                        <p className="text-xs text-muted-foreground">{sheet.fileName}</p>
                      )}
                      {sheet.reason && (
                        <p className="mt-1 text-xs text-muted-foreground">{sheet.reason}</p>
                      )}
                      {sheet.confidence !== undefined && sheet.confidence !== null && (
                        <div className="mt-1 flex items-center gap-1">
                          <Target className="size-3 text-muted-foreground" />
                          <span className={`text-xs font-medium ${getConfidenceColor(sheet.confidence * 100)}`}>
                            {Math.round(sheet.confidence * 100)}% relevant
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Files Ranked by Relevance */}
      {sortedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" />
              Files Ranked by Relevance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {sortedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {getFileIcon(file.fileType)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.originalName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span>
                        {file.category && getCategoryBadge(file.category)}
                      </div>
                    </div>
                    {file.relevanceScore !== null && file.relevanceScore !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.round(file.relevanceScore * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {Math.round(file.relevanceScore * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Tab 3: Documents ──────────────────────────────────────────────────────
function DocumentsTab({ project }: { project: ProjectData }) {
  const files = project.files ?? []
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    files.forEach((f) => { if (f.category) cats.add(f.category) })
    return Array.from(cats).sort()
  }, [files])

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files
      .filter((f) => {
        if (categoryFilter !== 'all' && f.category !== categoryFilter) return false
        if (search) {
          const q = search.toLowerCase()
          return f.originalName.toLowerCase().includes(q) || (f.summary?.toLowerCase().includes(q) ?? false)
        }
        return true
      })
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
  }, [files, categoryFilter, search])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => {
              const catDef = DOCUMENT_CATEGORIES.find((c) => c.value === cat)
              return (
                <option key={cat} value={cat}>{catDef?.label ?? cat}</option>
              )
            })}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredFiles.length} of {files.length} documents
      </p>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10">
            <FileX className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No documents match your filters</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <Card key={file.id} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-4">
                  {getFileIcon(file.fileType)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{file.originalName}</p>
                      {file.category && getCategoryBadge(file.category)}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.fileSize)}</span>
                      {file.relevanceScore !== null && file.relevanceScore !== undefined && (
                        <span className="flex items-center gap-1">
                          <Target className="size-3" />
                          {Math.round(file.relevanceScore * 100)}% relevant
                        </span>
                      )}
                    </div>
                    {file.summary && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                        {file.summary}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// ── Tab 4: Risk & RFIs ────────────────────────────────────────────────────
function RiskRfiTab({ project, analysis }: { project: ProjectData; analysis: AnalysisData }) {
  const { summary, risks, rfis } = useParsedAnalysis(analysis)

  const allRisks = risks.length > 0 ? risks : (summary?.risks ?? [])
  const allRfis = rfis.length > 0 ? rfis : (summary?.rfis ?? [])

  const criticalRisks = allRisks.filter((r) => r.severity === 'critical' || r.severity === 'high')
  const otherRisks = allRisks.filter((r) => r.severity !== 'critical' && r.severity !== 'high')
  const highRfis = allRfis.filter((r) => r.priority === 'high')

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <AlertTriangle className="mb-1 size-6 text-red-500" />
            <span className="text-2xl font-bold">{allRisks.length}</span>
            <span className="text-xs text-muted-foreground">Total Risks</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <TriangleAlert className="mb-1 size-6 text-orange-500" />
            <span className="text-2xl font-bold">{criticalRisks.length}</span>
            <span className="text-xs text-muted-foreground">Critical / High</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <MessageSquare className="mb-1 size-6 text-blue-500" />
            <span className="text-2xl font-bold">{allRfis.length}</span>
            <span className="text-xs text-muted-foreground">RFI Suggestions</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-4 text-center">
            <Zap className="mb-1 size-6 text-amber-500" />
            <span className="text-2xl font-bold">{highRfis.length}</span>
            <span className="text-xs text-muted-foreground">High Priority RFIs</span>
          </CardContent>
        </Card>
      </div>

      {/* Critical Risks */}
      {criticalRisks.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <TriangleAlert className="size-4" />
              Critical &amp; High Risks ({criticalRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {criticalRisks.map((risk, i) => (
                <AccordionItem key={risk.id ?? `risk-${i}`} value={`crit-${i}`} className="rounded-lg border px-4">
                  <AccordionTrigger className="text-sm">
                    <div className="flex flex-1 items-center gap-2 text-left">
                      <span className="min-w-0 flex-1 truncate">{risk.description}</span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${getSeverityColor(risk.severity ?? '')}`}>
                        {risk.severity}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Likelihood:</span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getLikelihoodColor(risk.likelihood ?? '')}`}>
                          {risk.likelihood?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {risk.category && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Category:</span>
                          <span>{risk.category}</span>
                        </div>
                      )}
                      {risk.impact && (
                        <div>
                          <span className="text-muted-foreground">Impact:</span>
                          <p className="mt-0.5">{risk.impact}</p>
                        </div>
                      )}
                      {risk.mitigation && (
                        <div>
                          <span className="text-muted-foreground">Mitigation:</span>
                          <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">{risk.mitigation}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Other Risks */}
      {otherRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4" />
              Other Risks ({otherRisks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {otherRisks.map((risk, i) => (
                <AccordionItem key={risk.id ?? `risk-${i}`} value={`other-${i}`} className="rounded-lg border px-4">
                  <AccordionTrigger className="text-sm">
                    <div className="flex flex-1 items-center gap-2 text-left">
                      <span className="min-w-0 flex-1 truncate">{risk.description}</span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${getSeverityColor(risk.severity ?? '')}`}>
                        {risk.severity}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Likelihood:</span>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${getLikelihoodColor(risk.likelihood ?? '')}`}>
                          {risk.likelihood?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {risk.impact && (
                        <div>
                          <span className="text-muted-foreground">Impact:</span>
                          <p className="mt-0.5">{risk.impact}</p>
                        </div>
                      )}
                      {risk.mitigation && (
                        <div>
                          <span className="text-muted-foreground">Mitigation:</span>
                          <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">{risk.mitigation}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* RFI Suggestions */}
      {allRfis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" />
              RFI Suggestions ({allRfis.length})
            </CardTitle>
            <CardDescription>Questions to submit to the general contractor</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {allRfis.map((rfi, i) => (
                <AccordionItem key={rfi.id ?? `rfi-${i}`} value={`rfi-${i}`} className="rounded-lg border px-4">
                  <AccordionTrigger className="text-sm">
                    <div className="flex flex-1 items-center gap-2 text-left">
                      <span className="min-w-0 flex-1">{rfi.question}</span>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${getPriorityColor(rfi.priority ?? '')}`}>
                        {rfi.priority}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">Reason:</span>
                        <p className="mt-0.5">{rfi.reason}</p>
                      </div>
                      {rfi.referenceDoc && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Reference:</span>
                          <span>{rfi.referenceDoc}</span>
                        </div>
                      )}
                      {rfi.referenceSheet && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Sheet:</span>
                          <span>{rfi.referenceSheet}</span>
                        </div>
                      )}
                      {rfi.category && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Category:</span>
                          <Badge variant="outline" className="text-xs">{rfi.category}</Badge>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {allRisks.length === 0 && allRfis.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-10">
            <Shield className="mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">No risks or RFIs identified</p>
            <p className="text-sm text-muted-foreground">The analysis did not identify significant risks or RFI suggestions.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Tab 5: Estimate ───────────────────────────────────────────────────────
function EstimateTab({ project }: { project: ProjectData; analysis: AnalysisData }) {
  return <EstimateWorkbench project={project} />
}

// ── Reusable: Info Item ───────────────────────────────────────────────────
function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value || '—'}</p>
      </div>
    </div>
  )
}

function ProjectReviewCard({
  project,
  onUpdated,
}: {
  project: ProjectData
  onUpdated: (project: Partial<ProjectData>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: project.name || project.analysis?.projectName || '',
    client: project.client || project.analysis?.client || '',
    trade: project.trade || project.analysis?.trade || '',
    address: project.address || project.analysis?.address || '',
    city: project.city || project.analysis?.city || '',
    state: project.state || project.analysis?.state || '',
    zip: project.zip || project.analysis?.zipCode || '',
    bidDueDate: toDateInputValue(project.bidDueDate || project.analysis?.bidDueDate),
    rfiDueDate: toDateInputValue(project.rfiDueDate || project.analysis?.rfiDueDate),
    notes: project.notes || '',
  })

  useEffect(() => {
    setForm({
      name: project.name || project.analysis?.projectName || '',
      client: project.client || project.analysis?.client || '',
      trade: project.trade || project.analysis?.trade || '',
      address: project.address || project.analysis?.address || '',
      city: project.city || project.analysis?.city || '',
      state: project.state || project.analysis?.state || '',
      zip: project.zip || project.analysis?.zipCode || '',
      bidDueDate: toDateInputValue(project.bidDueDate || project.analysis?.bidDueDate),
      rfiDueDate: toDateInputValue(project.rfiDueDate || project.analysis?.rfiDueDate),
      notes: project.notes || '',
    })
  }, [project])

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const patchRes = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || project.name,
          client: form.client.trim() || null,
          trade: form.trade.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zip: form.zip.trim() || null,
          bidDueDate: form.bidDueDate || null,
          rfiDueDate: form.rfiDueDate || null,
          notes: form.notes.trim() || null,
        }),
      })

      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        throw new Error(err.error || 'Could not update project details')
      }

      const projectRes = await fetch(`/api/projects/${project.id}`)
      if (!projectRes.ok) {
        throw new Error('Project updated, but refresh failed')
      }

      const refreshed = await projectRes.json()
      onUpdated(refreshed)
      setEditing(false)
      toast.success('Review fields updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update project details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Review Auto-Filled Details</CardTitle>
          <CardDescription>
            The intake pipeline filled these fields from the package. Correct anything that looks off before you export or email.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={editing ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? <X className="size-4" /> : <RefreshCw className="size-4" />}
          {editing ? 'Close Editor' : 'Edit Review Fields'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem icon={<Building2 className="size-4" />} label="Client" value={project.client || project.analysis?.client} />
            <InfoItem icon={<Wrench className="size-4" />} label="Trade" value={project.trade || project.analysis?.trade} />
            <InfoItem
              icon={<MapPin className="size-4" />}
              label="Location"
              value={[project.address || project.analysis?.address, project.city || project.analysis?.city, project.state || project.analysis?.state, project.zip || project.analysis?.zipCode]
                .filter(Boolean)
                .join(', ') || '—'}
            />
            <InfoItem icon={<Calendar className="size-4" />} label="Bid Due" value={formatDate(project.bidDueDate || project.analysis?.bidDueDate)} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="review-name">Project Name</Label>
                <Input id="review-name" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-client">Client / GC</Label>
                <Input id="review-client" value={form.client} onChange={(e) => updateField('client', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-trade">Trade</Label>
                <Input id="review-trade" value={form.trade} onChange={(e) => updateField('trade', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-address">Address</Label>
                <Input id="review-address" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-city">City</Label>
                <Input id="review-city" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-state">State</Label>
                  <Input id="review-state" value={form.state} onChange={(e) => updateField('state', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-zip">ZIP</Label>
                  <Input id="review-zip" value={form.zip} onChange={(e) => updateField('zip', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-bid-date">Bid Due</Label>
                <Input id="review-bid-date" type="date" value={form.bidDueDate} onChange={(e) => updateField('bidDueDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="review-rfi-date">RFI Due</Label>
                <Input id="review-rfi-date" type="date" value={form.rfiDueDate} onChange={(e) => updateField('rfiDueDate', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-notes">Notes</Label>
              <Textarea id="review-notes" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save Review Fields
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Full Results View ─────────────────────────────────────────────────────
function ResultsView() {
  const { currentProject, setStep, setCurrentProject, updateCurrentProject } = useProjectStore()
  const [loading, setLoading] = useState(true)

  // Fetch fresh project data on mount
  useEffect(() => {
    const projectId = currentProject?.id

    if (!projectId) {
      setStep('list')
      return
    }
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setCurrentProject(data)
        }
      } catch {
        // Use cached data
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [currentProject?.id, setStep, setCurrentProject])

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/export?format=${format}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentProject.name.replace(/[^a-zA-Z0-9]/g, '_')}_bid_analysis.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  if (loading) {
    return (
      <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="mt-6 grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </motion.div>
    )
  }

  if (!currentProject || !currentProject.analysis) {
    return (
      <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <FileSearch className="mb-4 size-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-semibold">No Analysis Results</h2>
            <p className="mb-6 text-sm text-muted-foreground">This project has not been analyzed yet.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('list')} className="gap-2">
                <ArrowLeft className="size-4" />
                Back to Projects
              </Button>
              <Button onClick={() => setStep('upload')} className="gap-2">
                <Upload className="size-4" />
                Upload Files
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div {...pageVariants} transition={pageTransition} className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Top Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{currentProject.name}</h1>
          <p className="text-sm text-muted-foreground">
            Analysis results &middot; {formatDate(currentProject.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="size-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('json')} className="gap-2">
                <FileDown className="size-4" /> Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')} className="gap-2">
                <FileSpreadsheet className="size-4" /> Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2">
                <FileText className="size-4" /> Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setStep('list')} className="gap-2">
            <FolderOpen className="size-4" />
            All Projects
          </Button>
        </div>
      </div>

      <ProjectReviewCard project={currentProject} onUpdated={updateCurrentProject} />

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            <span className="hidden sm:inline">Executive Summary</span>
            <span className="sm:hidden">Summary</span>
          </TabsTrigger>
          <TabsTrigger value="scope" className="gap-1.5">
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Scope Analysis</span>
            <span className="sm:hidden">Scope</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="size-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-1.5">
            <Shield className="size-3.5" />
            <span className="hidden sm:inline">Risk &amp; RFIs</span>
            <span className="sm:hidden">Risks</span>
          </TabsTrigger>
          <TabsTrigger value="estimate" className="gap-1.5">
            <Clock className="size-3.5" />
            Estimate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <ExecutiveSummaryTab project={currentProject} analysis={currentProject.analysis} />
        </TabsContent>
        <TabsContent value="scope">
          <ScopeAnalysisTab project={currentProject} analysis={currentProject.analysis} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab project={currentProject} />
        </TabsContent>
        <TabsContent value="risks">
          <RiskRfiTab project={currentProject} analysis={currentProject.analysis} />
        </TabsContent>
        <TabsContent value="estimate">
          <EstimateTab project={currentProject} analysis={currentProject.analysis} />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════
export default function Home() {
  const currentStep = useProjectStore((s) => s.currentStep)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const setStep = useProjectStore((s) => s.setStep)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const projectId = searchParams.get('project')
    if (!projectId) return

    let cancelled = false

    async function hydrateFromUrl() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) return
        const project = await res.json()
        if (cancelled) return
        setCurrentProject(project)
        setStep(project.status === 'processing' ? 'processing' : project.analysis ? 'results' : 'upload')
      } catch {
        // Ignore URL hydration failures and let the normal app flow continue
      }
    }

    hydrateFromUrl()
    return () => {
      cancelled = true
    }
  }, [setCurrentProject, setStep])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {currentStep === 'list' && (
            <ProjectListView key="list" />
          )}
          {currentStep === 'create' && (
            <CreateProjectView key="create" />
          )}
          {currentStep === 'upload' && (
            <UploadFilesView key="upload" />
          )}
          {currentStep === 'trade' && (
            <TradeSelectionView key="trade" />
          )}
          {currentStep === 'processing' && (
            <ProcessingView key="processing" />
          )}
          {currentStep === 'results' && (
            <ResultsView key="results" />
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
