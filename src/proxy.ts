import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Lewati aset statis, ikon PWA, manifest, dan service worker.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|apple-icon|icon|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
