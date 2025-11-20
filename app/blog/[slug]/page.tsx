export const runtime = "nodejs";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/header";
import BackButton from "@/components/ui/back-button";
import { getAllPosts, getRenderedPost } from "@/lib/utils-server";
import Footer from "@/components/footer";
import MarkdownImageLoader from "@/components/markdown-image-loader";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getRenderedPost(slug);

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  const url = `https://bencres.dev/blog/${slug}`;

  return {
    title: post.meta.title,
    description: post.meta.excerpt,
    openGraph: {
      title: post.meta.title,
      description: post.meta.excerpt,
      url,
      siteName: "Ben Cressman's Work and Blog",
      images: [
        {
          url: "https://bencres.dev/embed-default-image.jpg",
          width: 1200,
          height: 630,
          alt: post.meta.title,
        },
      ],
      locale: "en_US",
      type: "article",
      publishedTime: post.meta.date,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.excerpt,
      images: ["https://bencres.dev/embed-default-image.jpg"],
    },
  };
}

function formatReadableDate(raw: string) {
  const [year, month, day] = raw.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) return raw; // fallback if unparsable

  const dayNumber = date.getDate();
  const ordinal =
    dayNumber % 10 === 1 && dayNumber !== 11
      ? "st"
      : dayNumber % 10 === 2 && dayNumber !== 12
        ? "nd"
        : dayNumber % 10 === 3 && dayNumber !== 13
          ? "rd"
          : "th";

  const fullMonth = date.toLocaleString("en-US", { month: "long" });

  return `${fullMonth} ${dayNumber}${ordinal}, ${year}`;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getRenderedPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-4xl mx-auto px-6 py-12">
        <article className="prose prose-invert max-w-none space-y-6">
          <header className="mb-10">
            <h1 className="text-4xl font-bold mb-2">{post.meta.title}</h1>
            <p className="text-muted-foreground text-sm">
              {formatReadableDate(post.meta.date)}
            </p>
          </header>

          <div
            className="
              prose-invert
              prose-headings:font-semibold
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-code:text-accent
              prose-pre:bg-muted/30
              prose-pre:p-4
              prose-pre:rounded-lg
              prose-pre:overflow-x-auto
              prose-li:marker:text-accent
              prose-ol:list-decimal
              prose-ul:list-disc
              prose-hr:border-border
              transition-colors duration-300
            "
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          <MarkdownImageLoader />
        </article>
        <div className="mt-12">
          <BackButton />
        </div>
      </main>
    </div>
  );
}
