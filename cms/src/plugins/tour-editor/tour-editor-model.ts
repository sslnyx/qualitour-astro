export type TourData = Record<string, unknown>;

export type DayRef = { field: 'itinerary' | 'itinerary_continued'; key: string };

export type DayBlock = Record<string, unknown> & {
  _key: string;
  _type: string;
  title?: string;
  content?: unknown[];
};

export type DayRow = { ref: DayRef; ordinal: number; block: DayBlock };

const FIELDS = ['itinerary', 'itinerary_continued'] as const;

type Field = (typeof FIELDS)[number];

const MAX_DAYS_PER_FIELD = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      Object.defineProperty(out, key, { value: cloneValue(child), enumerable: true, writable: true, configurable: true });
    }
    return out as T;
  }
  return value;
}

function structurallyEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => structurallyEqual(item, b[index]));
  }
  if (isRecord(a) || isRecord(b)) {
    if (!isRecord(a) || !isRecord(b)) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        structurallyEqual(a[key], b[key]),
    );
  }
  return false;
}

function fieldArray(data: TourData, field: Field): DayBlock[] {
  const raw = data[field];
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`Tour data field "${field}" must be an array`);
  }
  if (raw.length > MAX_DAYS_PER_FIELD) {
    throw new Error(
      `Tour data field "${field}" must contain at most ${MAX_DAYS_PER_FIELD} day blocks`,
    );
  }
  return raw as DayBlock[];
}

export function dayId(ref: DayRef): string {
  return JSON.stringify([ref.field, ref.key]);
}

export function readDays(data: TourData): DayRow[] {
  if (!isRecord(data)) {
    throw new Error('Tour data must be an object');
  }
  const rows: DayRow[] = [];
  for (const field of FIELDS) {
    const blocks = fieldArray(data, field);
    const seen = new Set<string>();
    blocks.forEach((block, index) => {
      const where = `Day block at ${field}[${index}]`;
      if (!isRecord(block)) {
        throw new Error(`${where} must be an object`);
      }
      if (typeof block._key !== 'string' || block._key.length === 0) {
        throw new Error(`${where} must have a non-empty string _key`);
      }
      if (seen.has(block._key)) {
        throw new Error(`Duplicate day _key "${block._key}" in ${field}`);
      }
      seen.add(block._key);
      if (block._type !== 'day') {
        throw new Error(`${where} must have _type "day"`);
      }
      if (
        Object.prototype.hasOwnProperty.call(block, 'title') &&
        block.title !== undefined &&
        typeof block.title !== 'string'
      ) {
        throw new Error(`${where} title must be a string`);
      }
      if (
        Object.prototype.hasOwnProperty.call(block, 'content') &&
        block.content !== undefined &&
        !Array.isArray(block.content)
      ) {
        throw new Error(`${where} content must be an array`);
      }
      rows.push({
        ref: { field, key: block._key },
        ordinal: rows.length + 1,
        block: block as DayBlock,
      });
    });
  }
  return rows;
}

export function updateDay(
  data: TourData,
  ref: DayRef,
  patch: { title?: string; content?: unknown[] },
): TourData {
  if (!isRecord(patch)) {
    throw new Error('Patch must be an object');
  }
  for (const key of Object.keys(patch)) {
    if (key !== 'title' && key !== 'content') {
      throw new Error(`Unsupported patch field "${key}"`);
    }
  }
  const hasTitle = Object.prototype.hasOwnProperty.call(patch, 'title');
  const hasContent = Object.prototype.hasOwnProperty.call(patch, 'content');
  if (hasTitle && typeof patch.title !== 'string') {
    throw new Error('Patch title must be a string');
  }
  if (hasContent && !Array.isArray(patch.content)) {
    throw new Error('Patch content must be an array');
  }

  const rows = readDays(data);
  const wanted = dayId(ref);
  const target = rows.find((row) => dayId(row.ref) === wanted);
  if (!target) {
    throw new Error(`Day not found: ${wanted}`);
  }

  const next = cloneValue(data);
  const blocks = next[ref.field] as DayBlock[];
  const index = blocks.findIndex((block) => block._key === ref.key);
  if (index < 0) {
    throw new Error(`Day not found: ${wanted}`);
  }
  const updated: DayBlock = { ...blocks[index] };
  if (hasTitle) updated.title = patch.title as string;
  if (hasContent) updated.content = cloneValue(patch.content) as unknown[];
  blocks[index] = updated;
  return next;
}

function keysFor(rows: DayRow[], field: Field): string[] {
  return rows.filter((row) => row.ref.field === field).map((row) => row.ref.key);
}

export function buildItinerarySave(
  base: TourData,
  changed: TourData,
): { data: TourData } {
  const baseRows = readDays(base);
  const changedRows = readDays(changed);

  const topLevelKeys = new Set([...Object.keys(base), ...Object.keys(changed)]);
  for (const key of topLevelKeys) {
    if (key === 'itinerary' || key === 'itinerary_continued') continue;
    if (!structurallyEqual(base[key], changed[key])) {
      throw new Error(`Refusing to save non-itinerary top-level change to "${key}"`);
    }
  }

  const payload: TourData = {};
  for (const field of FIELDS) {
    const baseKeys = keysFor(baseRows, field);
    const changedKeys = keysFor(changedRows, field);
    if (
      baseKeys.length !== changedKeys.length ||
      baseKeys.some((key, index) => key !== changedKeys[index])
    ) {
      throw new Error(
        `Refusing to save itinerary key/order/length change in "${field}" for M1`,
      );
    }
    const baseBlocks = fieldArray(base, field);
    const changedBlocks = fieldArray(changed, field);
    if (!structurallyEqual(baseBlocks, changedBlocks)) {
      payload[field] = cloneValue(changedBlocks);
    }
  }
  return { data: payload };
}

export function changedDayIds(base: TourData, changed: TourData): string[] {
  const baseRows = readDays(base);
  const changedRows = readDays(changed);
  const baseById = new Map(baseRows.map((row) => [dayId(row.ref), row.block]));
  const changedById = new Map(changedRows.map((row) => [dayId(row.ref), row.block]));

  const ids: string[] = [];
  for (const row of changedRows) {
    const id = dayId(row.ref);
    const before = baseById.get(id);
    if (before === undefined || !structurallyEqual(before, row.block)) {
      ids.push(id);
    }
  }
  for (const row of baseRows) {
    const id = dayId(row.ref);
    if (!changedById.has(id)) {
      ids.push(id);
    }
  }
  return ids;
}
