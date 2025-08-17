import ReactMarkdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={{
        // Style headings
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mb-3 text-black">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-2 text-black">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium mb-2 text-black">{children}</h3>
        ),
        
        // Style paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        
        // Style lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-2 mb-3 last:mb-0 ml-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-2 mb-3 last:mb-0 ml-4">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-gray-800 leading-relaxed">{children}</li>
        ),
        
        // Style strong/bold text
        strong: ({ children }) => (
          <strong className="font-bold text-black">{children}</strong>
        ),
        
        // Style emphasis/italic text
        em: ({ children }) => (
          <em className="italic text-foreground/90">{children}</em>
        ),
        
        // Style code
        code: ({ children }) => (
          <code className="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono text-slate-900">
            {children}
          </code>
        ),
        
        // Style code blocks
        pre: ({ children }) => (
          <pre className="bg-slate-50 p-3 rounded-xl overflow-x-auto mb-3 last:mb-0 border border-slate-200 font-mono text-sm text-slate-900">
            {children}
          </pre>
        ),
        
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-sky-500 pl-4 py-3 mb-3 last:mb-0 bg-slate-50 rounded-r italic text-slate-700">
            {children}
          </blockquote>
        ),
        
        // Style links
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sky-700 hover:text-sky-900 underline decoration-sky-500/50 hover:decoration-sky-700 transition-colors"
          >
            {children}
          </a>
        ),
        
        // Style horizontal rules
        hr: () => (
          <hr className="border-secondary my-4" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}