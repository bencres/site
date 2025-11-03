import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkRehype from "remark-rehype";
import rehypeExternalLinks from "rehype-external-links";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import "highlight.js/styles/github-dark.css";

export interface PostMeta {
  title: string;
  date: string;
  excerpt: string;
  slug: string;
}

export interface Post {
  meta: PostMeta;
  content: string;
}

const postsDirectory = path.join(process.cwd(), "data/posts");

/**
 * Get metadata for all markdown posts
 */
export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(postsDirectory);

  return files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const { data } = matter(
      fs.readFileSync(path.join(postsDirectory, file), "utf8"),
    );

    return {
      title: data.title,
      date: data.date,
      excerpt: data.excerpt,
      slug,
    };
  });
}

/**
 * Render a single markdown post to HTML with syntax highlighting
 */
export async function getRenderedPost(slug: string): Promise<Post> {
  const filePath = path.join(postsDirectory, `${slug}.md`);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const processed = await remark()
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeExternalLinks, {
      target: "_blank",
      rel: ["noopener", "noreferrer"],
    })
    .use(rehypeStringify)
    .process(content);

  return {
    meta: {
      title: data.title,
      date: data.date,
      excerpt: data.excerpt,
      slug,
    },
    content: processed.toString(),
  };
}
