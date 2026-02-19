import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  register as registerUser,
  login as loginUser,
  logout as logoutUser,
  refreshToken as refreshTokenApi,
  getProfile,
  updateProfile,
  changePassword,
} from "@/services/auth.service";
import type { User, AxiosAuthError, AuthErrorCode } from "@/types";
import { isAxiosAuthError } from "@/types";

// Query keys
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
};

/**
 * Helper to extract error code from axios error
 */
const getErrorCode = (error: unknown): AuthErrorCode | undefined => {
  if (isAxiosAuthError(error)) {
    return error.response?.data?.code;
  }
  return undefined;
};

/**
 * Helper to extract HTTP status from axios error
 */
const getErrorStatus = (error: unknown): number | undefined => {
  if (isAxiosAuthError(error)) {
    return error.response?.status;
  }
  return undefined;
};

/**
 * Check if error code indicates user should be logged out
 */
const isAuthenticationError = (error: unknown): boolean => {
  const status = getErrorStatus(error);
  const code = getErrorCode(error);

  return (
    status === 401 ||
    code === "ACCESS_TOKEN_MISSING" ||
    code === "ACCESS_TOKEN_EXPIRED" ||
    code === "ACCESS_TOKEN_INVALID" ||
    code === "REFRESH_TOKEN_MISSING" ||
    code === "REFRESH_TOKEN_EXPIRED" ||
    code === "REFRESH_TOKEN_INVALID" ||
    code === "REFRESH_TOKEN_REVOKED" ||
    code === "USER_NOT_FOUND"
  );
};

// Fetch current user profile
export const useCurrentUser = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const data = await getProfile();

      return data.data;
    },
    retry: (failureCount, error: unknown) => {
      // Don't retry on authentication errors
      if (isAuthenticationError(error)) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
};

/**
 * Custom hook to access authentication state and user information.
 */
const useAuth = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/register";
  // Only fetch user if NOT on a public page to avoid api.ts interceptor redirecting
  // (since api.ts redirects on 401, and we expect 401 on public pages if not logged in)
  const userQuery = useCurrentUser({ enabled: !isPublicPage });
  const isLoading = userQuery.isPending;
  const isAuthenticated = !!(userQuery.data && !userQuery.error);

  // Check for authentication errors with proper typing
  const isUnauthenticated = isAuthenticationError(userQuery.error);

  // Redirect to login if unauthenticated and not loading
  useEffect(() => {
    if (isUnauthenticated && !isLoading && !isPublicPage) {
      // Clear any cached data to avoid showing stale state
      if (typeof window !== "undefined") {
        try {
          router.push("/login");
        } catch {
          // Fallback to window.location if router fails
          window.location.href = "/login";
        }
      }
    }
  }, [isUnauthenticated, isLoading, isPublicPage, router]);

  return {
    user: userQuery.data as User,
    isAuthenticated,
    isUnauthenticated,
    isLoading,
    error: userQuery.error ?? null,
  };
};

export default useAuth;

// Login mutation
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      waId,
      password,
    }: {
      waId: string;
      password: string;
    }) => {
      const data = await loginUser(waId, password);
      return data;
    },
    onSuccess: (data) => {
      if (data.data?.user) {
        // Server sets cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.data.user);
      }
    },
  });
};

// Register mutation
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      waId,
      name,
      password,
    }: {
      waId: string;
      name: string;
      password: string;
    }) => {
      const data = await registerUser(waId, name, password);
      return data;
    },
    onSuccess: (data) => {
      if (data.data?.user) {
        // Server sets cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.data.user);
      }
    },
  });
};

// Logout mutation
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Server clears cookies automatically, just clear the cache
      queryClient.clear();
      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
    onError: () => {
      // Even if logout fails on server, clear local state
      queryClient.clear();
      // Still redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
};

// Refresh token mutation (can be used manually if needed)
export const useRefreshToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshTokenApi,
    onSuccess: (data) => {
      if (data.data?.user) {
        // Server sets new cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.data.user);
      }
    },
    onError: (error: unknown) => {
      // If refresh fails, clear everything and redirect to login
      queryClient.clear();

      // Redirect to login page if in browser
      if (typeof window !== "undefined") {
        const errorCode = getErrorCode(error);
        // Only redirect if it's actually an auth error
        if (
          errorCode === "REFRESH_TOKEN_MISSING" ||
          errorCode === "REFRESH_TOKEN_EXPIRED" ||
          errorCode === "REFRESH_TOKEN_INVALID" ||
          errorCode === "REFRESH_TOKEN_REVOKED"
        ) {
          window.location.href = "/login";
        }
      }
    },
  });
};

// Update profile mutation
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      if (data.data?.user) {
        queryClient.setQueryData(authKeys.user(), data.data.user);
      }
    },
  });
};

// Change password mutation
export const useChangePassword = () => {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => changePassword(currentPassword, newPassword),
  });
};
