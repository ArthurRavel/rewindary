/// <reference lib="webworker" />
import { inFolder, readBatch } from './ingest';
import type { Picked } from './ui/folders';

/** Parsing runs off the main thread. Files arrive by structured clone; nothing leaves the device. */
self.onmessage = async (ev: MessageEvent<{ files: Picked[] }>) => {
  try {
    const blobs = ev.data.files.map(({ file, path }) => (path ? inFolder(file, path) : file));
    const batch = await readBatch(blobs, (msg) => self.postMessage({ type: 'progress', msg }));
    self.postMessage({ type: 'done', batch });
  } catch (err) {
    self.postMessage({ type: 'error', msg: err instanceof Error ? err.message : String(err) });
  }
};
