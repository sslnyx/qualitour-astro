// Break a long Chinese paragraph into shorter ones for display. Only between whole sentences; the parts join back exactly.
const openers = '（(「『“《【', closers = '）)」』”》】';
const enders = '。！？!?';

export function splitChinese(text, max = 110) {
  if (text.length <= max) return [text];
  const sentences = [];
  let depth = 0, start = 0, ended = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (openers.includes(char)) depth++;
    else if (closers.includes(char)) depth = Math.max(0, depth - 1);
    if (enders.includes(char)) ended = true;
    else if (!closers.includes(char)) ended = false;
    const next = text[i + 1] || '';
    if (ended && depth === 0 && !enders.includes(next) && !closers.includes(next)) {
      sentences.push(text.slice(start, i + 1));
      start = i + 1; ended = false;
    }
  }
  if (start < text.length) sentences.push(text.slice(start));
  const parts = [];
  for (const sentence of sentences) {
    if (parts.length && parts.at(-1).length + sentence.length <= max) parts[parts.length - 1] += sentence;
    else parts.push(sentence);
  }
  // A few words left alone at the end read worse than a slightly longer last paragraph.
  if (parts.length > 1 && parts.at(-1).length < 20) parts.splice(-2, 2, parts.at(-2) + parts.at(-1));
  return parts;
}
