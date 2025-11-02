"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatReadableDate(raw: string) {
  // Expecting dates like "1-11-2025" (day-month-year)
  const [day, month, year] = raw.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  if (isNaN(date.getTime())) return raw; // fallback if unparsable

  const dayNumber = date.getDate();
  const ordinal =
    dayNumber % 10 === 1 && dayNumber !== 11
      ? "st"
      : dayNumber % 10 === 2 && dayNumber !== 12
        ? "nd"
        : dayNumber % 10 === 3 && dayNumber !== 13
          ? "rd"
          : "th";

  const fullMonth = date.toLocaleString("en-US", { month: "long" });

  return `${fullMonth} ${dayNumber}${ordinal}, ${year}`;
}
