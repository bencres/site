"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/")}
      className="
        p-2 border border-border rounded-lg
        flex items-center gap-2 text-sm text-muted-foreground
        hover:text-accent hover:border-accent
        transition-transform transition-colors duration-75 ease-linear
        cursor-pointer hover:-translate-x-1 hover:shadow-md shadow-blue-500/50
        group
      "
    >
      <ArrowLeft
        size={16}
        className="text-muted-foreground group-hover:text-accent transition-colors"
      />
      <span>Back</span>
    </button>
  );
}
