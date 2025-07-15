import ReactMarkdown, { type Components } from "react-markdown";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Message } from "ai";

export type MessagePart = NonNullable<Message["parts"]>[number];

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

const ToolInvocation = ({ part }: { part: MessagePart }) => {
  const [showAllResults, setShowAllResults] = useState(false);

  if (part.type !== "tool-invocation") return null;

  const { toolInvocation } = part;

  // Get the tool icon based on tool name
  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case "searchWeb":
        return <Search className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  // Get tool display name
  const getToolDisplayName = (toolName: string) => {
    switch (toolName) {
      case "searchWeb":
        return "Web Search";
      default:
        return toolName;
    }
  };

  if (toolInvocation.state === "partial-call") {
    return (
      <div className="mb-4 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
        <div className="flex items-center gap-2 text-blue-400">
          <div className="animate-pulse">
            {getToolIcon(toolInvocation.toolName)}
          </div>
          <span className="text-sm font-medium">
            {getToolDisplayName(toolInvocation.toolName)} - Executing...
          </span>
        </div>
      </div>
    );
  }

  if (toolInvocation.state === "call") {
    return (
      <div className="mb-4 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
        <div className="flex items-center gap-2 text-blue-400">
          {getToolIcon(toolInvocation.toolName)}
          <span className="text-sm font-medium">
            {getToolDisplayName(toolInvocation.toolName)} -{" "}
            {toolInvocation.args.query}
          </span>
        </div>
      </div>
    );
  }

  if (toolInvocation.state === "result") {
    const results = Array.isArray(toolInvocation.result)
      ? (toolInvocation.result as Array<{
          title: string;
          link: string;
          snippet: string;
        }>)
      : [];

    const displayResults = showAllResults ? results : results.slice(0, 3);

    return (
      <div className="mb-4 rounded-lg border border-green-800 bg-green-900/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400">
            {getToolIcon(toolInvocation.toolName)}
            <span className="text-sm font-medium">
              {getToolDisplayName(toolInvocation.toolName)} - Found{" "}
              {results.length} results
            </span>
          </div>
          {results.length > 3 && (
            <button
              onClick={() => setShowAllResults(!showAllResults)}
              className="flex items-center gap-1 text-xs text-green-400 transition-colors hover:text-green-300"
            >
              {showAllResults ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show all ({results.length})
                </>
              )}
            </button>
          )}
        </div>

        <div className="mb-2 text-xs text-green-300">
          Query:{" "}
          <span className="font-normal text-green-200">
            {toolInvocation.args.query}
          </span>
        </div>

        <div className="space-y-2">
          {displayResults.map((result, index) => (
            <div
              key={index}
              className="border-l-2 border-green-700 pl-3 text-sm"
            >
              <a
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-400 underline hover:text-blue-300"
              >
                {result.title}
              </a>
              <p className="mt-1 text-xs text-gray-400">{result.snippet}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="prose prose-invert max-w-none">
          {parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return <Markdown key={index}>{part.text}</Markdown>;
              case "tool-invocation":
                return <ToolInvocation key={index} part={part} />;
              default:
                // For other part types, you can hover over MessagePart to see all possibilities
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};
