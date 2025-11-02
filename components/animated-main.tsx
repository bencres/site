"use client";

import { motion } from "framer-motion";
import Hero from "@/components/hero";
import Projects from "@/components/projects";
import Experience from "@/components/experience";
import Blog from "@/components/blog";
import type { PostMeta } from "@/lib/utils-server";

interface AnimatedMainProps {
  posts: PostMeta[];
}

export default function AnimatedMain({ posts }: AnimatedMainProps) {
  return (
    <motion.main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
      <Hero />
      <Projects />
      {/*<motion.div layout>
        <Experience />
      </motion.div>*/}
      <motion.div layout>
        <Blog posts={posts} />
      </motion.div>
    </motion.main>
  );
}
