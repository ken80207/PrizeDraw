"use client";

import { useEffect, useRef, useState } from "react";

export interface BannerData {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

interface BannerCarouselProps {
  banners: BannerData[];
  fallback?: React.ReactNode;
}

export function BannerCarousel({ banners, fallback }: BannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isPausedRef = useRef(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  if (banners.length === 0) {
    return <>{fallback ?? null}</>;
  }

  function handleDotClick(index: number) {
    setCurrentIndex(index);
    isPausedRef.current = true;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      isPausedRef.current = false;
    }, 10_000);
  }

  return (
    <div className="relative w-full h-[400px] lg:h-[500px] rounded-lg lg:rounded-xl overflow-hidden">
      {banners.map((banner, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={banner.id}
          src={banner.imageUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            index === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Indicator dots */}
      {banners.length > 1 && (
        <div className="absolute right-8 bottom-8 hidden lg:flex flex-col gap-3 items-center">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to banner ${index + 1}`}
              className={`w-1 rounded-full transition-all duration-300 cursor-pointer ${
                index === currentIndex
                  ? "h-12 bg-primary"
                  : "h-12 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
