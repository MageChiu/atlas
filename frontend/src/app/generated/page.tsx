'use client';

import Link from 'next/link';
import { useGeneratedAssets } from '@/hooks/useContentQueries';

/** F6.2 - 生成记录页 */
export default function GeneratedPage() {
  const { data, isLoading } = useGeneratedAssets();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold">生成记录</h1>
      {isLoading ? (
        <div className="text-atlas-muted">加载中…</div>
      ) : !data || data.assets.length === 0 ? (
        <div className="text-atlas-muted">还没有生成记录，去景点拍一张写真吧。</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.assets.map((asset) => (
            <Link
              key={asset.id}
              href={`/share/${asset.id}`}
              className="group overflow-hidden rounded-xl border border-atlas-border bg-atlas-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.assetUrl}
                alt={asset.assetType}
                className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="px-3 py-2 text-xs text-atlas-muted">
                {new Date(asset.createdAt).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
