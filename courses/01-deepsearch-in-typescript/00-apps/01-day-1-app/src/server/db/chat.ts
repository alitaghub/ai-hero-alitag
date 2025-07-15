import { eq, desc, and } from "drizzle-orm";
import type { Message } from "ai";
import { db } from "./index";
import { chats, messages } from "./schema";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Message[];
}) => {
  const { userId, chatId, title, messages: newMessages } = opts;

  // First, check if the chat exists and belongs to the user
    const existingChat = await db.query.chats.findFirst({
        where: eq(chats.id, chatId),
    });

    if (existingChat) {
        // If chat exists but belongs to a different user, throw error
        if (existingChat.userId !== userId) {
            throw new Error("Chat ID already exists under a different user");
        }
        // Delete all existing messages
        await db.delete(messages).where(eq(messages.chatId, chatId));
    } else {
        // Create new chat
        await db.insert(chats).values({
            id: chatId,
            userId,
            title,
        });
    }
    // Insert all messages
    await db.insert(messages).values(
        newMessages.map((message, index) => ({
            id: crypto.randomUUID(),
            chatId,
            role: message.role,
            parts: message.parts,
            order: index,
        })),
    );

    return { id: chatId };
};

export const getChat = async (opts: { userId: string; chatId: string }) => {
  const { userId, chatId } = opts;

  // Use findFirst with relations for cleaner and more efficient query
  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      messages: {
        orderBy: messages.order,
      },
    },
  });

  if (!chat) {
    return null;
  }

  return {
    ...chat,
    messages: chat.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.parts,
    })),
  };
};

export const getChats = async (opts: { userId: string; limit?: number }) => {
  const { userId, limit = 50 } = opts;

  // Use findMany with query API for consistency
  return await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: desc(chats.updatedAt),
    limit,
  });

};
