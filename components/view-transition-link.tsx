"use client";

import Link, { LinkProps } from "next/link";
import { startViewTransition } from "@/lib/view-transition";
import { useRouter } from "next/navigation";

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Link component that wraps navigation with view transitions
 */
export default function ViewTransitionLink({
  href,
  children,
  className,
  ...props
}: ViewTransitionLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Only handle client-side navigation
    if (href.toString().startsWith("/") && !href.toString().startsWith("//")) {
      e.preventDefault();
      startViewTransition(() => {
        router.push(href.toString());
      });
    }
    // External links and anchors will use default behavior
  };

  return (
    <Link href={href} className={className} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
