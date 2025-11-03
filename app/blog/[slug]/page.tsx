export const runtime = "nodejs";

import { notFound } from "next/navigation";
import Header from "@/components/header";
import BackButton from "@/components/ui/back-button";
import { getAllPosts, getRenderedPost } from "@/lib/utils-server";
import Footer from "@/components/footer";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function formatReadableDate(raw: string) {
  // Expecting dates like "1-11-2025" (day-month-year)
  const [day, month, year] = raw.split("-").map(Number);

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
      <Header />

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
            "
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
        <div className="mt-12">
          <BackButton />
        </div>
      </main>
      <Footer />
    </div>
  );
}
