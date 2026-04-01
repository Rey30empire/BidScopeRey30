import type { Analysis, BidFile, Project } from '@prisma/client';
import { db } from '@/lib/db';

export type ProjectWithFilesAndAnalysis = Project & {
  files: BidFile[];
  analysis: Analysis | null;
};

function groupFilesByProject(files: BidFile[]) {
  const map = new Map<string, BidFile[]>();

  for (const file of files) {
    const current = map.get(file.projectId) ?? [];
    current.push(file);
    map.set(file.projectId, current);
  }

  return map;
}

function pickLatestAnalysisByProject(analyses: Analysis[]) {
  const map = new Map<string, Analysis>();

  for (const analysis of analyses) {
    if (!map.has(analysis.projectId)) {
      map.set(analysis.projectId, analysis);
    }
  }

  return map;
}

async function loadFilesMap(projectIds: string[]) {
  if (!projectIds.length) {
    return new Map<string, BidFile[]>();
  }

  try {
    const files = await db.bidFile.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: 'desc' },
    });
    return groupFilesByProject(files);
  } catch (error) {
    console.error('Falling back with no files because bid file lookup failed:', error);
    return new Map<string, BidFile[]>();
  }
}

async function loadAnalysisMap(projectIds: string[]) {
  if (!projectIds.length) {
    return new Map<string, Analysis>();
  }

  try {
    const analyses = await db.analysis.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return pickLatestAnalysisByProject(analyses);
  } catch (error) {
    console.error('Falling back with no analysis because analysis lookup failed:', error);
    return new Map<string, Analysis>();
  }
}

function hydrateProjects(
  projects: Project[],
  filesByProject: Map<string, BidFile[]>,
  analysisByProject: Map<string, Analysis>,
): ProjectWithFilesAndAnalysis[] {
  return projects.map((project) => ({
    ...project,
    files: filesByProject.get(project.id) ?? [],
    analysis: analysisByProject.get(project.id) ?? null,
  }));
}

export async function listProjectsWithFilesAndAnalysis() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const projectIds = projects.map((project) => project.id);
  const [filesByProject, analysisByProject] = await Promise.all([
    loadFilesMap(projectIds),
    loadAnalysisMap(projectIds),
  ]);

  return hydrateProjects(projects, filesByProject, analysisByProject);
}

export async function getProjectWithFilesAndAnalysis(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const [filesByProject, analysisByProject] = await Promise.all([
    loadFilesMap([projectId]),
    loadAnalysisMap([projectId]),
  ]);

  return hydrateProjects([project], filesByProject, analysisByProject)[0] ?? null;
}
