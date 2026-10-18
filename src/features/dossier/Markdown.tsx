"use client";

import type { ComponentProps, ElementType, JSX } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "@/ui";

/**
 * Markdown for notes, JD snapshots and answers. react-markdown with remark-gfm and **no rehype-raw**:
 * raw HTML inside the text is dropped, never injected (spec 8, WP7). Links open in a new tab.
 * Sizes inherit from the parent, so the same renderer serves 16px notes and the 18px reader.
 */
/** react-markdown passes the hast `node`; it must not reach the DOM. */
export function omitNode<P extends object>(props: P): Omit<P, "node"> {
  const out = { ...props } as P & { node?: unknown };
  delete out.node;
  return out;
}

function tag<T extends keyof JSX.IntrinsicElements>(Tag: T, className: string) {
  function Styled(props: ComponentProps<T> & { node?: unknown }) {
    const rest = omitNode(props) as Record<string, unknown>;
    const El = Tag as unknown as ElementType;
    return <El {...rest} className={cx(className, rest.className as string | undefined)} />;
  }
  Styled.displayName = `md-${String(Tag)}`;
  return Styled;
}

const base: Components = {
  p: tag("p", "my-[0.8em] first:mt-0 last:mb-0"),
  h1: tag("h2", "mt-[1.4em] mb-[0.4em] font-sans text-h3 text-ink first:mt-0"),
  h2: tag("h3", "mt-[1.4em] mb-[0.4em] font-sans text-h3 text-ink first:mt-0"),
  h3: tag("h4", "mt-[1.2em] mb-[0.3em] font-sans text-body font-semibold text-ink first:mt-0"),
  h4: tag("h5", "mt-[1.2em] mb-[0.3em] font-sans text-body font-semibold text-ink first:mt-0"),
  h5: tag("h6", "mt-[1em] mb-[0.3em] font-sans text-small font-semibold text-ink first:mt-0"),
  h6: tag("h6", "mt-[1em] mb-[0.3em] font-sans text-small font-semibold text-ink first:mt-0"),
  ul: tag("ul", "my-[0.8em] list-disc pl-[1.3em] marker:text-ink-3"),
  ol: tag("ol", "my-[0.8em] list-decimal pl-[1.4em] marker:text-ink-3"),
  li: tag("li", "my-[0.25em] pl-[0.2em]"),
  blockquote: tag("blockquote", "my-[0.8em] border-l-2 border-line-strong pl-4 text-ink-2"),
  code: tag("code", "rounded-[4px] bg-surface-2 px-1 font-mono text-[0.85em]"),
  pre: tag("pre", "my-[0.8em] overflow-x-auto rounded-sm bg-surface-2 p-3 text-small"),
  th: tag("th", "border-b border-line-strong px-2 py-1.5 text-left font-medium"),
  td: tag("td", "border-b border-line px-2 py-1.5 align-top"),
  a: function MdLink(props) {
    const rest = omitNode(props);
    return (
      <a
        {...rest}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-accent underline decoration-1 underline-offset-[3px] hover:decoration-2"
      />
    );
  },
  hr: function MdRule() {
    return <hr className="my-[1.4em] border-line" />;
  },
  table: function MdTable(props) {
    const rest = omitNode(props);
    return (
      <div className="my-[0.8em] overflow-x-auto">
        <table {...rest} className="w-full border-collapse font-sans text-small" />
      </div>
    );
  },
  img: function MdImage({ alt }) {
    return <span className="text-ink-3">[image{alt ? `: ${alt}` : ""}]</span>;
  },
};

export function Markdown({
  text,
  components,
  rehypePlugins,
  className,
}: {
  text: string;
  components?: Components;
  rehypePlugins?: Options["rehypePlugins"];
  className?: string;
}) {
  return (
    <div className={cx("min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={{ ...base, ...components }} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
