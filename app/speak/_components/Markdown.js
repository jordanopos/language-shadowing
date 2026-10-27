'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Safe rendering of AI-generated Markdown: raw HTML is skipped entirely
// (no rehype-raw), images are dropped, and links open safely in a new tab.
const components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
  img: () => null,
  table: ({ node, ...props }) => <div className="si-md-table"><table {...props} /></div>,
};

export default function Markdown({ children, className = '' }) {
  return (
    <div className={`si-md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={components}>
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}
