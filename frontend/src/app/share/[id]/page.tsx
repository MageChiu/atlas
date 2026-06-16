'use client';

import { useParams } from 'next/navigation';
import { useGeneratedAssets } from '@/hooks/useContentQueries';

/** F6.3 - 分享页 / 结果海报页 */
export default function SharePage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading } = useGeneratedAssets();
  const asset = data?.assets.find((a) => a.id === params.id);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-10">
      {isLoading ? (
        <div className="text-atlas-muted">加载中…</div>
      ) : !asset ? (
        <div className="text-atlas-muted">分享内容不存在或已过期。</div>
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border border-atlas-border bg-atlas-surface shadow-2xl">
          {/* 海报区 */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.assetUrl} alt="分享" className="w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <div className="text-lg font-bold">Atlas · 路过</div>
              <div className="text-xs text-white/70">我的旅行写真</div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-3 text-sm text-atlas-muted">
            <span>{new Date(asset.createdAt).toLocaleString()}</span>
            <button
              className="rounded-lg bg-atlas-primary px-4 py-1.5 font-medium text-black"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
              }}
            >
              复制分享链接
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
