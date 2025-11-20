"use client";

import { useEffect } from "react";

export default function MarkdownImageLoader() {
  useEffect(() => {
    const imgs = document.querySelectorAll<HTMLImageElement>(".prose img");

    imgs.forEach((img) => {
      if (img.complete) img.dataset.loaded = "true";
      else img.addEventListener("load", () => (img.dataset.loaded = "true"));
    });
  }, []);

  return null;
}
