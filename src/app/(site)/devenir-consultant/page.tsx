"use client";

import { useState } from "react";

export default function DevenirConsultantPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">
        Devenir consultant·e JAMAAL
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-navy/70">
        Rejoignez le réseau de consultant·es indépendant·es JAMAAL et proposez notre collection de
        parfums et cosmétiques à votre entourage, avec votre propre vitrine en ligne. Laissez-nous
        vos coordonnées, un membre de l&apos;équipe JAMAAL vous recontacte rapidement.
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-center">
          <p className="font-semibold text-navy">Merci {form.name || ""} !</p>
          <p className="mt-2 text-sm text-navy/70">
            Votre demande a bien été enregistrée. Nous revenons vers vous très vite.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/60">
              Nom complet
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/60">
              E-mail
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-navy/60">
              Téléphone
            </label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Envoyer ma demande
          </button>
        </form>
      )}
    </div>
  );
}
