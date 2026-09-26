import Image from "next/image";
import { Product } from "@/data/types";
import { ProductBottle } from "./ProductBottle";

export function ProductVisual({
  product,
  className,
  sizes,
}: {
  product: Product;
  className?: string;
  sizes?: string;
}) {
  if (product.photo) {
    return (
      <Image
        src={product.photo}
        alt={product.name}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 25vw"}
        className={`object-cover ${className ?? ""}`}
      />
    );
  }

  return (
    <ProductBottle
      colorFrom={product.colorFrom}
      colorTo={product.colorTo}
      category={product.category}
      number={product.number}
      className={className}
    />
  );
}
