import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const normalizeForMatch = (value: string = "") =>
    value
        .toLowerCase()
        .replace(/\u0142/g, "l")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

export const isFieldEvent = (name: string = "") => {
    const lowerName = normalizeForMatch(name || "");
    const technicalKeywords = [
        "kul",
        "kula",
        "dysk",
        "mlot",
        "oszczep",
        "dal",
        "trojskok",
        "wieloskok",
        "wzwyz",
        "tycz",
        "pilecz",
        "lj",
        "tj",
        "sp",
        "dt",
        "jt",
        "ht",
        "hj",
        "pv",
    ];
    return technicalKeywords.some((keyword) => lowerName.includes(keyword));
};

export const isMultiEvent = (name: string = "") => {
    const lowerName = normalizeForMatch(name || "");
    const keywords = ["piecioboj", "siedmioboj", "dziesiecioboj", "pentathlon", "heptathlon", "decathlon", "boj"];
    return keywords.some((keyword) => lowerName.includes(keyword));
};

export const isRelayEvent = (code: string = "") => {
    return code?.toLowerCase().includes("4x");
};

export const isVerticalEvent = (name: string = "", code: string = "") => {
    const keywords = ["wzwyz", "tycz", "hj", "pv", "high jump", "pole vault"];
    const lowerName = normalizeForMatch(name || "");
    const lowerCode = normalizeForMatch(code || "");
    return keywords.some((keyword) => lowerName.includes(keyword) || lowerCode.includes(keyword));
};

export const eventRequiresWind = (name: string = "", code: string = "") => {
    const n = normalizeForMatch(name || "");
    const c = normalizeForMatch(code || "");

    // Track events needing wind: 100m, 200m, 80H, 100H, 110H
    const trackWind = ["100", "200", "110h", "100h", "80h"];
    const isMatch = trackWind.some((tw) => {
        if (c === tw) return true;
        if (c.startsWith(tw)) {
            const nextChar = c[tw.length];
            // If next char is a digit, it might be 1000 or 800
            return !nextChar || Number.isNaN(parseInt(nextChar, 10));
        }
        return false;
    });

    if (isMatch) return true;

    // Field events needing wind: LJ (dal), TJ (trojskok), wieloskok
    const fieldWind = ["lj", "tj", "dal", "trojskok", "wieloskok"];
    if (fieldWind.some((fw) => c.includes(fw) || n.includes(fw))) return true;

    // Additional check for names if codes are not standard
    if (n.includes("100 m") || n.includes("200 m") || n.includes("110 m pp") || n.includes("100 m pp") || n.includes("80 m pp")) return true;
    if (n.includes("100m") || n.includes("200m") || n.includes("110m p") || n.includes("100m p") || n.includes("80m p")) return true;

    return false;
};
