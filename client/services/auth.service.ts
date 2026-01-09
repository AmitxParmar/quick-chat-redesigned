import api from "@/lib/api";

const API_BASE = "/auth";

// Register a new user
export async function register(waId: string, name: string, password: string) {
  const response = await api.post(`${API_BASE}/register`, {
    waId,
    name,
    password,
  });
  return response.data;
}

// Login user
export async function login(waId: string, password: string) {
  const response = await api.post(`${API_BASE}/login`, { waId, password });
  return response.data;
}

// Logout user
export async function logout() {
  const response = await api.post(`${API_BASE}/logout`);
  return response.data;
}

// Refresh access token
export async function refreshToken() {
  const response = await api.post(`${API_BASE}/refresh-token`);
  return response.data;
}

// Get current authenticated user profile
export async function getProfile() {
  const response = await api.get(`${API_BASE}/profile`);
  return response.data;
}

// Update current authenticated user profile
export async function updateProfile(profileData: {
  name?: string;
  profilePicture?: string;
  status?: string;
}) {
  const response = await api.put(`${API_BASE}/profile`, profileData);
  return response.data;
}

// Change user password
export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  const response = await api.put(`${API_BASE}/change-password`, {
    currentPassword,
    newPassword,
  });
  return response.data;
}
