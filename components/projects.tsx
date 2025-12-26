"use client";

import { ExternalLink } from "lucide-react";

import { technicalArtProjects } from "@/data/projects";

export default function Projects() {
  return (
    <section id="projects" className="mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-8">Work</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {technicalArtProjects.map((project) => (
          <a
            key={project.title}
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-card rounded-lg border border-border hover:border-accent hover:shadow-md shadow-blue-500/50 transition-all group duration-75 ease-linear hover:translate-x-1 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xl font-semibold group-hover:text-accent transition">
                {project.title}
              </h3>
              <ExternalLink
                size={18}
                className="text-muted-foreground group-hover:text-accent transition"
              />
            </div>
            <p className="text-muted-foreground mb-4">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <span
                  key={tag}
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    tag === "WIP"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-accent/10 text-accent"
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
