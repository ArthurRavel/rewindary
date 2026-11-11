import { SITE_ADDRESS } from '../src/site.ts';

/**
 * Link-preview tags (Open Graph, X/Twitter), so a pasted app link unfurls with a title, a line and
 * public/og.jpg instead of a bare URL. Title and description are copied from index.html; the absolute
 * URLs come from SITE_ADDRESS because crawlers need them. Browsers never fetch these: they are text
 * for whoever unfurls the link, and the page itself still loads nothing but its own files.
 */
export const socialMeta = (html: string): string => {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!title || !description) throw new Error('index.html needs a <title> and a meta description');
  const url = `https://${SITE_ADDRESS}/`;
  const tags: [string, string][] = [
    ['property="og:type"', 'website'], ['property="og:site_name"', 'Rewindary'], ['property="og:title"', title],
    ['property="og:description"', description], ['property="og:url"', url], ['property="og:image"', `${url}og.jpg`],
    ['property="og:image:type"', 'image/jpeg'], ['property="og:image:width"', '1200'], ['property="og:image:height"', '630'],
    ['property="og:image:alt"', 'Rewindary: a sample share card with names hidden, next to the line “Your year, rewound into one story.”'],
    ['name="twitter:card"', 'summary_large_image'],
  ];
  return html.replace(/(\s*)<title>/, (_, ws: string) => tags.map(([k, v]) => `${ws}<meta ${k} content="${v.replace(/"/g, '&quot;')}" />`).join('') + `${ws}<title>`);
};
