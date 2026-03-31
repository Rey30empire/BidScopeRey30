import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PremiumBrandingModel } from '@/lib/estimates/estimate-render-model';

function resolveFilePath(source: string) {
  if (path.isAbsolute(source)) return source;
  return path.join(process.cwd(), source.replace(/^[/\\]+/, ''));
}

async function readBinaryAsset(source?: string | null) {
  const normalized = source?.trim();
  if (!normalized) return null;

  if (/^https?:\/\//i.test(normalized)) {
    const response = await fetch(normalized);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  try {
    return await readFile(resolveFilePath(normalized));
  } catch {
    return null;
  }
}

export function resolvePremiumBranding(input: {
  companyName?: string | null;
}) : PremiumBrandingModel {
  return {
    companyName: input.companyName?.trim() || process.env.ESTIMATE_COMPANY_NAME?.trim() || 'Top Notch Remodeling LLC',
    subtitle: process.env.ESTIMATE_PREMIUM_SUBTITLE?.trim() || 'Professional Estimating Services',
    logoUrl: process.env.ESTIMATE_LOGO_URL?.trim() || null,
    signatureImageUrl: process.env.ESTIMATE_SIGNATURE_IMAGE_URL?.trim() || null,
    signatureTextFallback: process.env.ESTIMATE_SIGNATURE_TEXT?.trim() || 'Top Notch Estimating',
    footerGeneratedByText: process.env.ESTIMATE_FOOTER_GENERATED_BY_TEXT?.trim() || 'Bid generated via REY30',
    footerLegalText:
      process.env.ESTIMATE_FOOTER_LEGAL_TEXT?.trim() ||
      'For review purposes only. Final estimate value remains subject to addenda, field verification, and contract review.',
    accentColor: '#a17d45',
    accentSoftColor: '#d6bf93',
    inkColor: '#213351',
    paperColor: '#fbf5ea',
    frameColor: '#b7925f',
  };
}

export async function loadBrandingImageBytes(logoUrl?: string | null) {
  return readBinaryAsset(logoUrl);
}

export async function loadSignatureImageBytes(signatureImageUrl?: string | null) {
  return readBinaryAsset(signatureImageUrl);
}
