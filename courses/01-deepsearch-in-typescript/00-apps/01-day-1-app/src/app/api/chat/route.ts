import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { z } from "zod";
import { auth } from "~/server/auth";
import { model } from "~/model";
import { searchSerper } from "~/serper";
import { upsertChat } from "~/server/db/chat";
import { db } from "~/server/db";
import { chats } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Check if user is authenticated
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat?: boolean;
  };
  const { messages, chatId, isNewChat = false } = body;

  if (!messages.length) {
    return new Response("No messages provided", { status: 400 });
  }

  // Use the provided chatId (now always a string)
  const currentChatId = chatId;

  // If this is NOT a new chat, verify the chat belongs to the user
  if (!isNewChat) {
    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, currentChatId),
    });
    if (!chat || chat.userId !== session.user.id) {
      return new Response("Chat not found or unauthorized", { status: 404 });
    }
  }

  // If this is a new chat, create it in the database before streaming
  if (isNewChat) {
    await upsertChat({
      userId: session.user.id,
      chatId: currentChatId,
      title: messages[messages.length - 1]!.content.slice(0, 50) + "...",
      messages: messages,
    });
  }
  return createDataStreamResponse({
    execute: async (dataStream) => {
      // If this is a new chat, notify the frontend
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: currentChatId,
        });
      }

      const { messages } = body;

      const result = streamText({
        model,
        messages,
        system: `You are an intelligent AI research assistant with access to real-time web search capabilities.

CORE INSTRUCTIONS:
- Always search for current, accurate information before answering questions
- Use the searchWeb tool for any query that requires factual, up-to-date, or specific information
- Provide comprehensive, well-structured answers based on search results
- Be thorough in your research - search multiple times if needed to get complete information

CITATION REQUIREMENTS:
- Always cite your sources using inline markdown links: [source title](URL)
- Include citations throughout your response, not just at the end
- When referencing specific facts, immediately follow with the citation
- Use multiple sources to provide a well-rounded answer

RESPONSE FORMAT:
- Structure your answers clearly with headings and bullet points when appropriate
- Synthesize information from multiple sources rather than just summarizing one
- Explain complex topics in an accessible way
- If information is conflicting between sources, acknowledge this and explain the differences

SEARCH STRATEGY:
- Use specific, targeted search queries to find the most relevant information
- Search for recent developments or updates on topics when relevant
- Consider searching for multiple aspects of complex questions`,
        maxSteps: 10,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        onFinish: async ({ response }) => {
          // Merge the existing messages with the response messages
          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages: response.messages,
          });

          const lastMessage = messages[messages.length - 1];
          if (!lastMessage) {
            return;
          }

          // Save the complete chat history
          await upsertChat({
            userId: session.user.id,
            chatId: currentChatId,
            title: lastMessage.content.slice(0, 50) + "...",
            messages: updatedMessages,
          });
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
