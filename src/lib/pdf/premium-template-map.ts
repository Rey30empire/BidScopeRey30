export const PREMIUM_TEMPLATE_PAGE = {
  width: 1024,
  height: 1536,
} as const;

export const PREMIUM_TEMPLATE_BACKGROUND_PATH = 'src/assets/templates/premium-template-clean-sheet.png';

export type TemplateRect = {
  x: number;
  top: number;
  width: number;
  height: number;
};

export const PREMIUM_TEMPLATE_MAP = {
  meta: {
    estimateNumber: { x: 877, top: 61, width: 112 },
    date: { x: 877, top: 100, width: 112 },
    version: { x: 877, top: 138, width: 112 },
    validFor: { x: 877, top: 176, width: 112 },
  },
  mainPanel: { x: 96, top: 378, width: 832, height: 740 },
  footerPanel: { x: 96, top: 1132, width: 832, height: 236 },
  cards: {
    overview: { x: 122, top: 404, width: 780, height: 140 },
    note: { x: 122, top: 560, width: 780, height: 54 },
    left: { x: 122, top: 632, width: 380, height: 246 },
    right: { x: 522, top: 632, width: 380, height: 246 },
    table: { x: 122, top: 896, width: 780, height: 190 },
    footerLeft: { x: 122, top: 1160, width: 388, height: 180 },
    footerCenter: { x: 528, top: 1160, width: 166, height: 180 },
    footerRight: { x: 712, top: 1160, width: 190, height: 180 },
  },
  continuation: {
    header: { x: 122, top: 406, width: 780, height: 56 },
    support: { x: 122, top: 478, width: 780, height: 112 },
    table: { x: 122, top: 608, width: 780, height: 478 },
    footerLeft: { x: 122, top: 1160, width: 420, height: 180 },
    footerCenter: { x: 560, top: 1160, width: 142, height: 180 },
    footerRight: { x: 720, top: 1160, width: 182, height: 180 },
  },
  table: {
    headerHeight: 26,
    rowHeight: 31,
    firstPageRows: 4,
    continuationRows: 12,
    columns: {
      item: { x: 136, width: 78 },
      description: { x: 218, width: 262 },
      quantity: { x: 484, width: 64 },
      unit: { x: 552, width: 48 },
      material: { x: 604, width: 78 },
      labor: { x: 686, width: 72 },
      equipment: { x: 762, width: 72 },
      subtotal: { x: 838, width: 54 },
    },
  },
} as const;
