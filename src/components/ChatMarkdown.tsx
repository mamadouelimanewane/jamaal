"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import Link from "next/link";

/** Liens externes autorisés : WhatsApp (wa.me) et le site lui-même. Les autres restent du texte. */
export function isSafeExternal(href: string, host = typeof window !== "undefined" ? window.location.host : ""): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return false;
    return u.host === "wa.me" || u.host === "api.whatsapp.com" || (!!host && u.host === host);
  } catch {
    return false;
  }
}

/** Rendu Markdown minimal et sûr : gras, italique, liens internes (même dans du gras), listes, paragraphes. */
export function renderInline(text: string, key: string, linkClassName: string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  // Gras (**…**, contenu rendu à son tour : il peut contenir un lien), lien [texte](/chemin), italique (*…* ou _…_).
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<![\w/])_(?!\s)([^_\n]+?)_(?!\w)|(https:\/\/[^\s<>()]+[^\s<>().,;:!?»"'])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={k}>{renderInline(m[1], k, linkClassName, onNavigate)}</strong>);
    } else if (m[2] !== undefined) {
      const href = m[3];
      out.push(
        href.startsWith("/") && !href.startsWith("//") ? (
          <Link key={k} href={href} onClick={onNavigate} className={linkClassName}>
            {m[2]}
          </Link>
        ) : isSafeExternal(href) ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
            {m[2]}
          </a>
        ) : (
          m[2]
        )
      );
    } else if (m[6] !== undefined) {
      const href = m[6];
      out.push(
        isSafeExternal(href) ? (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className={`break-all ${linkClassName}`}>
            {href.startsWith("https://wa.me/") ? "Écrire sur WhatsApp" : href.replace(/^https:\/\//, "")}
          </a>
        ) : (
          href
        )
      );
    } else {
      out.push(<em key={k}>{m[4] ?? m[5]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Texte prêt à copier (bloc ``` … ```) : boutons « Copier » et « Envoyer sur WhatsApp ». */
function CopyCard({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-ia/25 bg-ia-light/50">
      <p className="whitespace-pre-wrap break-words px-3 py-2.5 text-[13px] leading-relaxed text-navy">{text}</p>
      <div className="flex border-t border-ia/20 text-xs font-semibold">
        <button type="button" onClick={copy} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-navy hover:bg-white">
          {done ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {done ? "Copié" : "Copier"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-ia/20 py-2 text-emerald-700 hover:bg-white"
        >
          <MessageCircle size={14} /> Envoyer sur WhatsApp
        </a>
      </div>
    </div>
  );
}

export function ChatMarkdown({ text, onNavigate, linkClassName = "font-medium text-[#8a5a44] underline underline-offset-2", copyable = false }: { text: string; onNavigate?: () => void; linkClassName?: string; copyable?: boolean }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let fence: string[] | null = null;
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
    if (/^\s*```/.test(line)) {
      if (fence === null) {
        flush();
        fence = [];
      } else {
        const body = fence.join("\n").trim();
        fence = null;
        if (body)
          blocks.push(
            copyable ? <CopyCard key={`c-${n}`} text={body} /> : <p key={`c-${n}`} className="my-1 whitespace-pre-wrap">{body}</p>
          );
      }
      return;
    }
    if (fence !== null) return void fence.push(raw);
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
  const open = fence as string[] | null;
  if (open && open.join("").trim()) {
    const body = open.join("\n").trim();
    blocks.push(copyable ? <CopyCard key="c-end" text={body} /> : <p key="c-end" className="my-1 whitespace-pre-wrap">{body}</p>);
  }
  return <>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>;
}
