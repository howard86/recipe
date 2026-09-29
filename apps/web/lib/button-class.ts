import { buttonVariants } from "@workspace-template/ui/components/button";
import { cn } from "@workspace-template/ui/lib/utils";

/**
 * Button styling for links. cva alone keeps conflicting classes (the base
 * `border-transparent` beats `outline`'s `border-border`); `cn` resolves them
 * the way the Button component does.
 */
export function buttonClass(
  ...args: Parameters<typeof buttonVariants>
): string {
  return cn(buttonVariants(...args));
}
