"use client";

import { useState } from "react";
import { importChoganExcelAction } from "@/lib/actions/import-chogan";

export function ImportForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; countNew?: number; countUpdated?: number; error?: string } | null>(null);

  async function handleAction(formData: FormData) {
    setLoading(true);
    setResult(null);
    try {
      const res = await importChoganExcelAction(formData);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-10">
      <h2 className="font-serif-display text-xl font-semibold text-navy">Importer depuis Excel ou Chogan Script</h2>
      <p className="mt-2 text-sm text-navy/70">
        Téléchargez le fichier Excel (.xlsx) contenant vos produits Chogan, ou le fichier texte (.txt / .json) généré par le script d'exportation de votre navigateur.
      </p>

      <form action={handleAction} className="mt-8 space-y-6">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-navy">Fichier (.xlsx, .txt, .json)</label>
          <input
            type="file"
            name="file"
            id="file"
            accept=".xlsx,.xls,.txt,.json"
            required
            className="mt-2 block w-full rounded-xl border border-line p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-cream file:px-4 file:py-2 file:text-sm file:font-semibold file:text-navy hover:file:bg-line/50"
          />
        </div>

        {result && (
          <div className={`rounded-xl p-4 text-sm ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {result.success ? (
              <p>
                Importation terminée avec succès ! <br />
                <strong>{result.countNew}</strong> nouveaux produits ajoutés.<br />
                <strong>{result.countUpdated}</strong> produits mis à jour.
              </p>
            ) : (
              <p>Erreur: {result.error}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-navy px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-navy-light disabled:opacity-70"
        >
          {loading ? "Importation en cours..." : "Lancer l'importation"}
        </button>
      </form>
    </div>
  );
}
