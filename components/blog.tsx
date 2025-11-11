"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { PostMeta } from "@/lib/utils-server";
import { formatReadableDate } from "@/lib/utils-client";

export default function Blog({ posts }: { posts: PostMeta[] }) {
  return (
    <section id="blog" className="mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-10">Blog</h2>
      <div className="space-y-4">
        {[...posts]
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
          .map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="
                p-4 bg-card rounded-lg border border-border
                hover:border-accent hover:bg-card/50
                transition-all duration-75 ease-linear
                group flex items-center justify-between block
                hover:translate-x-2 hover:shadow-md shadow-blue-500/50
              "
            >
              <div>
                <h3 className="font-semibold group-hover:text-accent transition-colors mb-1">
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
                className="text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 ml-4"
              />
            </Link>
          ))}
      </div>
    </section>
  );
}
