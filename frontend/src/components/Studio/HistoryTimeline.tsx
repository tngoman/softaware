import { useStudioHistory } from '../../hooks/useStudioHistory';
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function HistoryTimeline() {
  const { entries, currentIndex, goTo } = useStudioHistory();

  if (entries.length === 0) {
    return (
      <div className="p-3 text-center">
        <ClockIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">No history yet</p>
        <p className="text-[10px] text-gray-600">Changes will appear here</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2">
        <ClockIcon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-300">History</span>
        <span className="text-[10px] text-gray-600 ml-auto">{entries.length} states</span>
      </div>

      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        {entries.map((entry, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
              i === currentIndex
                ? 'bg-indigo-600/20 text-indigo-300'
                : i < currentIndex
                  ? 'text-gray-400 hover:bg-gray-800'
                  : 'text-gray-600 hover:bg-gray-800'
            }`}
          >
            {i === currentIndex ? (
              <CheckCircleIcon className="w-3 h-3 text-indigo-400 shrink-0" />
            ) : (
              <div className={`w-3 h-3 rounded-full border shrink-0 ${
                i < currentIndex ? 'border-gray-500 bg-gray-600' : 'border-gray-700'
              }`} />
            )}
            <span className="truncate flex-1">
              {i === 0 ? 'Initial state' : `Change #${i}`}
            </span>
            <span className="text-[9px] text-gray-600">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
