"use client";

import { Github, ExternalLink, } from "lucide-react";
import { openSource } from "@/data/open-source";

export default function OpenSource() {
  return (
    <section id="open-source" className="mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-8">Open Source</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {openSource.map((project) => (
          <div
            key={project.title}
            className="p-6 bg-card rounded-lg border border-border flex flex-col h-full hover:border-accent transition-all duration-150 ease-linear"
          >
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
              <p className="text-muted-foreground mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              {project.sourcelink && (
                <a
                  href={project.sourcelink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-accent hover:border-accent hover:shadow-sm shadow-blue-500/50 hover:scale-102 transition-all duration-75 ease-linear"
                >
                  <Github size={16} />
                  GitHub
                </a>
              )}
              {project.livelink && (
                <a
                  href={project.livelink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-accent hover:border-accent hover:shadow-sm shadow-blue-500/50 hover:scale-102 transition-all duration-75 ease-linear"
                >
                  <ExternalLink size={16} />
                  Live
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

