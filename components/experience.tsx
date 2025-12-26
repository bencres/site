"use client";

import { motion } from "framer-motion";

import { experiences } from "@/data/experiences";

export default function Experience() {
  return (
    <motion.section id="experience" className="pt-6 mb-20 scroll-mt-24">
      <h2 className="text-3xl font-bold mb-10">Experience</h2>
      <div className="space-y-6">
        {experiences.map((exp, idx) => (
          <div key={idx} className="relative pl-8">
            <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-accent border-4 border-background" />
            <div>
              <h3 className="text-xl font-semibold">{exp.title}</h3>
              <p className="text-accent text-sm font-medium">{exp.company}</p>
              <p className="text-muted-foreground text-sm mb-2">
                {exp.duration}
              </p>
              <p className="text-muted-foreground mb-4">{exp.description}</p>
              <div className="flex flex-wrap gap-2">
                {exp.tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
