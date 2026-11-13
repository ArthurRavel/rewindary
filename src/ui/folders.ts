import { isCandidateName } from '../ingest';

/** A file picked or dropped by the user, with its place inside a folder when it came from one. */
export interface Picked { file: File; path?: string }

/** Spread on an <input type=file> to make it pick a folder. Preact's JSX types do not list this long-standing attribute. */
export const FOLDER_PICKER: Record<string, unknown> = { webkitdirectory: true };

/** Files from an <input type=file>. A folder picker (webkitdirectory) sets webkitRelativePath, e.g. "Takeout/…/watch-history.json". */
export function fromInput(list: FileList | File[] | null): Picked[] {
  return [...(list ?? [])].map((file) => (file.webkitRelativePath ? { file, path: file.webkitRelativePath } : { file }));
}

/** The parts of the File and Directory Entries API this needs, so it can be tested without a browser. */
export interface EntryLike { isFile: boolean; isDirectory: boolean; name: string; fullPath: string }
interface FileEntryLike extends EntryLike { file(ok: (f: File) => void, fail?: (e: unknown) => void): void }
interface DirEntryLike extends EntryLike { createReader(): { readEntries(ok: (batch: EntryLike[]) => void, fail?: (e: unknown) => void): void } }

/**
 * The entries of a drop, but only when at least one of them is a folder; otherwise null and the
 * plain file list is used as before. Must run inside the drop handler: the browser empties the
 * item list once the event returns.
 */
export function droppedEntries(dt: DataTransfer): EntryLike[] | null {
  const entries: EntryLike[] = [];
  for (const item of dt.items ?? []) {
    const entry = item.kind === 'file' ? item.webkitGetAsEntry?.() : null;
    if (entry) entries.push(entry);
  }
  return entries.some((e) => e.isDirectory) ? entries : null;
}

const readBatch = (reader: ReturnType<DirEntryLike['createReader']>) => new Promise<EntryLike[]>((ok, fail) => reader.readEntries(ok, fail));
const fileOf = (entry: FileEntryLike) => new Promise<File>((ok, fail) => entry.file(ok, fail));

/**
 * Walk dropped files and folders. Files dropped on their own are all kept (so an unsupported one
 * still gets its note); inside a folder only .zip/.tgz/.tar/.json/.csv/.html files are opened as File
 * objects, so the photos and videos of a big Takeout are never touched.
 */
export async function walkEntries(entries: EntryLike[], onCount: (files: number) => void = () => {}): Promise<Picked[]> {
  const out: Picked[] = [];
  const visit = async (entry: EntryLike, nested: boolean): Promise<void> => {
    if (entry.isDirectory) {
      const reader = (entry as DirEntryLike).createReader();
      // readEntries hands out a folder's entries in batches (100 at a time in Chromium) until it returns none.
      // The files of one batch are opened together; sub-folders are walked one after the other.
      for (let batch = await readBatch(reader); batch.length; batch = await readBatch(reader)) {
        await Promise.all(batch.filter((c) => !c.isDirectory).map((c) => visit(c, true)));
        for (const child of batch) if (child.isDirectory) await visit(child, true);
      }
    } else if (entry.isFile && (!nested || isCandidateName(entry.name))) {
      const file = await fileOf(entry as FileEntryLike);
      out.push(nested ? { file, path: entry.fullPath.replace(/^\/+/, '') } : { file });
      if (out.length % 100 === 0) onCount(out.length);
    }
  };
  for (const entry of entries) await visit(entry, false);
  return out;
}
