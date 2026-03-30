import { create } from 'zustand';

export interface ProjectData {
  id: string;
  name: string;
  client?: string | null;
  location?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  projectSize?: string | null;
  trade?: string | null;
  status?: string;
  bidDueDate?: string | null;
  rfiDueDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  files?: FileData[];
  analysis?: AnalysisData | null;
}

export interface FileData {
  id: string;
  projectId: string;
  originalName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category?: string | null;
  relevanceScore?: number | null;
  summary?: string | null;
  isRelevant?: boolean | null;
  isProcessed: boolean;
  error?: string | null;
}

export interface AnalysisData {
  id: string;
  projectId: string;
  projectName?: string | null;
  client?: string | null;
  contact?: string | null;
  email?: string | null;
  bidDueDate?: string | null;
  rfiDueDate?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  trade?: string | null;
  scopeAnalysis?: string | null;
  executiveSummary?: string | null;
  riskItems?: string | null;
  rfiSuggestions?: string | null;
  timeEstimate?: string | null;
  materials?: string | null;
  relevantSheets?: string | null;
  confidence?: number | null;
  status?: string;
  error?: string | null;
}

type AppStep = 'list' | 'create' | 'upload' | 'trade' | 'processing' | 'results';

interface AnalysisProgress {
  status: string;
  progress: number;
  message: string;
}

interface AppSettings {
  companyName: string;
  estimatorName: string;
  email: string;
  phone: string;
  defaultOverheadPercent: number;
  defaultProfitPercent: number;
  defaultAdditionalPercent: number;
}

interface ProjectStore {
  // State
  projects: ProjectData[];
  currentProject: ProjectData | null;
  currentStep: AppStep;
  analysisProgress: AnalysisProgress;
  isAnalyzing: boolean;
  settings: AppSettings;

  // Actions
  setProjects: (projects: ProjectData[]) => void;
  addProject: (project: ProjectData) => void;
  setCurrentProject: (project: ProjectData | null) => void;
  updateCurrentProject: (updates: Partial<ProjectData>) => void;
  removeProject: (id: string) => void;
  setStep: (step: AppStep) => void;
  setAnalysisProgress: (progress: AnalysisProgress) => void;
  setIsAnalyzing: (val: boolean) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateProjectFiles: (projectId: string, files: FileData[]) => void;
  updateProjectAnalysis: (projectId: string, analysis: AnalysisData | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  // Initial State
  projects: [],
  currentProject: null,
  currentStep: 'list',
  analysisProgress: { status: 'idle', progress: 0, message: '' },
  isAnalyzing: false,
  settings: {
    companyName: 'My Estimating Co.',
    estimatorName: '',
    email: '',
    phone: '',
    defaultOverheadPercent: 8,
    defaultProfitPercent: 5,
    defaultAdditionalPercent: 3.6,
  },

  // Actions
  setProjects: (projects) => set({ projects }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  setCurrentProject: (project) =>
    set({ currentProject: project }),

  updateCurrentProject: (updates) =>
    set((state) => {
      if (!state.currentProject) return state;
      const updated = { ...state.currentProject, ...updates };
      return {
        currentProject: updated,
        projects: state.projects.map((p) =>
          p.id === updated.id ? updated : p
        ),
      };
    }),

  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
      currentStep: state.currentProject?.id === id ? 'list' : state.currentStep,
    })),

  setStep: (step) => set({ currentStep: step }),

  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),

  setIsAnalyzing: (val) => set({ isAnalyzing: val }),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  updateProjectFiles: (projectId, files) =>
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === projectId ? { ...p, files } : p
      );
      const currentProject =
        state.currentProject?.id === projectId
          ? { ...state.currentProject, files }
          : state.currentProject;
      return { projects, currentProject };
    }),

  updateProjectAnalysis: (projectId, analysis) =>
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === projectId ? { ...p, analysis } : p
      );
      const currentProject =
        state.currentProject?.id === projectId
          ? { ...state.currentProject, analysis }
          : state.currentProject;
      return { projects, currentProject };
    }),
}));
