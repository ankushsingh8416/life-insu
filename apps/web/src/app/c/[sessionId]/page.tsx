import { ChatWindow } from "@/components/chat/chat-window";

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatWindow sharedSessionId={sessionId} />;
}
