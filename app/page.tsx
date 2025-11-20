import Head from "next/head";
import AnimatedMain from "@/components/animated-main";
import { getAllPosts } from "@/lib/utils-server";

export default function Page() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Head>
        <meta property="og:title" content="Ben’s Cressman's Work and Blog" />
        <meta
          property="og:description"
          content="Technical artist specializing in Python, Houdini, Unreal, and Nuke."
        />
        <meta
          property="og:image"
          content="https://bencres.dev/embed_icon.jpg"
        />
        <meta property="og:url" content="https://bencres.dev" />
      </Head>
      <AnimatedMain posts={posts} />
    </div>
  );
}
