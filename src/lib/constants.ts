export const TRADE_OPTIONS = [
  { value: 'doors_frames_hardware', label: 'Doors, Frames & Hardware', keywords: ['door', 'frame', 'hardware', 'hinge', 'lock', 'closer', 'panic', 'exit device', 'threshold', 'strike', 'latch', 'deadbolt'] },
  { value: 'toilet_partitions', label: 'Toilet Partitions', keywords: ['toilet partition', 'bathroom partition', 'restroom partition', 'partition', 'cubicle', 'bathroom divider'] },
  { value: 'bathroom_accessories', label: 'Bathroom Accessories', keywords: ['grab bar', 'mirror', 'soap dispenser', 'paper towel', 'hand dryer', 'accessory', 'towel bar', 'robe hook', 'toilet accessory'] },
  { value: 'fences_gates', label: 'Fences & Gates', keywords: ['fence', 'gate', 'chain link', 'barbed wire', 'ornamental fence', 'security fence', 'barrier', 'railing', 'guardrail'] },
  { value: 'drywall', label: 'Drywall & Framing', keywords: ['drywall', 'gypsum', 'sheetrock', 'framing', 'metal stud', 'wood stud', 'tape', 'mud', 'texture', 'ceiling', 'insulation'] },
  { value: 'concrete', label: 'Concrete', keywords: ['concrete', 'cement', 'pour', 'slab', 'footing', 'foundation', 'rebar', 'curb', 'sidewalk', 'paving', 'asphalt', 'flatwork'] },
  { value: 'hvac', label: 'HVAC', keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'duct', 'furnace', 'compressor', 'thermostat', 'ventilation', 'air handler', 'chiller', 'boiler'] },
  { value: 'plumbing', label: 'Plumbing', keywords: ['plumbing', 'pipe', 'water', 'sewer', 'drain', 'fixture', 'faucet', 'toilet', 'sink', 'water heater', 'pump', 'valve', 'trap'] },
  { value: 'electrical', label: 'Electrical', keywords: ['electrical', 'electric', 'power', 'lighting', 'panel', 'switch', 'outlet', 'circuit', 'conduit', 'wire', 'transformer', 'generator', 'grounding'] },
  { value: 'fire_protection', label: 'Fire Protection', keywords: ['fire sprinkler', 'fire alarm', 'fire suppression', 'fire stop', 'fire rated', 'sprinkler', 'fire hydrant', 'standpipe', 'fire pump'] },
  { value: 'painting', label: 'Painting & Coatings', keywords: ['paint', 'coating', 'stain', 'sealer', 'primer', 'wall covering', 'wallpaper', 'finish', 'epoxy', 'waterproofing'] },
  { value: 'flooring', label: 'Flooring', keywords: ['flooring', 'tile', 'carpet', 'vinyl', 'hardwood', 'laminate', 'epoxy floor', 'floor covering', 'floor finish'] },
  { value: 'elevators', label: 'Elevators & Lifts', keywords: ['elevator', 'lift', 'escalator', 'dumbwaiter', 'hoist', 'vertical transport'] },
  { value: 'steel', label: 'Structural Steel', keywords: ['steel', 'beam', 'column', 'connection', 'bracing', 'structural', 'metal deck', 'joist', 'truss'] },
  { value: 'masonry', label: 'Masonry', keywords: ['masonry', 'brick', 'block', 'cmu', 'stone', 'veneer', 'mortar', 'grout', 'chimney'] },
  { value: 'roofing', label: 'Roofing', keywords: ['roof', 'roofing', 'shingle', 'membrane', 'flashing', 'gutter', 'downspout', 'waterproofing', 'insulation'] },
  { value: 'glass_glazing', label: 'Glass & Glazing', keywords: ['glass', 'glazing', 'window', 'storefront', 'curtain wall', 'mirror', 'skylight', 'tempered', 'laminated'] },
  { value: 'site_work', label: 'Site Work / Civil', keywords: ['site work', 'grading', 'excavation', 'grading', 'landscape', 'paving', 'retaining wall', 'storm drain', 'utility', 'septic'] },
  { value: 'general', label: 'General / Other', keywords: [] },
] as const;

export const DOCUMENT_CATEGORIES = [
  { value: 'drawings', label: 'Drawings / Plans', icon: 'FileText', color: 'blue' },
  { value: 'addenda', label: 'Addenda', icon: 'FilePlus', color: 'amber' },
  { value: 'specifications', label: 'Specifications / Project Manual', icon: 'BookOpen', color: 'purple' },
  { value: 'civil', label: 'Civil', icon: 'Building2', color: 'orange' },
  { value: 'structural', label: 'Structural', icon: 'Construction', color: 'red' },
  { value: 'architectural', label: 'Architectural', icon: 'Palette', color: 'pink' },
  { value: 'mep', label: 'MEP', icon: 'Zap', color: 'yellow' },
  { value: 'site', label: 'Site / Utility', icon: 'MapPin', color: 'green' },
  { value: 'geotech', label: 'Geotech', icon: 'Mountain', color: 'brown' },
  { value: 'fire_protection', label: 'Fire Protection', icon: 'Flame', color: 'red' },
  { value: 'bid_forms', label: 'Bid Forms / Instructions', icon: 'ClipboardList', color: 'gray' },
  { value: 'rfi', label: 'RFI / Response Letters', icon: 'MessageSquare', color: 'cyan' },
  { value: 'irrelevant', label: 'Irrelevant / Low Priority', icon: 'FileX', color: 'slate' },
] as const;

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_ZIP_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/bmp',
  'image/webp',
];

export const ALLOWED_EXTENSIONS = [
  '.pdf', '.docx', '.xlsx', '.csv', '.txt', '.zip',
  '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp',
];

export const ANALYSIS_STEPS = [
  { key: 'uploading', label: 'Uploading files', icon: 'Upload' },
  { key: 'extracting', label: 'Extracting archives', icon: 'Archive' },
  { key: 'classifying', label: 'Classifying documents', icon: 'Tags' },
  { key: 'analyzing_scope', label: 'Analyzing scope', icon: 'Search' },
  { key: 'analyzing_weather', label: 'Checking weather', icon: 'Cloud' },
  { key: 'estimating_time', label: 'Estimating time', icon: 'Clock' },
  { key: 'generating_summary', label: 'Generating summary', icon: 'FileCheck' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  drawings: 'bg-blue-100 text-blue-800',
  addenda: 'bg-amber-100 text-amber-800',
  specifications: 'bg-purple-100 text-purple-800',
  civil: 'bg-orange-100 text-orange-800',
  structural: 'bg-red-100 text-red-800',
  architectural: 'bg-pink-100 text-pink-800',
  mep: 'bg-yellow-100 text-yellow-800',
  site: 'bg-green-100 text-green-800',
  geotech: 'bg-amber-100 text-amber-800',
  fire_protection: 'bg-red-100 text-red-800',
  bid_forms: 'bg-gray-100 text-gray-800',
  rfi: 'bg-cyan-100 text-cyan-800',
  irrelevant: 'bg-slate-100 text-slate-800',
  unknown: 'bg-gray-100 text-gray-600',
};
