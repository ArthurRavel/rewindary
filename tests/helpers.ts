import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const FIX = join(import.meta.dirname, 'fixtures');
export const fixture = (p: string) => readFileSync(join(FIX, p), 'utf8');
export const fixtureBytes = (p: string) => new Uint8Array(readFileSync(join(FIX, p)));
