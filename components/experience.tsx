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
            {idx !== experiences.length - 1 && (
              <div className="absolute left-1.5 top-6 w-0.5 h-20 bg-border" />
            )}
            <div>
              <h3 className="text-xl font-semibold">{exp.title}</h3>
              <p className="text-accent text-sm font-medium">{exp.company}</p>
              <p className="text-muted-foreground text-sm mb-2">
                {exp.duration}
              </p>
              <p className="text-muted-foreground">{exp.description}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
