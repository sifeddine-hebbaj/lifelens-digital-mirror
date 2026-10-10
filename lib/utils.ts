import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function friendlyDate(value: string, locale?: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}