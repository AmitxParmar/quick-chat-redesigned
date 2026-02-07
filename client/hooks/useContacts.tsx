import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import useAuth from "@/hooks/useAuth";
import {
  getContacts,
  addContact,
  searchUsers,
} from "@/services/contacts.service";

/**
 * Custom hook to fetch the current authenticated user's contact list.
 * 
 * @returns The query result containing the user's contacts.
 */
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

/**
 * Custom hook to handle adding a new contact.
 * Automatically invalidates the 'contacts' query and shows a success toast on completion.
 * 
 * @returns The mutation object for adding a contact.
 */
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

/**
 * Custom hook to search for users based on a search string.
 * 
 * @param query - The search term used to filter users.
 * @param enabled - Optional flag to enable or disable the query (defaults to true).
 * @returns The query result containing the found users.
 */
export const useSearchUsers = (query: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["search-users", query],
    queryFn: () => searchUsers(query),
    enabled: !!query && enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
};
