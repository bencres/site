"use client";

import { ExternalLink, Github, Gamepad2, Video } from "lucide-react";

import { technicalArtProjects } from "@/data/projects";

const SteamIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill="currentColor"
    className="bi bi-steam"
    viewBox="0 0 16 16"
  >
    <path d="M.329 10.333A8.01 8.01 0 0 0 7.99 16C12.414 16 16 12.418 16 8s-3.586-8-8.009-8A8.006 8.006 0 0 0 0 7.468l.003.006 4.304 1.769A2.2 2.2 0 0 1 5.62 8.88l1.96-2.844-.001-.04a3.046 3.046 0 0 1 3.042-3.043 3.046 3.046 0 0 1 3.042 3.043 3.047 3.047 0 0 1-3.111 3.044l-2.804 2a2.223 2.223 0 0 1-3.075 2.11 2.22 2.22 0 0 1-1.312-1.568L.33 10.333Z"/>
    <path d="M4.868 12.683a1.715 1.715 0 0 0 1.318-3.165 1.7 1.7 0 0 0-1.263-.02l1.023.424a1.261 1.261 0 1 1-.97 2.33l-.99-.41a1.7 1.7 0 0 0 .882.84Zm3.726-6.687a2.03 2.03 0 0 0 2.027 2.029 2.03 2.03 0 0 0 2.027-2.029 2.03 2.03 0 0 0-2.027-2.027 2.03 2.03 0 0 0-2.027 2.027m2.03-1.527a1.524 1.524 0 1 1-.002 3.048 1.524 1.524 0 0 1 .002-3.048"/>
  </svg>
);

const iconMap = {
  github: { icon: Github, label: "GitHub" },
  steam: { icon: SteamIcon, label: "Steam" },
  video: { icon: Video, label: "Video" },
  game: { icon: Gamepad2, label: "Game" },
};

export default function Projects() {
  return (
    <section id="projects" className="mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-8">Work</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {technicalArtProjects.map((project) => (
          <div
            key={project.title}
            className="p-6 bg-card rounded-lg border border-border flex flex-col h-full"
          >
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
              <p className="text-muted-foreground mb-4">
                {project.description}
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
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
            </div>

            <div className="flex gap-3">
              {project.links.map((linkItem) => {
                const iconConfig =
                  iconMap[linkItem.icon as keyof typeof iconMap] || {
                    icon: ExternalLink,
                    label: linkItem.label,
                  };
                const Icon = iconConfig.icon;

                return (
                  <a
                    key={linkItem.label}
                    href={linkItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-accent hover:border-accent hover:shadow-sm shadow-blue-500/50 hover:scale-102 transition-all duration-75 ease-linear"
                  >
                    <Icon size={16} />
                    {linkItem.label}
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}