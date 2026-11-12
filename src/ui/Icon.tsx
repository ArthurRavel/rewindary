/** Inline stroke icons (one 24px grid, one stroke weight). Inline SVG keeps them inside the strict CSP. */
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  back: 'M19 12H5m6-6l-6 6 6 6',
  upload: 'M12 15.5V4m-4.5 4.5L12 4l4.5 4.5M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3',
  chevron: 'M9 6l6 6-6 6',
  download: 'M12 4v11.5m-4.5-4.5L12 15.5l4.5-4.5M5 20h14',
  copy: 'M10 9h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 20h-8a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 10 9zM15.5 9V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5',
  check: 'M5 12.5l4.5 4.5L19 7',
  calendar: 'M8 3.5v3M16 3.5v3M4.5 10h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg class={`icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The Rewindary mark, same drawing as public/favicon.svg. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg class="mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#171127" />
      <path d="M32 12a20 20 0 1 1-18.5 12.4" fill="none" stroke="#c89bff" stroke-width="6" stroke-linecap="round" />
      <path d="M8 16l6 9 9-5" fill="none" stroke="#c89bff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="32" cy="32" r="6" fill="#3ddc97" />
    </svg>
  );
}
