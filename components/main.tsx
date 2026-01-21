// animated-main.tsx
"use client";

import Hero from "@/components/hero";
import Projects from "@/components/projects";
import Experience from "@/components/experience";
import OpenSource from "@/components/open-source";
import Blog from "@/components/blog";
import type { PostMeta } from "@/lib/utils-server";

interface MainProps {
  posts: PostMeta[];
}

export default function Main({ posts }: MainProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
      <div>
        <Hero />
      </div>
      <div>
        <Projects />
      </div>
      <div>
        <Experience />
      </div>
      {/* <div>
        <OpenSource />
      </div> */}
      <div>
        <Blog posts={posts} />
      </div>
    </main>
  );
}
