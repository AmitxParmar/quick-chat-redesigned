import { Search } from "lucide-react";
import React from "react";
import { Input } from "../ui/input";

function SearchBar() {
  return (
    <div className="flex items-center py-3 px-4 gap-3 h-14">
      <div className="bg-searchbar flex flex-grow items-center gap-1 px-3 py-1 rounded-full">
        <div>
          <Search className="cursor-pointer text-sm" />
        </div>
        <div className="w-full">
          <Input
            type="text"
            placeholder="Search or start new chat"
            className="border-none leading-1 ring-0 focus:ring-0 focus-visible:ring-0 bg-transparent dark:bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
