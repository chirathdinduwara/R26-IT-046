import { NativeModules, Platform } from "react-native";

const DEFAULT_PORT = 8000;
const PROJECT_DEFAULT_HOST = "192.168.8.100";

function extractHost(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const trimmed = value.trim();
  const urlMatch = trimmed.match(/^[a-z]+:\/\/([^/:?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const hostUriMatch = trimmed.match(/^([^/:?#]+)(?::\d+)?(?:\/|$)/);
  return hostUriMatch?.[1] || "";
}

function getMetroHost() {
  const platformServerHost =
    Platform?.constants?.ServerHost ||
    NativeModules?.PlatformConstants?.ServerHost ||
    "";
  const scriptURL = NativeModules?.SourceCode?.scriptURL || "";

  const candidates = [platformServerHost, scriptURL];
  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host) {
      return host;
    }
  }
  return "";
}

const metroHost = getMetroHost();
const fallbackHost = metroHost || PROJECT_DEFAULT_HOST;

const defaultUrl = `http://${fallbackHost}:${DEFAULT_PORT}`;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || defaultUrl;
