/**
 * Ways a reviewed card leaves the page: download, copy to the clipboard, or the native share sheet.
 * Kept free of DOM globals (they are passed in) so the decisions can be unit tested.
 */

export type ExportAction = 'png' | 'copy' | 'share';

interface ClipboardEnv {
  isSecureContext?: boolean;
  clipboard?: { write?: unknown };
  ClipboardItem?: unknown;
}

/**
 * True when this browser can put a PNG on the clipboard. Needs a secure context, the async
 * Clipboard API and ClipboardItem; where `ClipboardItem.supports` exists it must accept PNG.
 */
export function canCopyImage(env: ClipboardEnv): boolean {
  const Item = env.ClipboardItem;
  if (!env.isSecureContext || typeof env.clipboard?.write !== 'function' || typeof Item !== 'function') return false;
  const supports = (Item as { supports?: unknown }).supports;
  return typeof supports !== 'function' || supports.call(Item, 'image/png') === true;
}

/**
 * Copies a PNG that is still being drawn. The item is built straight away, inside the click,
 * with a promise for the image: Safari refuses a clipboard write that only starts after an await.
 */
export function copyPng<I>(
  png: Promise<Blob>,
  clipboard: { write: (items: I[]) => Promise<void> },
  Item: new (items: Record<string, Promise<Blob>>) => I,
): Promise<void> {
  return clipboard.write([new Item({ 'image/png': png })]);
}

const WHAT: Record<ExportAction, string> = { png: 'make the PNG', copy: 'copy the image', share: 'open the share sheet' };
const INSTEAD: Record<ExportAction, string> = { png: 'Try the SVG instead.', copy: 'Download the PNG instead.', share: 'Download the PNG instead.' };

/**
 * What to tell the visitor when an export fails, or null when there is nothing to say
 * (closing the share sheet is a choice, not an error). The message never includes card content.
 */
export function exportProblem(action: ExportAction, err: unknown): string | null {
  const name = err instanceof Error || (typeof err === 'object' && err !== null && 'name' in err) ? String((err as { name: unknown }).name) : '';
  if (action === 'share' && name === 'AbortError') return null;
  const why = name === 'NotAllowedError'
    ? action === 'copy' ? 'the browser did not allow access to the clipboard' : 'the browser did not allow it'
    : 'something went wrong in this browser';
  return `Couldn't ${WHAT[action]}: ${why}. ${INSTEAD[action]}`;
}
