// frontend/app/product/[id]/page.tsx

type Props = {
  params: { id: string };
};

export default function ProductDetail({ params }: Props) {
  return (
    <div>
      <h1>商品詳細 - ID: {params.id}</h1>
      <p>ここに商品の説明や画像が入ります。</p>
    </div>
  );
}

