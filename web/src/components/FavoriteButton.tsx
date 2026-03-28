'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/apiClient';
import { toast } from '@/components/Toast';

interface FavoriteButtonProps {
  campaignType: 'kuji' | 'unlimited';
  campaignId: string;
  initialFavorited: boolean;
  className?: string;
}

export function FavoriteButton({
  campaignType,
  campaignId,
  initialFavorited,
  className = '',
}: FavoriteButtonProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (pending) return;

    const nextFavorited = !favorited;
    setFavorited(nextFavorited);
    setPending(true);

    try {
      const path = `/api/v1/players/me/favorites/${campaignType}/${campaignId}`;
      if (nextFavorited) {
        await apiClient.put<void>(path);
      } else {
        await apiClient.delete<void>(path);
      }
    } catch {
      // Revert optimistic update
      setFavorited(!nextFavorited);
      toast.error('收藏操作失敗，請稍後再試');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="favorite-button"
      aria-label={favorited ? '取消收藏' : '加入收藏'}
      aria-pressed={favorited}
      onClick={handleClick}
      disabled={pending}
      className={`flex items-center justify-center transition-transform active:scale-90 disabled:opacity-60 ${className}`}
    >
      <span
        className={`select-none leading-none ${favorited ? 'text-red-500' : 'text-white/70 hover:text-red-400'}`}
        style={{ textShadow: favorited ? '0 0 6px rgba(239,68,68,0.5)' : undefined }}
      >
        {favorited ? '♥' : '♡'}
      </span>
    </button>
  );
}
