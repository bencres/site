"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function BackButton() {
  const router = useRouter();

  return (
    <motion.button
      whileHover={{ x: -4 }}
      onClick={() => router.push("/")}
      className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors cursor-pointer"
    >
      <ArrowLeft
        size={16}
        className="text-muted-foreground group-hover:text-accent transition-colors"
      />
      <span>Back</span>
    </motion.button>
  );
}
