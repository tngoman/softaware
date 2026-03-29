import { useState, useEffect } from 'react';
import { useStudioState } from '../../hooks/useStudioState';
import { CodeBracketIcon, DocumentIcon } from '@heroicons/react/24/outline';

type EditorTab = 'html' | 'css';

export default function CodeEditorPanel() {
  const { state, dispatch } = useStudioState();
  const [tab, setTab] = useState<EditorTab>('html');
  const [htmlContent, setHtmlContent] = useState('');
  const [cssContent, setCssContent] = useState('');

  const currentPageData = state.pages.find(p => p.id === state.currentPage);

  useEffect(() => {
    if (currentPageData) {
      setHtmlContent(currentPageData.html_content || '');
      setCssContent(currentPageData.css_content || '');
    }
  }, [currentPageData]);

  const handleSave = () => {
    if (!state.currentPage) return;
    dispatch({
      type: 'UPDATE_PAGE',
      pageId: state.currentPage,
      updates: {
        html_content: htmlContent,
        css_content: cssContent,
      },
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CodeBracketIcon className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium">Code</span>
        </div>
        <button
          onClick={handleSave}
          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-medium transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 shrink-0">
        <button
          onClick={() => setTab('html')}
          className={`flex items-center gap-1 flex-1 px-3 py-1.5 text-xs transition-colors ${
            tab === 'html' ? 'text-emerald-400 border-b border-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <DocumentIcon className="w-3 h-3" /> HTML
        </button>
        <button
          onClick={() => setTab('css')}
          className={`flex items-center gap-1 flex-1 px-3 py-1.5 text-xs transition-colors ${
            tab === 'css' ? 'text-emerald-400 border-b border-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <CodeBracketIcon className="w-3 h-3" /> CSS
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden">
        {!state.currentPage ? (
          <p className="text-xs text-gray-600 text-center py-8">Select a page to edit code</p>
        ) : (
          <textarea
            value={tab === 'html' ? htmlContent : cssContent}
            onChange={e => {
              if (tab === 'html') setHtmlContent(e.target.value);
              else setCssContent(e.target.value);
            }}
            spellCheck={false}
            className="w-full h-full bg-gray-950 text-gray-300 text-xs font-mono p-3 resize-none focus:outline-none leading-relaxed"
            placeholder={tab === 'html' ? '<!-- HTML content -->' : '/* CSS styles */'}
          />
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 py-1 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-600 shrink-0">
        <span>{currentPageData?.name || 'No page'}</span>
        <span>{tab === 'html' ? htmlContent.length : cssContent.length} chars</span>
      </div>
    </div>
  );
}
