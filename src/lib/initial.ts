/**
 * The first grapheme of a title, for the letter badge beside it.
 *
 * `title.charAt(0)` is the wrong tool: it reads one UTF-16 code unit, so a
 * title that opens with an emoji — anything outside the Basic Multilingual
 * Plane — yields half a surrogate pair, which the HTML serializer writes out
 * as U+FFFD. `Intl.Segmenter` walks user-perceived characters instead, so a
 * flag, a ZWJ sequence or a letter with a combining mark stays whole.
 * Leading whitespace is dropped first, so `"  Title"` reads as `T`, not as an
 * empty badge.
 */
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function initial(title: string): string {
  const first = graphemes.segment(title.trim())[Symbol.iterator]().next();
  return first.done ? "" : first.value.segment;
}
