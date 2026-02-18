import React from "react";
import dynamic from "next/dynamic";
import ContactHeader from "./conversation-list-header";
import SearchBar from "./search-bar";

const ConversationList = dynamic(() => import("./conversation-list"), {
  ssr: false,
});

const Conversations = () => {
  return (
    <div className="border-r overflow-auto flex flex-col z-20">
      <ContactHeader />
      <SearchBar />
      <ConversationList />
    </div>
  );
};

export default Conversations;
