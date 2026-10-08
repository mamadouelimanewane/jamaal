import type { BlogPost } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

function toDateInputValue(date?: Date): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function BlogForm({
  action,
  post,
}: {
  action: (formData: FormData) => void;
  post?: BlogPost;
}) {
  return (
    <form action={action} className="mt-6 grid max-w-2xl gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Titre</label>
          <input name="title" required defaultValue={post?.title} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Slug (URL)</label>
          <input name="slug" required defaultValue={post?.slug} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Résumé</label>
        <textarea name="excerpt" required rows={2} defaultValue={post?.excerpt} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Contenu (un paragraphe par ligne)</label>
        <textarea
          name="content"
          required
          rows={8}
          defaultValue={post?.content.join("\n")}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Date de publication</label>
          <input type="date" name="date" defaultValue={toDateInputValue(post?.date)} className={inputClass} />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-navy/85">
          <input type="checkbox" name="published" defaultChecked={post?.published ?? true} />
          Publié (visible sur le site)
        </label>
      </div>
      <button
        type="submit"
        className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {post ? "Enregistrer" : "Publier l'article"}
      </button>
    </form>
  );
}
