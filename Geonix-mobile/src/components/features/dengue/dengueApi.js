import AsyncStorage from "@react-native-async-storage/async-storage";
import { DENGUE_API_URL } from "../../../config/api";

const REQUEST_TIMEOUT_MS = 12000;
const SETTINGS_KEY = "@flood_app_settings";

function normalizeBaseUrl(value) {
  if (typeof value !== "string") {
    return "";
  }
  let normalized = value.trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized
    .replace(/^httpx:\/\//i, "http://")
    .replace(/^httpsx:\/\//i, "https://");

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

async function resolveApiBaseUrl() {
  return normalizeBaseUrl(DENGUE_API_URL);
}

async function request(path) {
  const baseUrl = await resolveApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Invalid backend URL configuration.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${path}`);
    }
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Request timed out: ${path}. Check backend URL (${baseUrl}).`,
      );
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Request failed: ${path}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function withRefreshQuery(path, forceRefresh) {
  if (!forceRefresh) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}refresh=true`;
}

export function fetchDengueMap(latitude, longitude, forceRefresh = false) {
  let path = "/dengue/map";
  if (typeof latitude === "number" && typeof longitude === "number") {
    const lat = encodeURIComponent(String(latitude));
    const lng = encodeURIComponent(String(longitude));
    path = `${path}?lat=${lat}&lng=${lng}`;
  }
  return request(withRefreshQuery(path, forceRefresh));
}

export function fetchDengueSummary(latitude, longitude, forceRefresh = false) {
  const lat = encodeURIComponent(String(latitude));
  const lng = encodeURIComponent(String(longitude));
  const path = `/dengue/summary?lat=${lat}&lng=${lng}`;
  return request(withRefreshQuery(path, forceRefresh));
}

export function fetchDenguePrevention() {
  return request("/dengue/prevention");
}
