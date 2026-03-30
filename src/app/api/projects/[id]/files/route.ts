import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, sep } from 'path';
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, MAX_ZIP_SIZE } from '@/lib/constants';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return `.${ext}`;
}

function getFileType(filename: string): string {
  const ext = filename.toLowerCase();
  if (ext.endsWith('.pdf')) return 'pdf';
  if (ext.endsWith('.docx')) return 'docx';
  if (ext.endsWith('.xlsx') || ext.endsWith('.csv')) return 'spreadsheet';
  if (ext.endsWith('.txt')) return 'text';
  if (ext.endsWith('.zip')) return 'zip';
  if (['.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp'].some((value) => ext.endsWith(value))) {
    return 'image';
  }

  return 'other';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/_+/g, '_');
}

function ensureInsideDir(rootDir: string, targetPath: string): boolean {
  const resolvedRoot = resolve(rootDir);
  const resolvedTarget = resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${sep}`);
}

async function getUniquePath(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    return filePath;
  }

  const extensionIndex = filePath.lastIndexOf('.');
  const baseName = extensionIndex > -1 ? filePath.slice(0, extensionIndex) : filePath;
  const extension = extensionIndex > -1 ? filePath.slice(extensionIndex) : '';

  let counter = 1;
  let candidate = `${baseName}_${counter}${extension}`;

  while (existsSync(candidate)) {
    counter += 1;
    candidate = `${baseName}_${counter}${extension}`;
  }

  return candidate;
}

function buildExtractPath(extractedRoot: string, entryName: string): string | null {
  const normalized = entryName.replace(/\\/g, '/').split('/').filter(Boolean);
  if (!normalized.length || normalized.some((segment) => segment === '..')) {
    return null;
  }

  const rawFileName = normalized.pop() ?? 'file';
  const safeFileName = sanitizeFileName(rawFileName).split('/').pop() ?? 'file';
  const safeDirectories = normalized.map((segment) => sanitizeFileName(segment).replaceAll('/', '')).filter(Boolean);
  const targetPath = join(extractedRoot, ...safeDirectories, safeFileName);

  return ensureInsideDir(extractedRoot, targetPath) ? targetPath : null;
}

// POST /api/projects/[id]/files - Upload files
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const projectDir = join(UPLOAD_DIR, projectId);
    await ensureDir(projectDir);

    const savedFiles: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      category?: string;
    }> = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const originalName = file.name;
      const ext = getFileExtension(originalName);
      const isZip = originalName.toLowerCase().endsWith('.zip');

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: `File type not allowed: ${ext}` }, { status: 400 });
      }

      if (isZip && buffer.length > MAX_ZIP_SIZE) {
        return NextResponse.json({ error: 'ZIP file too large (max 2GB)' }, { status: 400 });
      }

      if (!isZip && buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 400 });
      }

      const hash = createHash('sha256').update(buffer).digest('hex');
      const existingFile = await db.bidFile.findFirst({
        where: { projectId, hash },
      });

      if (existingFile) {
        savedFiles.push({
          id: existingFile.id,
          fileName: existingFile.fileName,
          fileSize: existingFile.fileSize,
          fileType: existingFile.fileType,
        });
        continue;
      }

      const safeName = sanitizeFileName(originalName).split('/').pop() ?? 'upload.bin';
      const filePath = await getUniquePath(join(projectDir, safeName));
      await writeFile(filePath, buffer);

      const fileType = getFileType(originalName);

      if (isZip) {
        try {
          const zip = new AdmZip(filePath);
          const extractedRoot = join(projectDir, 'extracted');
          await ensureDir(extractedRoot);

          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) {
              continue;
            }

            const targetPath = buildExtractPath(extractedRoot, entry.entryName);
            if (!targetPath) {
              continue;
            }

            const entryBuffer = entry.getData();
            const entryHash = createHash('sha256').update(entryBuffer).digest('hex');
            const existingExtracted = await db.bidFile.findFirst({
              where: { projectId, hash: entryHash },
            });

            if (existingExtracted) {
              savedFiles.push({
                id: existingExtracted.id,
                fileName: existingExtracted.fileName,
                fileSize: existingExtracted.fileSize,
                fileType: existingExtracted.fileType,
              });
              continue;
            }

            const uniqueTargetPath = await getUniquePath(targetPath);
            await ensureDir(uniqueTargetPath.split(sep).slice(0, -1).join(sep));
            await writeFile(uniqueTargetPath, entryBuffer);

            const entryFileName = uniqueTargetPath.split(sep).pop() ?? 'file';
            const entryFile = await db.bidFile.create({
              data: {
                projectId,
                originalName: entry.entryName,
                fileName: entryFileName,
                filePath: uniqueTargetPath,
                fileType: getFileType(entryFileName),
                fileSize: entryBuffer.length,
                hash: entryHash,
              },
            });

            savedFiles.push({
              id: entryFile.id,
              fileName: entryFile.fileName,
              fileSize: entryFile.fileSize,
              fileType: entryFile.fileType,
            });
          }

          const zipFile = await db.bidFile.create({
            data: {
              projectId,
              originalName,
              fileName: safeName,
              filePath,
              fileType: 'zip',
              fileSize: buffer.length,
              mimeType: file.type,
              hash,
            },
          });

          savedFiles.push({
            id: zipFile.id,
            fileName: zipFile.fileName,
            fileSize: zipFile.fileSize,
            fileType: zipFile.fileType,
          });
        } catch (zipError) {
          const zipFile = await db.bidFile.create({
            data: {
              projectId,
              originalName,
              fileName: safeName,
              filePath,
              fileType: 'zip',
              fileSize: buffer.length,
              mimeType: file.type,
              hash,
              error: `ZIP extraction failed: ${String(zipError)}`,
            },
          });

          savedFiles.push({
            id: zipFile.id,
            fileName: zipFile.fileName,
            fileSize: zipFile.fileSize,
            fileType: zipFile.fileType,
          });
        }

        continue;
      }

      const savedFile = await db.bidFile.create({
        data: {
          projectId,
          originalName,
          fileName: safeName,
          filePath,
          fileType,
          fileSize: buffer.length,
          mimeType: file.type,
          hash,
        },
      });

      savedFiles.push({
        id: savedFile.id,
        fileName: savedFile.fileName,
        fileSize: savedFile.fileSize,
        fileType: savedFile.fileType,
      });
    }

    await db.project.update({
      where: { id: projectId },
      data: { status: 'upload' },
    });

    return NextResponse.json({
      success: true,
      files: savedFiles,
      totalFiles: savedFiles.length,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 });
  }
}

// GET /api/projects/[id]/files - List files for project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const files = await db.bidFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/files - Delete all files for project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    await db.bidFile.deleteMany({ where: { projectId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting files:', error);
    return NextResponse.json({ error: 'Failed to delete files' }, { status: 500 });
  }
}
