// Get API URL: use env var if set, otherwise use /api (proxied) in browser or localhost in dev/SSR
export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // In development, always use localhost directly to avoid NextAuth route conflicts
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }
  
  // In browser (production): use /api which will be proxied
  if (typeof window !== "undefined") {
    return "/api";
  }
  
  // In SSR (production): use full URL
  return "https://api.opencause.world";
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const url = `${getApiUrl()}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (204 No Content, DELETE requests, etc.)
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return undefined as T;
    }

    // Check if response has content-type header
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (e) {
        // If JSON parsing fails but status is OK, return undefined
        if (response.status >= 200 && response.status < 300) {
          return undefined as T;
        }
        throw e;
      }
    }

    // Not JSON or no content-type, return undefined
    return undefined as T;
  } catch (error: any) {
    // Handle network errors
    if (error.message === "Failed to fetch" || error.name === "TypeError") {
      throw new Error(
        "Unable to connect to the server. Please make sure the API is running on http://localhost:4000"
      );
    }
    throw error;
  }
}

