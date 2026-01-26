"use client";

import { useRouter } from "next/navigation";
import { startViewTransition } from "./view-transition";

/**
 * Hook that returns a router with view transition support
 */
export function useViewTransitionRouter() {
  const router = useRouter();

  return {
    ...router,
    push: (href: string) => {
      startViewTransition(() => {
        router.push(href);
      });
    },
    replace: (href: string) => {
      startViewTransition(() => {
        router.replace(href);
      });
    },
    back: () => {
      startViewTransition(() => {
        router.back();
      });
    },
    forward: () => {
      startViewTransition(() => {
        router.forward();
      });
    },
  };
}
