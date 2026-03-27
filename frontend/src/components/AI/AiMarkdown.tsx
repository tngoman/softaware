import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * AiMarkdown — Shared markdown renderer for AI assistant chat messages.
 * Supports code blocks with diff highlighting, tables, headings, and rich text.
 */
const AiMarkdown: React.FC<{ content: string }> = ({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre({ children }) {
        return (
          <pre className="bg-[#0f172a] text-slate-50 rounded-lg p-4 overflow-x-auto text-[13px] leading-relaxed my-3 font-mono [&_code]:bg-transparent [&_code]:text-inherit [&_code]:p-0 [&_code]:rounded-none [&_code]:text-[13px] [&_code]:font-mono">
            {children}
          </pre>
        );
      },
      code({ className, children, ...props }: any) {
        const lang = className?.replace('language-', '');
        if (lang === 'diff') {
          const lines = String(children).replace(/\n$/, '').split('\n');
          return (
            <code {...props}>
              {lines.map((line: string, i: number) => {
                let cls = 'text-slate-300';
                if (line.startsWith('+')) cls = 'text-emerald-400';
                else if (line.startsWith('-')) cls = 'text-red-400';
                else if (line.startsWith('@@')) cls = 'text-cyan-400 font-semibold';
                return <span key={i} className={cls}>{line}{i < lines.length - 1 ? '\n' : ''}</span>;
              })}
            </code>
          );
        }
        if (lang) {
          return (
            <code {...props}>
              <div className="flex justify-between items-center mb-2 -mt-1 border-b border-slate-700 pb-1.5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{lang}</span>
              </div>
              {children}
            </code>
          );
        }
        // Inline code
        return (
          <code className="bg-slate-200/80 dark:bg-slate-700/80 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[12px] font-mono" {...props}>
            {children}
          </code>
        );
      },
      table({ children, ...props }: any) {
        return (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full text-xs border-collapse border border-gray-300 dark:border-gray-600 rounded" {...props}>{children}</table>
          </div>
        );
      },
      th({ children, ...props }: any) {
        return <th className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 text-left font-semibold border border-gray-300 dark:border-gray-600 text-[11px]" {...props}>{children}</th>;
      },
      td({ children, ...props }: any) {
        return <td className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 text-[11px]" {...props}>{children}</td>;
      },
      h1({ children, ...props }: any) {
        return <h1 className="text-lg font-bold mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h1>;
      },
      h2({ children, ...props }: any) {
        return <h2 className="text-base font-bold mt-3 mb-1.5 text-gray-800 dark:text-gray-200" {...props}>{children}</h2>;
      },
      h3({ children, ...props }: any) {
        return <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-800 dark:text-gray-200" {...props}>{children}</h3>;
      },
      ul({ children, ...props }: any) {
        return <ul className="list-disc list-outside ml-4 my-1.5 space-y-0.5 text-sm" {...props}>{children}</ul>;
      },
      ol({ children, ...props }: any) {
        return <ol className="list-decimal list-outside ml-4 my-1.5 space-y-0.5 text-sm" {...props}>{children}</ol>;
      },
      li({ children, ...props }: any) {
        return <li className="text-sm leading-relaxed" {...props}>{children}</li>;
      },
      p({ children, ...props }: any) {
        return <p className="my-1.5 text-sm leading-relaxed" {...props}>{children}</p>;
      },
      strong({ children, ...props }: any) {
        return <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props}>{children}</strong>;
      },
      blockquote({ children, ...props }: any) {
        return <blockquote className="border-l-3 border-emerald-400 pl-3 my-2 text-gray-600 dark:text-gray-400 italic text-sm" {...props}>{children}</blockquote>;
      },
      hr() {
        return <hr className="my-3 border-gray-200 dark:border-gray-600" />;
      },
      a({ children, href, ...props }: any) {
        return <a href={href} className="text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-800 dark:hover:text-emerald-300" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

export default AiMarkdown;
