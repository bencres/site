import AnimatedMain from "@/components/animated-main";
import { getAllPosts } from "@/lib/utils-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ben Cressman's Work and Blog",
  description:
    "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
  openGraph: {
    title: "Ben Cressman",
    description:
      "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
    url: "https://bencres.dev",
    siteName: "Ben Cressman's Portfolio",
    images: [
      {
        url: "https://bencres.dev/embed-default-image.jpg",
        width: 1200,
        height: 630,
        alt: "Ben Cressman's logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ben Cressman",
    description:
      "Technical artist specializing in Python, Houdini, Unreal, and Nuke.",
    images: ["https://bencres.dev/embed_icon.jpg"],
  },
};

export default function Page() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatedMain posts={posts} />
    </div>
  );
}
