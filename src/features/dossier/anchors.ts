// JD anchors (spec 2.3, Posting): the sentence of the JD that contains a fit item's `anchor_text`
// is wrapped in <mark data-req="id1 id2">, which the reader draws as an underline with a popover.
// A small rehype plugin working on the hast tree; it never parses or emits HTML.
import type { Element, ElementContent, Root, Text } from "hast";

export type Anchor = { id: string; text: string };

const BLOCKS = new Set(["p", "li", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "dd", "dt"]);

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive, whitespace-tolerant, quote-tolerant matcher for one anchor. */
export function anchorPattern(text: string): RegExp | null {
  const t = text.trim();
  if (t.length < 3) return null;
  const src = t
    .split(/\s+/)
    .map((w) =>
      escape(w)
        .replace(/['’‘]/g, "['’‘]")
        .replace(/["“”]/g, '["“”]')
        .replace(/[-–—]/g, "[-–—]"),
    )
    .join("\\s+");
  return new RegExp(src, "i");
}

/** Sentence bounds around [start, end) inside one text value. */
function sentenceAround(value: string, start: number, end: number): [number, number] {
  let s = 0;
  const before = value.slice(0, start);
  const re = /[.!?;](\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(before))) s = m.index + m[0].length;
  const after = value.slice(end);
  const e = after.search(/[.!?](\s|$)/);
  const stop = e === -1 ? value.length : end + e + 1;
  // keep leading whitespace outside the underline
  while (s < start && /\s/.test(value[s])) s++;
  return [s, stop];
}

type Range = { start: number; end: number; ids: Set<string> };

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start < last.end) {
      last.end = Math.max(last.end, r.end);
      r.ids.forEach((id) => last.ids.add(id));
    } else out.push({ start: r.start, end: r.end, ids: new Set(r.ids) });
  }
  return out;
}

function mark(ids: Iterable<string>, children: ElementContent[]): Element {
  return { type: "element", tagName: "mark", properties: { dataReq: [...ids].join(" ") }, children };
}

function textOf(node: ElementContent | Root): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" || node.type === "root") return node.children.map((c) => textOf(c as ElementContent)).join("");
  return "";
}

/**
 * Which anchors appear in a markdown text (formatting stripped), so the Fit tab can offer
 * "Show in the posting" only for those. Mirrors what rehypeAnchors() can find.
 */
export function anchorsFound(markdown: string | null | undefined, anchors: Anchor[]): Set<string> {
  const out = new Set<string>();
  if (!markdown) return out;
  const plain = markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ");
  for (const a of anchors) {
    const re = anchorPattern(a.text);
    if (re?.test(plain)) out.add(a.id);
  }
  return out;
}

/** rehype plugin factory: `rehypePlugins={[rehypeAnchors(anchors)]}`. */
export function rehypeAnchors(anchors: Anchor[]) {
  const patterns = anchors
    .map((a) => ({ id: a.id, re: anchorPattern(a.text) }))
    .filter((a): a is { id: string; re: RegExp } => a.re !== null);

  return () => (tree: Root) => {
    const hit = new Set<string>();
    if (!patterns.length) return;

    // Pass 1: inside single text nodes, underline the sentence that holds the anchor.
    const walk = (parent: Root | Element) => {
      const next: Array<Root["children"][number]> = [];
      for (const child of parent.children) {
        if (child.type === "element") {
          if (child.tagName !== "mark" && child.tagName !== "code" && child.tagName !== "pre") walk(child);
          next.push(child);
          continue;
        }
        if (child.type !== "text") {
          next.push(child);
          continue;
        }
        const value = (child as Text).value;
        const ranges: Range[] = [];
        for (const p of patterns) {
          const m = p.re.exec(value);
          if (!m) continue;
          const [s, e] = sentenceAround(value, m.index, m.index + m[0].length);
          ranges.push({ start: s, end: e, ids: new Set([p.id]) });
          hit.add(p.id);
        }
        if (!ranges.length) {
          next.push(child);
          continue;
        }
        let at = 0;
        for (const r of mergeRanges(ranges)) {
          if (r.start > at) next.push({ type: "text", value: value.slice(at, r.start) });
          next.push(mark(r.ids, [{ type: "text", value: value.slice(r.start, r.end) }]));
          at = r.end;
        }
        if (at < value.length) next.push({ type: "text", value: value.slice(at) });
      }
      parent.children = next as typeof parent.children;
    };
    walk(tree);

    // Pass 2: anchors split by inline formatting (**bold**, links): underline the whole block.
    const missing = patterns.filter((p) => !hit.has(p.id));
    if (missing.length) {
      const visit = (node: Root | Element) => {
        for (const child of node.children) {
          if (child.type !== "element") continue;
          const nestedBlock = child.children.some((c) => c.type === "element" && (BLOCKS.has(c.tagName) || c.tagName === "ul" || c.tagName === "ol"));
          if (BLOCKS.has(child.tagName) && !nestedBlock) {
            const text = textOf(child).replace(/\s+/g, " ");
            const ids = missing.filter((p) => !hit.has(p.id) && p.re.test(text)).map((p) => p.id);
            if (ids.length) {
              ids.forEach((id) => hit.add(id));
              child.children = [mark(ids, child.children)];
              continue;
            }
          }
          visit(child);
        }
      };
      visit(tree);
    }
  };
}
