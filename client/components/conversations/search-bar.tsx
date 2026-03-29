"use client";

import { Search, Loader2, User as UserIcon, Phone } from "lucide-react";
import React, { useRef, useState, useEffect } from "react";
import { Input } from "../ui/input";
import { useCustomerSearch } from "@/hooks/useSearchResults";
import { useRouter } from "next/navigation";
import type { Customer } from "@/services/customers.service";

function SearchBar() {
  const router = useRouter();
  const { query, setQuery, customers, isLoading, isEmpty } = useCustomerSearch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (customer: Customer) => {
    setOpen(false);
    router.push(`/order?customerId=${customer.id}&name=${encodeURIComponent(`${customer.first_name} ${customer.last_name}`)}`);
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex items-center py-3 px-4 gap-3 h-14">
      <div className="bg-searchbar flex flex-grow items-center gap-1 px-3 py-1 rounded-full">
        <div>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="cursor-pointer text-sm" />
          )}
        </div>
        <div className="w-full">
          <Input
            id="customer-search-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search customers, phone or order ID…"
            className="border-none leading-1 ring-0 focus:ring-0 focus-visible:ring-0 bg-transparent dark:bg-transparent"
          />
        </div>
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div
          id="customer-search-results"
          className="absolute top-full left-4 right-4 z-50 mt-1 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
        >
          {isEmpty ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto divide-y divide-border">
              {customers.map((customer) => (
                <li
                  key={customer.id}
                  id={`customer-result-${customer.id}`}
                  role="option"
                  onClick={() => handleSelect(customer)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors"
                >
                  {/* Avatar placeholder */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{customer.phone_number}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
