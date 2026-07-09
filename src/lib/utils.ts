import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(name: string): string {
  // Use crypto.randomBytes or a simpler pseudo-random hex string for better performance and uniqueness
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomStr}`;
}

