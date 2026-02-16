const runtimeOrigin =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3100";

export const environment = {
  apiUrl: `${runtimeOrigin}/api`,
  baseUrl: runtimeOrigin,
};
