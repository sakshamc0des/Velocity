import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  withCredentials: true, // sends the HttpOnly refresh cookie automatically
});

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Transparent silent-refresh on 401: retry once after refreshing the
// access token via the HttpOnly cookie, then bubble up if that also fails.
let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.includes("/auth/refresh") || original?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      if (!refreshing) {
        refreshing = api
          .post("/auth/refresh")
          .then((r) => {
            setAccessToken(r.data.accessToken);
            return r.data.accessToken as string;
          })
          .catch(() => {
            setAccessToken(null);
            return null;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);
