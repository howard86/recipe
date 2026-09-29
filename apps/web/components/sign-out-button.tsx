"use client";

import { Button } from "@workspace-template/ui/components/button";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
      variant="ghost"
    >
      Sign out
    </Button>
  );
}
