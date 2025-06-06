"use client";

import {
  StarIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import ProductImage from "../../../components/ProductImage";
import { AddToCartButton } from "../../../components/AddToCartButton";
import { useAuth } from "../../../components/AuthProvider";
import { useEffect, useState } from "react";

export type ProductImage = {
  url: string;
  is_main: boolean;
  uploaded_at?: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  category_name: string | null;
  parent_category_id: number | null; // 追加
  parent_category_name: string | null; // 追加
  createdAt: string;
  images?: {
    main: ProductImage;
    additional: ProductImage[];
  };
  rating?: number;
};

async function getProduct(id: string): Promise<Product | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";
    const res = await fetch(`${baseUrl}/api/products/${id}`, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error(`API Error: ${res.status} ${res.statusText}`);
      return null;
    }

    const contentType = res.headers.get("Content-Type");
    if (!contentType?.includes("application/json")) {
      console.error("Invalid content type:", contentType);
      return null;
    }

    const response = await res.json();

    if (!response || !response.data) {
      console.error("Invalid response data:", response);
      return null;
    }

    // APIの拡張に合わせてデータを取得
    return {
      id: response.data.id,
      name: response.data.name,
      description: response.data.description,
      price: response.data.price,
      stock: response.data.stock,
      category_id: response.data.category_id,
      category_name: response.data.category_name,
      parent_category_id: response.data.parent_category_id || null, // 追加
      parent_category_name: response.data.parent_category_name || null, // 追加
      createdAt: response.data.createdAt,
      images: response.data.images,
    };
  } catch (error) {
    console.error("商品取得エラー:", error);
    return null;
  }
}

export default function ProductDetail({ params }: { params: { id: string } }) {
  const { currentUser, isLoggedIn, isLoading } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      const data = await getProduct(params.id);
      setProduct(data);
      setLoading(false);
    };
    fetchProduct();
  }, [params.id]);

  // カテゴリ階層を表示する関数の追加
  const renderCategoryHierarchy = () => {
    if (product?.parent_category_name && product?.category_name) {
      return `${product.parent_category_name} > ${product.category_name}`;
    }
    return product?.category_name || "未設定";
  };

  const getPlaceholderImage = (id: number) => {
    const imageIndex = (id % 5) + 1;
    return `/placeholder-${imageIndex}.jpg`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        読み込み中...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
              商品が見つかりません
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              お探しの商品は削除されたか、URLが間違っている可能性があります
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              商品一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mainImage =
    product.images?.main?.url || getPlaceholderImage(product.id);
  const additionalImages = product.images?.additional || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            商品一覧に戻る
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden relative">
          {currentUser?.role === "admin" && (
            <div className="absolute top-4 right-4 z-10">
              <Link
                href={`/products/edit/${params.id}`}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
                <span>編集</span>
              </Link>
            </div>
          )}

          <div className="md:flex">
            <div className="md:w-1/2 p-6">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                <ProductImage
                  id={product.id}
                  imageUrl={mainImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.stock <= 0 && (
                  <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    売り切れ
                  </div>
                )}
              </div>

              {additionalImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {additionalImages.map((img, index) => (
                    <div
                      key={index}
                      className="relative aspect-square overflow-hidden rounded-lg"
                    >
                      <ProductImage
                        id={product.id}
                        imageUrl={img.url}
                        alt={`${product.name} 追加画像 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:w-1/2 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  {/* カテゴリ表示を階層表示に変更 */}
                  {(product.category_name || product.parent_category_name) && (
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                      {renderCategoryHierarchy()}
                    </span>
                  )}
                  {product.rating && (
                    <div className="flex items-center">
                      <StarIcon className="h-5 w-5 text-yellow-400" />
                      <span className="ml-1 text-gray-600 dark:text-gray-300">
                        {product.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {product.name}
                </h1>
                <div className="flex items-center mb-4">
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ¥{product.price.toLocaleString()}
                  </span>
                  {product.stock > 0 && (
                    <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                      在庫: {product.stock}個
                    </span>
                  )}
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  {product.description}
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <AddToCartButton
                  productId={product.id}
                  disabled={product.stock <= 0 || !isLoggedIn}
                  isAuthenticated={isLoggedIn}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            商品詳細
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                仕様
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                {/* カテゴリー表示を階層表示に変更 */}
                <li>• カテゴリー: {renderCategoryHierarchy()}</li>
                <li>• 商品ID: {product.id}</li>
                <li>• 価格: ¥{product.price.toLocaleString()}</li>
                <li>
                  • 在庫状況: {product.stock > 0 ? "在庫あり" : "在庫切れ"}
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                配送情報
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li>• 配送方法: 宅配便</li>
                <li>• 配送料: 全国一律¥600</li>
                <li>• 発送予定日: 1-3営業日以内</li>
                <li>• 返品条件: 到着後7日以内</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
