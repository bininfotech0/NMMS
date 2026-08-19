import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name?: string) {
  return (name ?? "—").slice(0, 2).toUpperCase();
}

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
