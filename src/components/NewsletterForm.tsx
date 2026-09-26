"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSent(true);
  }

  if (sent) {
    return <p className="text-sm text-rose-light">Merci ! Vous êtes inscrit·e à la newsletter JAMAAL.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Votre e-mail"
        className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-rose"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-rose px-4 py-2 text-sm font-semibold text-navy transition hover:bg-rose-light"
      >
        OK
      </button>
    </form>
  );
}
