import Link from 'next/link';

export default function Home (){
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">商品一覧</h1>
            <ul>
                {[1,2,3].map((id)=>(
                    <li key={id} className="mb-2">
                        <Link href={`/product/${id}`} className="text-blue-600 underline">
                        商品{id}の詳細を見る
                        </Link>
                    </li>

                ))}
            </ul>
        </div>
    );
}