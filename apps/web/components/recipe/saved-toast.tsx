"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  private:
    "Saved privately. Share it from the Share button when you are ready.",
  public: "Saved and shared publicly.",
  unlisted: "Saved. Anyone with the link can see it.",
  updated: "Changes saved.",
};

/** Shows the post-save toast once, then drops `?saved=` from the URL. */
export function SavedToast({ saved }: { saved: string | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(false);
  useEffect(() => {
    const message = saved ? MESSAGES[saved] : undefined;
    if (message && !shown.current) {
      shown.current = true;
      toast.success(message);
      router.replace(pathname as never, { scroll: false });
    }
  }, [saved, pathname, router]);
  return null;
}
