"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";

/** Rendu Markdown minimal et sûr : gras, liens internes, listes à puces, paragraphes. */
function renderInline(text: string, key: string, linkClassName: string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2];
      out.push(
        href.startsWith("/") && !href.startsWith("//") ? (
          <Link key={`${key}-${i++}`} href={href} onClick={onNavigate} className={linkClassName}>
            {m[1]}
          </Link>
        ) : (
          m[1]
        )
      );
    } else {
      out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ChatMarkdown({ text, onNavigate, linkClassName = "font-medium text-[#8a5a44] underline underline-offset-2" }: { text: string; onNavigate?: () => void; linkClassName?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((l, j) => (
            <li key={j}>{renderInline(l, `li-${blocks.length}-${j}`, linkClassName, onNavigate)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  text.split("\n").forEach((raw, n) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) return void list.push(bullet[1]);
    flush();
    if (!line.trim()) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      <p key={`p-${n}`} className={heading ? "mt-2 font-semibold" : "my-1"}>
        {renderInline(heading ? heading[1] : line, `p-${n}`, linkClassName, onNavigate)}
      </p>
    );
  });
  flush();
  return <>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>;
}
