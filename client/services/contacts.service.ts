import api from "@/lib/api";

const API_BASE = "/contacts";

export const getContacts = async () => {
  const response = await api.get(API_BASE);
  return response.data || {};
};

export const addContact = async (waId: string) => {
  const response = await api.post(API_BASE, { waId });
  return response.data;
};

export const searchUsers = async (query: string) => {
  const response = await api.get(`${API_BASE}/search`, {
    params: { q: query },
  });
  return response.data;
};
