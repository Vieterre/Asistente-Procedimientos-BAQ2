import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readServiceCredential(name) {
  const directory = process.env.CREDENTIALS_DIRECTORY;
  if (!directory) return undefined;
  try {
    return readFileSync(join(directory, name), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}
