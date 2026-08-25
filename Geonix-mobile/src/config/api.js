export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

export const DENGUE_API_URL =
  process.env.EXPO_PUBLIC_DENGUE_API_URL?.trim() || API_BASE_URL;

export const FLOOD_API_URL =
  process.env.EXPO_PUBLIC_FLOOD_API_URL?.trim() || API_BASE_URL;

export const PADDY_API_URL =
  process.env.EXPO_PUBLIC_PADDY_API_URL?.trim() || API_BASE_URL;

export const SAFE_ROUTE_API_URL =
  process.env.EXPO_PUBLIC_SAFE_ROUTE_API_URL?.trim() || API_BASE_URL;
