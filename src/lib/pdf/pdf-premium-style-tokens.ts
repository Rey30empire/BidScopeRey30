import { rgb, type RGB } from 'pdf-lib';

export type PremiumStyleTokens = {
  pageWidth: number;
  pageHeight: number;
  outerFrameInset: number;
  innerFrameInset: number;
  contentInset: number;
  paper: RGB;
  paperShade: RGB;
  ink: RGB;
  accent: RGB;
  accentSoft: RGB;
  frame: RGB;
  muted: RGB;
  line: RGB;
  strongLine: RGB;
};

export const PREMIUM_TOKENS: PremiumStyleTokens = {
  pageWidth: 612,
  pageHeight: 792,
  outerFrameInset: 18,
  innerFrameInset: 28,
  contentInset: 44,
  paper: rgb(0.984, 0.966, 0.936),
  paperShade: rgb(0.972, 0.946, 0.9),
  ink: rgb(0.13, 0.2, 0.33),
  accent: rgb(0.63, 0.49, 0.27),
  accentSoft: rgb(0.83, 0.73, 0.58),
  frame: rgb(0.73, 0.59, 0.36),
  muted: rgb(0.42, 0.36, 0.29),
  line: rgb(0.82, 0.75, 0.64),
  strongLine: rgb(0.66, 0.54, 0.35),
};
