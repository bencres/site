import AnimatedMain from "@/components/animated-main";
import { getAllPosts } from "@/lib/utils-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ben Cressman's Work and Blog",
  description:
    "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
  openGraph: {
    title: "Ben Cressman's Work and Blog",
    description:
      "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
    url: "https://bencres.dev",
    siteName: "Ben Cressman's Portfolio",
    images: [
      {
        url: "https://bencres.dev/embed_icon.jpg",
        width: 2048,
        height: 2048,
        alt: "Ben Cressman's logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ben Cressman's Work and Blog",
    description:
      "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
    images: ["https://bencres.dev/embed_icon.jpg"],
  },
};

export default function Page() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <meta property="og:title" content="Ben’s Cressman's Work and Blog" />
      <meta
        property="og:description"
        content="Technical artist specializing in Python, Houdini, Unreal, and Nuke."
      />
      <meta property="og:image" content="https://bencres.dev/embed_icon.jpg" />
      <meta property="og:url" content="https://bencres.dev" />
      <AnimatedMain posts={posts} />
    </div>
  );
}
