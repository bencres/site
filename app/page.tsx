import Header from "@/components/header";
import Footer from "@/components/footer";
import AnimatedMain from "@/components/animated-main";
import { getAllPosts } from "@/lib/utils-server";

export default function Page() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <AnimatedMain posts={posts} />
      <Footer />
    </div>
  );
}
