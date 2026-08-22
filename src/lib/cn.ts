import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional class names with Tailwind conflict resolution.
 *
 * `clsx` handles the conditionals, `twMerge` makes the LAST conflicting utility
 * win, so a component can accept a `className` override without the caller
 * having to guess whether `px-4` or `px-6` ends up applied.
 *
 * Both packages were already in `dependencies` but never imported — they were
 * being shipped to users for nothing.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
