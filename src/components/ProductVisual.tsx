import Image from "next/image";
import type { Product } from "@/data/types";
import { ProductBottle } from "./ProductBottle";

export function ProductVisual({ product, className, sizes, fit = "cover" }: { product: Product; className?: string; sizes?: string; fit?: "cover" | "contain" }) {
  if (product.photo) return <Image src={product.photo} alt={product.name} fill sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"} className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className ?? ""}`}/>;
  return <ProductBottle colorFrom={product.colorFrom} colorTo={product.colorTo} category={product.category} number={product.number} id={product.id} className={className}/>;
}