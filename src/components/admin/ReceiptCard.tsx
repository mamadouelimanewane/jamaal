import { formatPrice } from "@/lib/currency";
import { BrandLogoPlain } from "@/components/BrandLogo";

export interface ReceiptData {
  orderId: string;
  customerName: string;
  date: string;
  items: { productName: string; volumeLabel: string; quantity: number; price: number }[];
  total: number;
  consultantName: string;
  consultantWhatsapp: string;
  deliveryMode: "RETRAIT_CONSULTANT" | "LIVRAISON_JAMAAL";
  status: string;
}

const statusLabels: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export function ReceiptCard({ data }: { data: ReceiptData }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        boxSizing: "border-box",
        background: "linear-gradient(160deg, #1d2f4f 0%, #273b60 100%)",
        color: "white",
        padding: 28,
        fontFamily: "Poppins, Arial, sans-serif",
        borderRadius: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 6 }}><BrandLogoPlain height={64} /></div>
        <p style={{ fontSize: 11, opacity: 0.7 }}>Luxury Cosmetics</p>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <p style={{ fontSize: 11, opacity: 0.6, margin: 0 }}>Commande pour</p>
        <p style={{ fontSize: 18, fontWeight: 600, margin: "2px 0 0" }}>{data.customerName}</p>
        <p style={{ fontSize: 11, opacity: 0.6, margin: "4px 0 0" }}>{data.date}</p>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.items.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ opacity: 0.9 }}>
              {item.productName} — {item.volumeLabel} × {item.quantity}
            </span>
            <span style={{ fontWeight: 600 }}>{formatPrice(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.2)",
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        <span>Total</span>
        <span>{formatPrice(data.total)}</span>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          opacity: 0.75,
        }}
      >
        <span>
          {data.deliveryMode === "LIVRAISON_JAMAAL" ? "Livraison directe JAMAAL" : "Remis par votre consultant"}
        </span>
        <span>Statut : {statusLabels[data.status] ?? data.status}</span>
      </div>

      <div
        style={{
          marginTop: 18,
          borderTop: "1px solid rgba(255,255,255,0.15)",
          paddingTop: 12,
          fontSize: 11,
          opacity: 0.85,
        }}
      >
        <p style={{ margin: 0 }}>Votre consultant JAMAAL</p>
        <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{data.consultantName}</p>
        <p style={{ margin: "2px 0 0" }}>{data.consultantWhatsapp}</p>
      </div>
    </div>
  );
}
