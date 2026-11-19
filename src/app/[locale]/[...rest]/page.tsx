import { notFound } from "next/navigation";

/**
 * Catch-all inside `[locale]` so any unmatched URL renders the branded
 * postal-themed `not-found.tsx` within the full app shell instead of
 * Next.js's bare default 404 screen.
 */
export default function CatchAllNotFound() {
    notFound();
}
