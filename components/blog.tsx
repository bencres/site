"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { PostMeta } from "@/lib/utils-server";
import { formatReadableDate } from "@/lib/utils-client";

const MotionLink = motion.create(Link);

export default function Blog({ posts }: { posts: PostMeta[] }) {
  return (
    <motion.section id="blog" className="mb-20 scroll-mt-24" layout>
      <h2 className="text-3xl font-bold mb-10">Blog Posts</h2>
      <div className="space-y-4">
        {posts.map((post) => (
          <MotionLink
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="p-4 bg-card rounded-lg border border-border hover:border-accent transition group flex items-center justify-between block hover:shadow-md shadow-blue-500/50"
            whileHover={{ x: 8 }}
            transition={{ duration: 0.1, ease: "linear" }}
          >
            <div>
              <h3 className="font-semibold group-hover:text-accent transition mb-1">
                {post.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                {post.excerpt}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatReadableDate(post.date)}
              </p>
            </div>
            <ArrowRight
              size={18}
              className="text-muted-foreground group-hover:text-accent transition flex-shrink-0 ml-4"
            />
          </MotionLink>
        ))}
      </div>
    </motion.section>
  );
}
