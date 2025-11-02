"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
  softwareEngineeringProjects,
  technicalArtProjects,
} from "@/data/projects";

export default function Projects() {
  const [category, setCategory] = useState<
    "technical-art" | "software-engineering"
  >("technical-art");

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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="grid md:grid-cols-2 gap-6"
          >
            {projects.map((project) => (
              <a
                key={project.title}
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-6 bg-card rounded-lg border border-border hover:border-accent hover:shadow-lg shadow-blue-500/50 transition-all group duration-75 ease-linear hover:translate-x-1 hover:-translate-y-1"
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
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}
