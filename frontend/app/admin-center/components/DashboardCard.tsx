// app/admin-center/components/DashboardCard.tsx
import Link from "next/link";

export default function DashboardCard({
  title,
  value,
  link,
}: {
  title: string;
  value: string;
  link: string;
}) {
  return (
    <Link
      href={link}
      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <h3 className="text-gray-500 text-sm">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <div className="mt-4 text-blue-600 text-sm">詳細を見る →</div>
    </Link>
  );
}
