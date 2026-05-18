import MarketDetail from '@/components/MarketDetail';

interface Props {
  params: { id: string };
}

export default function MarketDetailPage({ params }: Props) {
  const id = parseInt(params.id);

  if (isNaN(id)) {
    return (
      <div className="py-20 text-center text-gray-500">
        Invalid market ID: {params.id}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <MarketDetail id={id} />
    </div>
  );
}

export async function generateStaticParams() {
  // Pre-render first 10 market pages
  return Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1) }));
}
