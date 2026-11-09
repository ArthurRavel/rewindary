import { demoFiles } from './demo';
import { mergeParsed, parseTextFile } from './ingest';
import type { IngestResult } from './model';

/** Build the demo dataset by running synthetic exports through the real parsers. */
export function loadDemo(year?: number): IngestResult {
  const files = demoFiles(year);
  const parsed = files.map((f) => parseTextFile(f.name, f.text)).filter((p) => p !== null);
  return { ...mergeParsed(parsed), ignored: [] };
}
