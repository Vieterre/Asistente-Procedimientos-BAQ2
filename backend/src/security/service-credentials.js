import { readFileSync } from "node:fs";
import { join } from "node:path";

export function readServiceCredential(name) {
  const directory = process.env.CREDENTIALS_DIRECTORY;
  if (!directory) return undefined;
  try {
    // Secret files are normally written as one newline-terminated line.
    // Remove that terminator only; trailing spaces can be part of a password.
    return readFileSync(join(directory, name), "utf8").replace(/\r?\n$/, "");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}
