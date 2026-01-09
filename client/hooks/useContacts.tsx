import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAuth from "@/hooks/useAuth";
import {
  getContacts,
  addContact,
  searchUsers,
} from "@/services/contacts.service";

export const useContacts = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contacts", user?.waId],
    queryFn: getContacts,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!user?.waId,
    select: (data) => data.data,
  });
};

export const useAddContact = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addContact,
    onSuccess: () => {
      toast.success("Contact added successfully");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
};

export const useSearchUsers = (query: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(query),
    enabled: !!query && enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
};
