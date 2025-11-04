"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  softwareEngineeringProjects,
  technicalArtProjects,
} from "@/data/projects";

export default function Projects() {
  const [category, setCategory] = useState<
    "technical-art" | "software-engineering"
  >("technical-art");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  const projects =
    category === "technical-art"
      ? technicalArtProjects
      : softwareEngineeringProjects;

  return (
    <section id="projects" className="mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-8">Work</h2>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setCategory("technical-art")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            category === "technical-art"
              ? "bg-accent text-accent-foreground"
              : "border border-border hover:border-accent text-foreground bg-card"
          }`}
        >
          Technical Art
        </button>
        <button
          onClick={() => setCategory("software-engineering")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            category === "software-engineering"
              ? "bg-accent text-accent-foreground"
              : "border border-border hover:border-accent text-foreground bg-card"
          }`}
        >
          Software Engineering
        </button>
      </div>

      <motion.div layout>
        <AnimatePresence mode="wait">
          <motion.div
            key={category}
            initial={{ opacity: 0, height: 400 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 400 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid md:grid-cols-2 gap-6"
          >
            {projects.map((project) => (
              <ProjectCard
                key={project.title}
                project={project}
                onPreview={() => setSelectedProject(project)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {selectedProject && (
          <PreviewModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function ProjectCard({
  project,
  onPreview,
}: {
  project: any;
  onPreview: () => void;
}) {
  return (
    <div className="p-6 bg-card rounded-lg border border-border hover:border-accent hover:shadow-md transition-all group duration-75 ease-linear hover:translate-x-0.5 hover:-translate-y-0.5 shadow-blue-500/50">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold group-hover:text-accent transition">
          {project.title}
        </h3>
      </div>
      <p className="text-muted-foreground mb-4">{project.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {project.tags.map((tag: string) => (
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

      <div className="flex gap-2">
        <button
          onClick={() => window.open(project.link, "_blank")}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:border-accent transition"
        >
          <ExternalLink size={16} /> Open
        </button>
        <button
          onClick={onPreview}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-md hover:border-accent transition"
        >
          <Eye size={16} /> Preview
        </button>
      </div>
    </div>
  );
}

function PreviewModal({
  project,
  onClose,
}: {
  project: any;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card text-foreground rounded-lg p-6 max-w-2xl w-full relative"
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-3 right-3 gap-2 px-2 py-1 border border-border rounded-md hover:border-accent transition"
        >
          ✕
        </button>
        <h3 className="text-2xl font-semibold mb-2">{project.title}</h3>
        <p className="text-muted-foreground mb-4">{project.description}</p>

        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag: string) => (
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
      </motion.div>
    </motion.div>
  );
}
