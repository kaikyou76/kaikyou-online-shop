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
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}`);
    if (!res.ok) return null;
    const product: Product = await res.json();
    return product;
  } catch (error) {
    console.error('商品取得エラー:', error);
    return null;
  }
}

type Props = {
  params: { id: string };
};

export default async function ProductDetail({ params }: Props) {
  const product = await getProduct(params.id);

  if (!product) {
    return <p>商品が見つかりませんでした。</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{product.name}</h1>
      <img src={product.image_url} alt={product.name} className="mb-4 w-48" />
      <p className="mb-2">価格: ¥{product.price}</p>
      <p className="mb-2">在庫: {product.stock}個</p>
      <p className="text-gray-700">{product.description}</p>
    </div>
  );
}
