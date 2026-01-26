/**
 * Utility function to wrap navigation with view transitions
 * Falls back gracefully if View Transitions API is not supported
 */
export function startViewTransition(callback: () => void | Promise<void>) {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as any).startViewTransition(() => {
      const result = callback();
      // If callback returns a promise, wait for it
      if (result instanceof Promise) {
        return result;
      }
    });
  } else {
    callback();
  }
}
