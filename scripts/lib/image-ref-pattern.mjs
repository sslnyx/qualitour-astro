// References to images in rendered HTML that the site build replaces with static derivatives.
// Island props are HTML-escaped JSON, so a URL inside them ends at `&quot;` (or `&#39;`), not at a raw quote: a pattern
// that only stops at raw quote characters swallows that terminator and breaks the JSON (the tabs stop working).
export const refPattern = /\/_image\?(?:(?!&(?:quot|#39|apos|lt|gt);)[^"'\s,)<>])+|\/img\/(?!s-)[^"'\s,)<>/]+-\d+\.webp/g;
