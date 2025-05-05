type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
};

async function getProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}`
    );
    if (!res.ok) return null;
    const product: Product = await res.json();
    return product;
  } catch (error) {
    console.error("商品取得エラー:", error);
    return null;
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetail({ params }: Props) {
  const { id } = await params; // params を await する
  const product = await getProduct(id);

  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 p-6">
        <p className="text-gray-600 text-lg">商品が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-64 object-cover rounded-md mb-6"
        />
        <h1 className="text-3xl font-bold mb-4 text-gray-800">
          {product.name}
        </h1>
        <p className="text-xl text-green-600 mb-2">¥{product.price}</p>
        <p className="text-gray-700 mb-4">在庫: {product.stock}個</p>
        <p className="text-gray-600 mb-6">{product.description}</p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded w-full">
          カートに追加
        </button>
      </div>
    </div>
  );
}
