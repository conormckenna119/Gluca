import type { ExportFormat } from './telemetry';

export type FormatId = 'story' | 'portrait' | 'square';

export interface FormatSpec {
  id: FormatId;
  label: string;
  w: number;
  h: number;
  margin: number;
  /** Essential content stays inside [safeTop, h - safeBottom]. Instagram Stories overlays UI at the top and bottom, so 250 px is conservative. */
  safeTop: number;
  safeBottom: number;
  telemetry: ExportFormat;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  story: { id: 'story', label: 'Story', w: 1080, h: 1920, margin: 90, safeTop: 250, safeBottom: 250, telemetry: 'story_1080x1920' },
  portrait: { id: 'portrait', label: 'Portrait', w: 1080, h: 1350, margin: 90, safeTop: 110, safeBottom: 110, telemetry: 'portrait_1080x1350' },
  square: { id: 'square', label: 'Square', w: 1080, h: 1080, margin: 80, safeTop: 90, safeBottom: 90, telemetry: 'square_1080x1080' },
};
export const FORMAT_ORDER: FormatId[] = ['story', 'portrait', 'square'];

/** Transparent exports are reported as their own format so the export mix is visible in analytics. */
export const telemetryFormat = (id: FormatId, transparent: boolean): ExportFormat => (transparent ? 'transparent_png' : FORMATS[id].telemetry);
