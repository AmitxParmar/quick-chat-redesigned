import Chat from "@/components/chat";

const Conversation = async ({
  params,
}: {
  params: Promise<{ conversationId: string[] }>;
}) => {
  // Ensure params are awaited even if we don't use them directly here, 
  // though strictly speaking we don't need to read them if the child hook reads them.
  // But good to keep the await for Nextjs behavior consistency.
  await params;

  return (
    <Chat />
  );
};

export default Conversation;
