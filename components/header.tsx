"use client";

import ViewTransitionLink from "@/components/view-transition-link";
import { Github, Linkedin, Download, Mail } from "lucide-react";
import CommandMenu from "@/components/command-menu";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border site-header"
    >
      <nav className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <ViewTransitionLink
          href="/"
          className="text-xl font-bold text-accent hover:text-accent/80 transition-colors rounded-md p-0.5"
        >
          bencres.dev
        </ViewTransitionLink>

        <div className="flex items-center gap-6">
          <a
            href="/#projects"
            className="hidden md:block text-sm hover:text-accent transition rounded-md p-0.5"
          >
            Work
          </a>
          <a
            href="/#experience"
            className="hidden md:block text-sm hover:text-accent transition rounded-md p-0.5"
          >
            Experience
          </a>

          {/* <a href="/#open-source" className="hidden md:block text-sm hover:text-accent transition rounded-md p-0.5">
            Open Source
          </a> */}

          <a
            href="/#blog"
            className="hidden md:block text-sm hover:text-accent transition rounded-md p-0.5"
          >
            Blog
          </a>

          <CommandMenu />

          <div className="flex gap-3">
            <a
              href="mailto:hello@bencres.dev"
              className="text-muted-foreground hover:text-accent transition rounded-sm p-0.5"
              title="Send Email"
            >
              <Mail size={18} />
            </a>
            <a
              href="/ben-cressman-software-engineer.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition rounded-sm p-0.5"
              title="Download Resume"
            >
              <Download size={18} />
            </a>
            <a
              href="https://github.com/bencres"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition rounded-sm p-0.5"
              title="Open GitHub"
            >
              <Github size={18} />
            </a>
            <a
              href="https://linkedin.com/in/bencres"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition rounded-sm p-0.5"
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
