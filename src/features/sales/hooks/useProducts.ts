import { useState, useEffect } from "react";
import { liveQuery } from "dexie";
import { listProductsWithStock } from "../services/productService";
import type { ProductWithStock } from "../services/productService";

export function useProducts() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const observable = liveQuery(async () => listProductsWithStock());

    const sub = observable.subscribe({
      next: (data) => {
        setProducts(data);
        setLoading(false);
      },
      error: (error) => {
        console.error("Dexie: read products", error);
        setLoading(false);
      },
    });

    return () => sub.unsubscribe();
  }, []);

  return { products, loading };
}
