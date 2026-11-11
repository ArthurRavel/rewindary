import type { ComponentChildren } from 'preact';
import { SOURCE_URL } from '../site';

/**
 * A plain link to the source code. Nothing is loaded from it unless the visitor follows it, and then in a
 * new tab with no referrer and no opener, so the story and its data stay in this tab.
 */
export function SourceLink({ children }: { children: ComponentChildren }) {
  return (
    <a class="link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer" data-testid="source-link">
      {children}<span class="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
