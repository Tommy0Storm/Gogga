/**
 * MarkdownRenderer Component
 * Renders markdown content as properly styled HTML
 * Uses react-markdown with custom component mappings
 */

'use client';

import React, { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  variant?: 'assistant' | 'user';
  className?: string;
}

// Code block with copy button
const CodeBlock = memo(({ children, className, ...props }: any) => {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline code
  if (!match) {
    return (
      <code className="bg-primary-100 text-primary-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  }

  // Code block
  return (
    <div className="relative group my-3">
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-primary-800 rounded-t-xl border-b border-primary-700">
        <span className="text-xs text-primary-400 font-medium uppercase tracking-wide">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-primary-400 hover:text-white transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-primary-900 text-primary-100 p-4 pt-12 rounded-xl overflow-x-auto text-sm font-mono leading-relaxed">
        <code className="text-primary-100" {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// Custom components for assistant messages
const assistantComponents = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold text-primary-900 mt-6 mb-3 pb-2 border-b border-primary-200" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-xl font-bold text-primary-900 mt-5 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-lg font-semibold text-primary-800 mt-4 mb-2" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: any) => (
    <h4 className="text-base font-semibold text-primary-800 mt-3 mb-1" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }: any) => (
    <p className="mb-3 last:mb-0 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-outside ml-5 mb-3 space-y-1.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-outside ml-5 mb-3 space-y-1.5" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="pl-1 leading-relaxed" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-bold text-primary-900" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-primary-700" {...props}>
      {children}
    </em>
  ),
  code: CodeBlock,
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-primary-400 pl-4 py-2 my-3 bg-primary-50 rounded-r-lg text-primary-600 italic" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }: any) => (
    <a 
      href={href} 
      className="text-primary-700 underline underline-offset-2 hover:text-primary-900 transition-colors" 
      target="_blank" 
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  hr: (props: any) => (
    <hr className="border-primary-200 my-4" {...props} />
  ),
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-primary-100" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="text-left p-2 font-semibold border border-primary-200" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="p-2 border border-primary-200" {...props}>
      {children}
    </td>
  ),
  img: ({ src, alt, ...props }: any) => (
    <img 
      src={src} 
      alt={alt || ''} 
      className="max-w-full rounded-xl shadow-soft my-3" 
      loading="lazy"
      {...props} 
    />
  ),
};

// Custom components for user messages (light text on dark background)
const userComponents = {
  ...assistantComponents,
  h1: ({ children, ...props }: any) => (
    <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-lg font-bold text-white mt-3 mb-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-base font-semibold text-white/90 mt-3 mb-1" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="mb-2 last:mb-0 leading-relaxed text-white" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-outside ml-5 mb-2 space-y-1 text-white" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-outside ml-5 mb-2 space-y-1 text-white" {...props}>
      {children}
    </ol>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-bold text-white" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-white/90" {...props}>
      {children}
    </em>
  ),
  code: ({ children, className, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    if (match) {
      return <CodeBlock className={className} {...props}>{children}</CodeBlock>;
    }
    return (
      <code className="bg-white/20 text-white px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-white/40 pl-4 py-1 my-2 text-white/80 italic" {...props}>
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }: any) => (
    <a 
      href={href} 
      className="text-white underline underline-offset-2 hover:text-white/80 transition-colors" 
      target="_blank" 
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

export const MarkdownRenderer = memo(({ content, variant = 'assistant', className = '' }: MarkdownRendererProps) => {
  const components = variant === 'user' ? userComponents : assistantComponents;
  
  return (
    <div className={`prose-gogga ${variant === 'user' ? 'prose-gogga-user' : ''} ${className}`}>
      <Markdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer;
