import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders organizer-authored free text (trip notes, accommodation details,
 * card notes) as Markdown so a "welcome message" can be styled — bold, lists,
 * headings, links, etc.
 *
 * Safe by construction: react-markdown builds a React element tree and never
 * injects raw HTML (we do not enable rehype-raw), so user-supplied content
 * can't inject markup. remark-gfm keeps the bare-URL / www. autolinking that
 * the previous Linkify component provided, so existing notes still get clickable
 * links without any Markdown syntax.
 */
export default function Markdown({ children }: { children?: React.ReactNode }) {
  const text = typeof children === "string" ? children : "";
  if (!text) return children ?? null;

  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Open links in a new tab and keep them safe.
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
