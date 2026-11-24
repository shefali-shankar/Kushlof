import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines Tailwind class names, letting later classes override earlier conflicting ones.
export function cn(...classNames: ClassValue[]): string {
  return twMerge(clsx(classNames));
}
