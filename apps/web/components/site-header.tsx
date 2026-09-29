import { appConfig } from "@workspace-template/data";
import Link from "next/link";
import { buttonClass } from "@/lib/button-class";
import { getSession } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function SiteHeader() {
  const session = await getSession();
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link className="mr-auto font-heading text-2xl" href="/">
          {appConfig.name}
        </Link>
        <nav className="flex items-center gap-1">
          {session ? (
            <>
              <Link className={buttonClass({ variant: "ghost" })} href="/me">
                My kitchen
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link className={buttonClass({ variant: "ghost" })} href="/sign-in">
              Sign in
            </Link>
          )}
          <Link className={buttonClass()} href="/recipes/new">
            Add a recipe
          </Link>
        </nav>
      </div>
    </header>
  );
}
