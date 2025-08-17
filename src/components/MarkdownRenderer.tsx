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
          <h1 className="text-xl font-bold mb-3 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium mb-2 text-foreground">{children}</h3>
        ),
        
        // Style paragraphs
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        
        // Style lists
        ul: ({ children }) => (
          <ul className="list-none space-y-2 mb-3 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-2 mb-3 last:mb-0 ml-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="flex items-start">
            <span className="inline-block w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
            <span className="flex-1">{children}</span>
          </li>
        ),
        
        // Style strong/bold text
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        
        // Style emphasis/italic text
        em: ({ children }) => (
          <em className="italic text-foreground/90">{children}</em>
        ),
        
        // Style code
        code: ({ children }) => (
          <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-sm font-mono text-foreground border border-secondary/30">
            {children}
          </code>
        ),
        
        // Style code blocks
        pre: ({ children }) => (
          <pre className="bg-secondary/30 p-3 rounded-lg overflow-x-auto mb-3 last:mb-0 border border-secondary/30">
            {children}
          </pre>
        ),
        
        // Style blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary pl-4 py-2 mb-3 last:mb-0 bg-secondary/20 rounded-r">
            {children}
          </blockquote>
        ),
        
        // Style links
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:text-primary-hover underline decoration-primary/50 hover:decoration-primary transition-colors"
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