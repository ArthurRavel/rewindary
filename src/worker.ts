/// <reference lib="webworker" />
import { ingestFiles } from './ingest';

/** Parsing runs off the main thread. Files arrive by structured clone; nothing leaves the device. */
self.onmessage = async (ev: MessageEvent<{ files: File[] }>) => {
  try {
    const result = await ingestFiles(ev.data.files, (msg) => self.postMessage({ type: 'progress', msg }));
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', msg: err instanceof Error ? err.message : String(err) });
  }
};
