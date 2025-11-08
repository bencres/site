"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Github, Linkedin, Mail, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { posts } from "@/data/command-menu-posts";

interface CommandItemData {
  label: string;
  icon?: LucideIcon;
  action: () => void;
}

interface CommandGroupData {
  title: string;
  items: CommandItemData[];
}

export default function CommandMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const blogCommands: CommandItemData[] = posts.map((post) => ({
    label: post.title,
    action: () => {
      router.push(`/blog/${post.slug}`);
      setOpen(false);
    },
  }));

  const commands: CommandGroupData[] = [
    {
      title: "Contact",
      items: [
        {
          label: "Email",
          icon: Mail,
          action: () => {
            window.location.href = "mailto:ben@utdallas.edu";
            setOpen(false);
          },
        },
        {
          label: "Download Resume",
          icon: Download,
          action: () => {
            window.open("/cressman-benjamin-resume.pdf", "_blank");
            setOpen(false);
          },
        },
        {
          label: "GitHub",
          icon: Github,
          action: () => {
            window.open("https://github.com/bencres", "_blank");
            setOpen(false);
          },
        },
        {
          label: "LinkedIn",
          icon: Linkedin,
          action: () => {
            window.open("https://linkedin.com/in/bencres", "_blank");
            setOpen(false);
          },
        },
      ],
    },
    {
      title: "Navigate",
      items: [
        {
          label: "Home",
          action: () => {
            setOpen(false);
            router.push("/");
          },
        },
        {
          label: "Work",
          action: () => {
            setOpen(false);

            if (pathname === "/") {
              document
                .getElementById("projects")
                ?.scrollIntoView({ behavior: "smooth" });
            } else {
              router.push("/#projects");
            }
          },
        },
        // {
        //   label: "Experience",
        //   action: () => {
        //     setOpen(false);
        //     if (pathname === "/") {
        //       document
        //         .getElementById("experience")
        //         ?.scrollIntoView({ behavior: "smooth" });
        //     } else {
        //       router.push("/#experience");
        //     }
        //   },
        // },
        {
          label: "Blog",
          action: () => {
            setOpen(false);
            if (pathname === "/") {
              document
                .getElementById("blog")
                ?.scrollIntoView({ behavior: "smooth" });
            } else {
              router.push("/#blog");
            }
          },
        },
      ],
    },
    {
      title: "Featured Blog Posts",
      items: blogCommands,
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-accent bg-card transition text-sm text-foreground"
      >
        <Search size={16} />
        <span>⌘K</span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search commands..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {commands.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.label}
                    onSelect={item.action}
                    className="aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    {Icon && (
                      <Icon
                        size={16}
                        className="aria-selected:text-accent-foreground"
                      />
                    )}
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
