"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { updateMyShop, type ShopState } from "@/lib/actions/my-shop";
import { compressLogo, compressPhoto } from "@/lib/compress-photo";
import { ProductPicker, type PickerProduct } from "./GrowthWidgets";
import { ThemeSelector } from "./ThemeSelector";

/** Réglages de la boutique personnelle : photo, thème, slogan, présentation, coups de cœur (8 au plus). */
export function MyShopForm({
  photo,
  logo = null,
  bio,
  tagline,
  theme,
  look,
  favorites,
  products,
  name,
  titleForm,
  badges,
}: {
  photo: string | null;
  logo?: string | null;
  bio: string | null;
  tagline?: string | null;
  theme?: string | null;
  look?: { accent: number; hero: string; typo: string; hidden: string[] };
  favorites: string[];
  products: PickerProduct[];
  name: string;
  titleForm: string | null;
  badges: string[];
}) {
  const [state, action, pending] = useActionState<ShopState, FormData>(updateMyShop, { ok: false });
  const [preview, setPreview] = useState<string | null>(photo);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [text, setText] = useState(bio ?? "");
  const [taglineText, setTaglineText] = useState(tagline ?? "");
  const input = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(logo);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    const small = await compressLogo(f);
    setLogoFile(small);
    setLogoRemoved(false);
    setLogoPreview(URL.createObjectURL(small));
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    const small = await compressPhoto(f).catch(() => f);
    const out = new File([small], "photo.jpg", { type: small.type || "image/jpeg" });
    setFile(out);
    setRemoved(false);
    setPreview(URL.createObjectURL(out));
  }

  return (
    <form
      action={(fd) => {
        if (file) fd.set("photo", file);
        if (removed) fd.set("removePhoto", "1");
        if (logoFile) fd.set("logo", logoFile);
        if (logoRemoved) fd.set("removeLogo", "1");
        action(fd);
      }}
      className="space-y-7"
    >
      {/* 1. Photo de profil */}
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-navy shadow-lg">
          {preview && !removed ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu
            <img src={preview} alt="Ma photo" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif-display text-3xl text-white">
              {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            <Camera size={15} /> {preview && !removed ? "Changer ma photo" : "Ajouter ma photo"}
          </button>
          {preview && !removed && (
            <button
              type="button"
              onClick={() => setRemoved(true)}
              className="text-left text-xs font-semibold text-navy/60 hover:text-rose-dark"
            >
              Retirer la photo
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            onChange={pick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* 1 bis. Logo, en haut de la boutique */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-cream/40 p-4">
        <div className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-[length:16px_16px] bg-[linear-gradient(45deg,#f1ece6_25%,transparent_25%,transparent_75%,#f1ece6_75%),linear-gradient(45deg,#f1ece6_25%,#fff_25%,#fff_75%,#f1ece6_75%)] bg-[position:0_0,8px_8px]">
          {logoPreview && !logoRemoved ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu
            <img src={logoPreview} alt="Mon logo" className="max-h-20 max-w-36 object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-navy/60">Pas encore de logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">Mon logo</p>
          <p className="text-xs text-navy/70">Affiché en haut de votre boutique, au-dessus de vos informations. PNG à fond transparent conseillé, 2 Mo au plus. Sans logo, votre photo (ou vos initiales) prend sa place.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => logoInput.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light">
              <ImageIcon size={15} /> {logoPreview && !logoRemoved ? "Changer mon logo" : "Ajouter mon logo"}
            </button>
            {logoPreview && !logoRemoved && (
              <button type="button" onClick={() => setLogoRemoved(true)} className="text-xs font-semibold text-navy/60 hover:text-rose-dark">Retirer le logo</button>
            )}
          </div>
          <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} className="sr-only" tabIndex={-1} aria-hidden="true" />
        </div>
      </div>

      {/* 2. Bibliothèque de Thèmes */}
      <ThemeSelector initialTheme={theme} initialAccent={look?.accent} initialHero={look?.hero} initialTypo={look?.typo} initialHidden={look?.hidden} consultantName={name} avatarUrl={preview && !removed ? preview : null} logoUrl={logoPreview && !logoRemoved ? logoPreview : null} />

      {/* 3. Slogan / Phrase d'accroche */}
      <label className="block text-sm font-medium text-navy">
        Slogan / Phrase d&apos;accroche <span className="text-navy/50">({taglineText.length}/100)</span>
        <input
          name="tagline"
          value={taglineText}
          onChange={(e) => setTaglineText(e.target.value.slice(0, 100))}
          placeholder="Ex. Vos fragrances d'exception livrées partout à Dakar."
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy"
        />
        <span className="mt-1 block text-xs text-navy/55">Affiché en sous-titre juste sous votre nom sur votre page personnelle.</span>
      </label>

      {/* 4. Bio / Présentation */}
      <label className="block text-sm font-medium text-navy">
        Ma présentation <span className="text-navy/50">({text.length}/220)</span>
        <textarea
          name="bio"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 220))}
          rows={3}
          placeholder="Ex. Passionnée de parfums depuis 5 ans, je vous conseille et je livre à Dakar et Thiès. Écrivez-moi !"
          className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy outline-none focus:border-navy"
        />
      </label>

      {/* 5. Badges de l'Académie */}
      <fieldset className="rounded-2xl bg-cream/60 p-4 border border-line/60">
        <legend className="px-1 text-sm font-medium text-navy">Mes badges de l&apos;Académie</legend>
        {badges.length ? (
          <p className="text-sm text-navy">{badges.join(" · ")}</p>
        ) : (
          <p className="text-sm text-navy/70">
            Aucun badge pour le moment : suivez l&apos;
            <Link href="/admin/academie" className="font-semibold text-rose-dark underline">
              Académie
            </Link>{" "}
            pour les afficher ici.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-navy">
          <label className="flex items-center gap-2">
            <input type="radio" name="titleForm" value="f" defaultChecked={titleForm !== "m"} /> Au féminin (Experte parfums)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="titleForm" value="m" defaultChecked={titleForm === "m"} /> Au masculin (Expert parfums)
          </label>
        </div>
      </fieldset>

      {/* 6. Coups de cœur */}
      <div>
        <p className="text-sm font-medium text-navy">
          Mes coups de cœur <span className="text-navy/50">(8 au plus, dans l&apos;ordre d&apos;affichage)</span>
        </p>
        <p className="mb-2 text-xs text-navy/60">Sans choix, votre boutique montre vos meilleures ventes.</p>
        <ProductPicker
          products={products}
          initial={favorites}
          max={8}
          showValue={false}
          removeLabel="Retirer de mes coups de cœur"
        />
      </div>

      {state.error && <p role="alert" className="text-sm font-medium text-rose-dark">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm font-medium text-emerald-800">{state.message}</p>}

      <button
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-full bg-rose-dark px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-rose-dark/90 disabled:opacity-60"
      >
        {pending && <Loader2 size={15} className="animate-spin" />} Enregistrer ma boutique
      </button>
    </form>
  );
}
