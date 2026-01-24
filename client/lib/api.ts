import { refreshToken } from "@/services/auth.service";
import type { AuthErrorCode, ApiErrorResponse } from "@/types";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Extended axios request config with retry flag
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Helper to extract error code from axios error
 */
const getErrorCode = (error: AxiosError<ApiErrorResponse>): AuthErrorCode | undefined => {
  return error.response?.data?.code;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000",
  withCredentials: true, // important for cookies
});

let isRefreshing = false;
let refreshSubscribers: Array<() => void> = [];
let queryClient: QueryClient | null = null;

// Set query client instance (called from app initialization)
export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

const subscribeTokenRefresh = (cb: () => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = () => {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
};

// Response interceptor for automatic token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const response = error.response;
    const config = error.config as ExtendedAxiosRequestConfig | undefined;
    const requestUrl: string | undefined = config?.url;
    const isAuthRefreshEndpoint = requestUrl?.includes(
      `${api.defaults.baseURL}/auth/refresh-token`
    );
    const errorCode = getErrorCode(error);

    // Check if this is an authentication error that should trigger token refresh
    const shouldRefreshToken =
      response?.status === 401 &&
      (errorCode === "ACCESS_TOKEN_EXPIRED" ||
        errorCode === "ACCESS_TOKEN_INVALID" ||
        errorCode === "ACCESS_TOKEN_MISSING");

    if (shouldRefreshToken) {
      // If the refresh call itself failed with 401, redirect immediately
      if (isAuthRefreshEndpoint) {
        isRefreshing = false;
        refreshSubscribers = [];
        // Clear all cached data
        queryClient?.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      if (config?._retry) {
        // Already retried once, do not loop
        queryClient?.clear();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      if (isRefreshing && config) {
        // If already refreshing, subscribe to the refresh completion
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(() => {
            api(config).then(resolve).catch(reject);
          });
        });
      }

      if (config) {
        config._retry = true;
      }
      isRefreshing = true;

      try {
        // Try to refresh the token - server will set new cookies
        await refreshToken();
        isRefreshing = false;
        onRefreshed();

        // Retry the original request with new token
        if (config) {
          return api(config);
        }
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        // Clear all cached data
        queryClient?.clear();

        // Refresh failed, redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    // For other authentication errors (missing tokens, user not found, etc.), redirect immediately
    if (
      response?.status === 401 &&
      (errorCode === "REFRESH_TOKEN_MISSING" ||
        errorCode === "REFRESH_TOKEN_EXPIRED" ||
        errorCode === "REFRESH_TOKEN_INVALID" ||
        errorCode === "REFRESH_TOKEN_REVOKED" ||
        errorCode === "USER_NOT_FOUND")
    ) {
      // Clear all cached data
      queryClient?.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } else if (response?.status !== 401) {
      // Show error toast for non-401 errors (e.g. 400, 403, 404, 500)
      const errorMessage =
        response?.data?.message || error.message || "An unexpected error occurred";
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default api;
