'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = {
  id: number;
  name: string;
  price: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`);
        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error('商品取得エラー:', error);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">商品一覧</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id} className="mb-2">
            <Link href={`/product/${product.id}`} className="text-blue-600 underline">
              {product.name} - ¥{product.price}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
