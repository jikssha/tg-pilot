import packageJson from "../package.json";

export const BUILD_APP_VERSION = packageJson.version;

export function formatAppVersion(version?: string | null): string {
  const fallback = BUILD_APP_VERSION;
  const resolved = (version || fallback).trim();
  if (!resolved) {
    return `v${fallback}`;
  }
  return resolved.startsWith("v") ? resolved : `v${resolved}`;
}

