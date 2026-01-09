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
import { User } from "@/types";

// Query keys
export const authKeys = {
  all: ["auth"] as const,
  user: () => [...authKeys.all, "user"] as const,
};

// Fetch current user profile
export const useCurrentUser = (options?: { enabled?: boolean }) => {

  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const data = await getProfile();

      console.log("messages", data.data)
      return data.data;
    },
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      const status = error?.response?.status;
      const code = error?.response?.data?.code;

      if (status === 401 ||
        code === "ACCESS_TOKEN_MISSING" ||
        code === "ACCESS_TOKEN_EXPIRED" ||
        code === "ACCESS_TOKEN_INVALID" ||
        code === "REFRESH_TOKEN_MISSING" ||
        code === "REFRESH_TOKEN_EXPIRED" ||
        code === "REFRESH_TOKEN_INVALID") {
        return false;
      }
      return failureCount < 2;
    },
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
  const isLoginPage = pathname === "/login";
  const userQuery = useCurrentUser({ enabled: !isLoginPage });
  const isLoading = userQuery.isLoading;
  const isAuthenticated = !!(userQuery.data && !userQuery.error);

  // Check for authentication errors
  const error = userQuery.error as any;
  const errorStatus = error?.response?.status;
  const errorCode = error?.response?.data?.code;

  const isUnauthenticated =
    errorStatus === 401 ||
    errorCode === "ACCESS_TOKEN_MISSING" ||
    errorCode === "ACCESS_TOKEN_EXPIRED" ||
    errorCode === "ACCESS_TOKEN_INVALID" ||
    errorCode === "REFRESH_TOKEN_MISSING" ||
    errorCode === "REFRESH_TOKEN_EXPIRED" ||
    errorCode === "REFRESH_TOKEN_INVALID" ||
    errorCode === "USER_NOT_FOUND";

  // Redirect to login if unauthenticated and not loading
  useEffect(() => {
    if (isUnauthenticated && !isLoading && !isLoginPage) {
      // Clear any cached data to avoid showing stale state
      if (typeof window !== "undefined") {
        try {
          router.push("/login");
        } catch (error) {
          // Fallback to window.location if router fails
          window.location.href = "/login";
        }
      }
    }
  }, [isUnauthenticated, isLoading, isLoginPage, router]);

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
      if (data.success && data.user) {
        // Server sets cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.user);
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
      if (data.success && data.user) {
        // Server sets cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.user);
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
      if (data.success && data.user) {
        // Server sets new cookies automatically, just update the user data
        queryClient.setQueryData(authKeys.user(), data.user);
      }
    },
    onError: (error: any) => {
      // If refresh fails, clear everything and redirect to login
      queryClient.clear();

      // Redirect to login page if in browser
      if (typeof window !== "undefined") {
        const errorCode = error?.response?.data?.code;
        // Only redirect if it's actually an auth error
        if (errorCode === "REFRESH_TOKEN_MISSING" ||
          errorCode === "REFRESH_TOKEN_EXPIRED" ||
          errorCode === "REFRESH_TOKEN_INVALID") {
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
      if (data.success && data.user) {
        queryClient.setQueryData(authKeys.user(), data.user);
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
