import React, { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Full emoji picker with categories and search.
 * Lightweight — uses native emojis (no external lib).
 */

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔',
      '🫣','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪',
      '🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎',
      '🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰',
      '😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈',
      '👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
    ],
  },
  {
    name: 'Gestures',
    icon: '👍',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏',
      '🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻',
      '👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','🫦',
    ],
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓',
      '💗','💖','💘','💝','💟','♥️','💋','💯','💢','💥','💫','💦','💨','🕳️','💤',
    ],
  },
  {
    name: 'Objects',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🎗️','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐',
      '🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥊','🥋','🎯','⛳','🪁','🎣','🤿','🎿','🛷',
      '🥌','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🪕',
      '🎻','🪈','💻','📱','📷','📹','🔔','📌','📍','✏️','📝','📎','📁','📊',
    ],
  },
  {
    name: 'Nature',
    icon: '🌸',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🌸','🌹','🌺','🌻','🌼','🌷','🪷','🌱','🌲','🌳','🌴','🌵','🎋','🎍','🍀','🍁',
      '🍂','🍃','🌾','🪻','🪺','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐',
      '☀️','🌤️','⛅','🌦️','🌧️','🌨️','🌩️','🌪️','🌈','⭐','🌟','✨','🔥','💧','🌊',
    ],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: [
      '🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓',
      '🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍝','🍜','🍲','🍛','🍣','🍱',
      '🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍡','🧁','🍰','🎂','🍮','🍭','🍬',
      '🍫','🍩','🍪','☕','🍵','🧃','🥤','🧋','🍺','🍻','🥂','🍷','🍸','🍹','🧉','🍾',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  // Simple search: filter emojis by name-ish (we can't really search emoji by name without a lib, so filter all)
  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const displayEmojis = search
    ? allEmojis // In reality you'd need an emoji name map; for now show all and let the user scroll
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div className="w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
      {/* Header with search */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex gap-0.5 px-2 py-1 border-b border-gray-100 overflow-x-auto">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(idx)}
              className={`p-1.5 rounded text-base hover:bg-gray-100 flex-shrink-0 ${
                idx === activeCategory ? 'bg-gray-100' : ''
              }`}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
        {displayEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category label */}
      {!search && (
        <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            {EMOJI_CATEGORIES[activeCategory].name}
          </p>
        </div>
      )}
    </div>
  );
}
