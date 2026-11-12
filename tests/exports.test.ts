import { describe, expect, it } from 'vitest';
import { canCopyImage, copyPng, exportProblem } from '../src/ui/exports';

const write = async () => {};
class Item { constructor(readonly items: Record<string, Promise<Blob>>) {} }

describe('copying a card image', () => {
  it('is offered only with a secure context, clipboard.write and ClipboardItem', () => {
    expect(canCopyImage({ isSecureContext: true, clipboard: { write }, ClipboardItem: Item })).toBe(true);
    expect(canCopyImage({ isSecureContext: false, clipboard: { write }, ClipboardItem: Item })).toBe(false);
    expect(canCopyImage({ isSecureContext: true, clipboard: {}, ClipboardItem: Item })).toBe(false);
    expect(canCopyImage({ isSecureContext: true, clipboard: undefined, ClipboardItem: Item })).toBe(false);
    expect(canCopyImage({ isSecureContext: true, clipboard: { write }, ClipboardItem: undefined })).toBe(false);
  });

  it('respects ClipboardItem.supports when the browser has it', () => {
    const asked: string[] = [];
    class Png extends Item { static supports(t: string) { asked.push(t); return t === 'image/png'; } }
    class NoPng extends Item { static supports() { return false; } }
    expect(canCopyImage({ isSecureContext: true, clipboard: { write }, ClipboardItem: Png })).toBe(true);
    expect(asked).toEqual(['image/png']);
    expect(canCopyImage({ isSecureContext: true, clipboard: { write }, ClipboardItem: NoPng })).toBe(false);
  });

  it('builds the clipboard item synchronously, holding the PNG still being drawn', async () => {
    const written: Item[][] = [];
    let finish!: (b: Blob) => void;
    const png = new Promise<Blob>((res) => { finish = res; });
    const done = copyPng(png, { write: async (items: Item[]) => { written.push(items); } }, Item);
    // The write has already started, before the image exists: Safari requires that.
    expect(written).toHaveLength(1);
    expect(Object.keys(written[0][0].items)).toEqual(['image/png']);
    expect(written[0][0].items['image/png']).toBe(png);
    finish(new Blob(['x'], { type: 'image/png' }));
    await done;
  });

  it('passes a clipboard refusal back to the caller', async () => {
    const refused = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    await expect(copyPng(Promise.resolve(new Blob()), { write: async () => { throw refused; } }, Item)).rejects.toBe(refused);
  });
});

describe('export problems', () => {
  const named = (name: string) => Object.assign(new Error('internal detail'), { name });

  it('stays quiet when the share sheet is closed', () => {
    expect(exportProblem('share', named('AbortError'))).toBeNull();
  });

  it('names the problem and a way out for each action', () => {
    expect(exportProblem('copy', named('NotAllowedError'))).toBe("Couldn't copy the image: the browser did not allow access to the clipboard. Download the PNG instead.");
    expect(exportProblem('png', new Error('PNG encoding failed'))).toBe("Couldn't make the PNG: something went wrong in this browser. Try the SVG instead.");
    expect(exportProblem('share', named('NotAllowedError'))).toBe("Couldn't open the share sheet: the browser did not allow it. Download the PNG instead.");
    expect(exportProblem('copy', named('AbortError'))).toMatch(/^Couldn't copy the image: .*Download the PNG instead\.$/);
  });

  it('never repeats the error message, and copes with non-Error values', () => {
    for (const e of [new Error('Velvet Static secret'), 'Velvet Static', null, undefined, { name: 42 }]) {
      const text = exportProblem('png', e)!;
      expect(text).not.toMatch(/Velvet|secret|internal/);
      expect(text).toMatch(/Try the SVG instead\.$/);
    }
  });
});
