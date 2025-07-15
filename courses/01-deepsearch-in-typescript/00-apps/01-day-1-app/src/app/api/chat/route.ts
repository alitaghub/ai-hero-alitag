import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
} from "ai";
import { z } from "zod";
import { auth } from "~/server/auth";
import { model } from "~/model";
import { searchSerper } from "~/serper";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Check if user is authenticated
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
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
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
