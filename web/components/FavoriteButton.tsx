"use client";

import { Star } from "lucide-react";
import { useFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ id }: { id: string }) {
  const { has, toggle } = useFavorites();
  const fav = has(id);
  return (
    <button
      onClick={() => toggle(id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition",
        fav
          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "border-stone-300 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
      )}
    >
      <Star className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
      {fav ? "已收藏" : "收藏"}
    </button>
  );
}
