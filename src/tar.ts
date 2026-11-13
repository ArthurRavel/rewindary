/**
 * A minimal streaming tar reader, for Google Takeout's ".tgz" file type. It reads ustar headers, GNU long
 * names and pax paths and sizes; it never seeks or buffers more than one 512-byte header. Only the entries
 * `onEntry` returns a sink for are handed their data, the rest is passed over.
 */
export type EntrySink = (data: Uint8Array, final: boolean) => void;

const BLOCK = 512;
/** Long-name and pax records are tiny; anything bigger is not something this reader trusts. */
const MAX_META_BYTES = 1024 * 1024;

const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const cstr = (b: Uint8Array) => {
  const end = b.indexOf(0);
  return decode(end === -1 ? b : b.subarray(0, end));
};

function octal(b: Uint8Array): number {
  // Sizes over 8 GB use base-256: the top bit of the first byte is set and the rest is big-endian binary.
  if (b[0] & 0x80) {
    let n = 0;
    for (let i = 1; i < b.length; i++) n = n * 256 + b[i];
    return n;
  }
  const s = cstr(b).trim();
  return s ? parseInt(s, 8) : 0;
}

function checksumOk(h: Uint8Array): boolean {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 0x20 : h[i];
  return octal(h.subarray(148, 156)) === sum;
}

/** pax extended header records: "<length> <key>=<value>\n", the length counting bytes of the whole record. */
function paxRecords(b: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  let o = 0;
  while (o < b.length) {
    const sp = b.indexOf(0x20, o);
    if (sp === -1) break;
    const len = parseInt(decode(b.subarray(o, sp)), 10);
    if (!(len > 0) || o + len > b.length) break;
    const rec = decode(b.subarray(sp + 1, o + len - 1));
    const eq = rec.indexOf('=');
    if (eq > 0) out.set(rec.slice(0, eq), rec.slice(eq + 1));
    o += len;
  }
  return out;
}

export class TarReader {
  private head = new Uint8Array(BLOCK);
  private headLen = 0;
  private left = 0;
  private pad = 0;
  private sink: EntrySink | null = null;
  private nextName: string | null = null;
  private nextSize: number | null = null;

  constructor(private onEntry: (path: string, size: number) => EntrySink | null) {}

  push(data: Uint8Array): void {
    let o = 0;
    while (o < data.length) {
      if (this.left > 0) {
        const n = Math.min(this.left, data.length - o);
        this.left -= n;
        this.sink?.(data.subarray(o, o + n), this.left === 0);
        if (this.left === 0) this.sink = null;
        o += n;
      } else if (this.pad > 0) {
        const n = Math.min(this.pad, data.length - o);
        this.pad -= n;
        o += n;
      } else {
        const n = Math.min(BLOCK - this.headLen, data.length - o);
        this.head.set(data.subarray(o, o + n), this.headLen);
        this.headLen += n;
        o += n;
        if (this.headLen === BLOCK) {
          this.headLen = 0;
          this.header(this.head);
        }
      }
    }
  }

  /** Throws if the archive stopped in the middle of an entry. */
  end(): void {
    if (this.left > 0 || this.headLen > 0) throw new Error('The archive ends in the middle of a file.');
  }

  private header(h: Uint8Array): void {
    // Zero blocks mark the end of the archive (and fill the last record); there is nothing after them.
    if (h.every((b) => b === 0)) return;
    if (!checksumOk(h)) throw new Error('Not a tar archive.');
    const type = String.fromCharCode(h[156]);
    let size = octal(h.subarray(124, 136));
    let name = cstr(h.subarray(0, 100));
    const prefix = decode(h.subarray(257, 262)) === 'ustar' ? cstr(h.subarray(345, 500)) : '';
    if (prefix) name = `${prefix}/${name}`;
    if (type === 'L' || type === 'x') {
      if (size > MAX_META_BYTES) throw new Error('Not a tar archive.');
      const parts: Uint8Array[] = [];
      this.begin(size, (d, final) => {
        parts.push(d.slice());
        if (!final) return;
        const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let at = 0;
        for (const p of parts) { all.set(p, at); at += p.length; }
        if (type === 'L') this.nextName = cstr(all);
        else {
          const pax = paxRecords(all);
          if (pax.has('path')) this.nextName = pax.get('path')!;
          if (pax.has('size')) this.nextSize = Number(pax.get('size'));
        }
      });
      return;
    }
    if (this.nextName !== null) name = this.nextName;
    if (this.nextSize !== null && Number.isFinite(this.nextSize)) size = this.nextSize;
    this.nextName = this.nextSize = null;
    // Regular files only ('0', NUL from old tars, '7' contiguous). Directories, links and global headers are passed over.
    const file = type === '0' || type === '\0' || type === '7';
    this.begin(size, file ? this.onEntry(name, size) : null);
  }

  private begin(size: number, sink: EntrySink | null): void {
    this.pad = (BLOCK - (size % BLOCK)) % BLOCK;
    this.left = size;
    if (size === 0) sink?.(new Uint8Array(0), true);
    else this.sink = sink;
  }
}
