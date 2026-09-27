import { LivreurForm } from "@/components/admin/LivreurForm";
import { createLivreur } from "@/lib/actions/livreurs";

export default function NewLivreurPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouveau livreur</h1>
      <LivreurForm action={createLivreur} />
    </div>
  );
}
