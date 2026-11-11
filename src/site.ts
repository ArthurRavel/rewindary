/**
 * Where this copy of Rewindary lives and where its code is. A fork that hosts its own copy changes
 * these two lines. They are text and a link the visitor may choose to follow: nothing is ever fetched
 * from them (the CSP would block it anyway). SOURCE_URL is the one remote URL the source and dist scans allow
 * outside the demo data, and only exactly as written here.
 */

/**
 * Printed in the share-card footer, so someone who sees a card can find the app. No scheme: it is read, not clicked.
 * The build also turns it into the link-preview tags' og:url and og:image (vite.config.ts), which only unfurlers read.
 */
export const SITE_ADDRESS = 'arthurravel.github.io/rewindary';

/** Linked from the start page and the end of the story, so the "open source" claim can be checked. */
export const SOURCE_URL = 'https://github.com/ArthurRavel/rewindary';
