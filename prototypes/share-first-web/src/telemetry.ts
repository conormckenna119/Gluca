// Privacy-preserving product analytics abstraction (no dependencies).
//
// Design rules:
//  - Off by default. The only other mode is "local" (in-memory, never sent anywhere).
//  - Every event and property is declared in SPEC. Property values must be members of a fixed list of strings.
//    There is no free text and no number type, so glucose values, filenames, captions and photos cannot be recorded.
//  - Unknown events are dropped. Unknown or out-of-list properties are dropped (the event is still counted).
//  - No persistent identifier is stored. The session id lives in memory only.
//    Consequence: "returns to create another graphic" cannot be measured until a privacy-reviewed provider is chosen.
//  - A remote sink is intentionally not implemented.
//  - Opening a share sheet is recorded as "share_sheet_opened", never as a published post.

const TEMPLATES = ['minimal_trace', 'daily_recap', 'transparent_overlay', 'real_side', 'humorous', 'milestone'] as const;
const FORMATS = ['story_1080x1920', 'portrait_1080x1350', 'square_1080x1080', 'transparent_png'] as const;
const SOURCES = ['demo', 'csv'] as const;

const SPEC = {
  app_opened: {},
  demo_started: {},
  import_started: {},
  import_succeeded: {},
  import_failed: { reason: ['unsupported_format', 'no_valid_rows', 'parse_error', 'user_cancelled', 'unknown'] },
  template_selected: { template: TEMPLATES, source: SOURCES },
  customization_opened: { template: TEMPLATES },
  export_started: { template: TEMPLATES, format: FORMATS },
  export_succeeded: { template: TEMPLATES, format: FORMATS },
  export_failed: { template: TEMPLATES, format: FORMATS, reason: ['render', 'permission', 'unsupported', 'unknown'] },
  share_sheet_opened: { template: TEMPLATES, format: FORMATS },
  // Optional, self-reported answers. Ratings are strings on purpose so no numeric health value can fit the type.
  feedback_submitted: { shared_externally: ['yes', 'no', 'not_yet'], felt_represented: ['1', '2', '3', '4', '5'] },
} as const;

type Spec = typeof SPEC;
export type EventName = keyof Spec;
export type Props<N extends EventName> = {
  [K in keyof Spec[N]]?: Spec[N][K] extends readonly (infer V)[] ? V : never;
};
export type TemplateId = (typeof TEMPLATES)[number];
export type ExportFormat = (typeof FORMATS)[number];
export type TelemetryMode = 'off' | 'local';

export interface RecordedEvent {
  name: EventName;
  props: Record<string, string>;
  at: number;
  session: string;
}

export interface TelemetryOptions {
  mode?: TelemetryMode;
  maxEvents?: number;
  now?: () => number;
  sessionId?: string;
}

export function createTelemetry(options: TelemetryOptions = {}) {
  let mode: TelemetryMode = options.mode ?? 'off';
  const max = options.maxEvents ?? 500;
  const now = options.now ?? (() => Date.now());
  const session = options.sessionId ?? Math.random().toString(36).slice(2, 10);
  let buffer: RecordedEvent[] = [];
  let droppedEvents = 0;
  let droppedProps = 0;

  function track<N extends EventName>(name: N, props: Props<N> = {} as Props<N>): void {
    if (mode === 'off') return;
    const spec = (SPEC as Record<string, Record<string, readonly string[]>>)[name];
    if (!spec) { droppedEvents++; return; }
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      const allowed = spec[key];
      if (allowed && typeof value === 'string' && allowed.includes(value)) clean[key] = value;
      else droppedProps++;
    }
    buffer.push({ name, props: clean, at: now(), session });
    if (buffer.length > max) buffer = buffer.slice(buffer.length - max);
  }

  return {
    track,
    mode: () => mode,
    setMode(next: TelemetryMode) { mode = next; },
    events: (): readonly RecordedEvent[] => buffer,
    clear() { buffer = []; droppedEvents = 0; droppedProps = 0; },
    dropped: () => ({ events: droppedEvents, props: droppedProps }),
    /** Counts per event name, for a local debug panel. Contains no property values. */
    counts(): Record<string, number> {
      const out: Record<string, number> = {};
      for (const e of buffer) out[e.name] = (out[e.name] ?? 0) + 1;
      return out;
    },
  };
}

export const telemetry = createTelemetry();
