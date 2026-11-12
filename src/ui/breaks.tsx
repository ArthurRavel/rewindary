import { Fragment } from 'preact';

/**
 * Lets a path or address wrap after each "/" on a narrow screen ("CONTENT_INTERACTION/ViewingActivity.csv",
 * "arthurravel.github.io/rewindary"). A <wbr> adds no text, so what is read or copied is unchanged.
 */
export function slashBreaks(text: string) {
  return text.split('/').map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <>/<wbr /></>}
      {part}
    </Fragment>
  ));
}
