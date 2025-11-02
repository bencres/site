"use client";

import Link from "next/link";
import { Github, Linkedin, Download, Mail } from "lucide-react";
import CommandMenu from "@/components/command-menu";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <nav className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-bold text-accent hover:text-accent/80 transition-colors"
        >
          bencres.dev
        </Link>

        <div className="flex items-center gap-6">
          <a
            href="/#projects"
            className="hidden md:block text-sm hover:text-accent transition rounded-md"
          >
            Projects
          </a>
          <a
            href="/#experience"
            className="hidden md:block text-sm hover:text-accent transition rounded-md"
          >
            Experience
          </a>
          <a
            href="/#blog"
            className="hidden md:block text-sm hover:text-accent transition rounded-md"
          >
            Blog
          </a>

          <CommandMenu />

          <div className="flex gap-3">
            <a
              href="mailto:ben@utdallas.edu"
              className="text-muted-foreground hover:text-accent transition rounded-sm"
              title="Send Email"
            >
              <Mail size={18} />
            </a>
            <a
              href="/cressman-benjamin-resume.pdf"
              className="text-muted-foreground hover:text-accent transition rounded-sm"
              title="Download Resume"
            >
              <Download size={18} />
            </a>
            <a
              href="https://github.com/bencres"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition rounded-sm"
              title="Open GitHub"
            >
              <Github size={18} />
            </a>
            <a
              href="https://linkedin.com/in/bencres"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition rounded-sm"
              title="Open LinkedIn"
            >
              <Linkedin size={18} />
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
