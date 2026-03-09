/**
 * ChatSidebar — external group list with search and unread badges.
 */
import React from 'react';
import {
  GlobeAltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { UnifiedGroup } from './chatTypes';
import { getInitials, formatMessageTime } from './chatTypes';

interface ChatSidebarProps {
  groups: UnifiedGroup[];
  selectedGroup: UnifiedGroup | null;
  onSelectGroup: (group: UnifiedGroup) => void;
  socketConnected: boolean;
  groupSearch: string;
  onGroupSearchChange: (val: string) => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  groups,
  selectedGroup,
  onSelectGroup,
  socketConnected,
  groupSearch,
  onGroupSearchChange,
}) => {
  return (
    <div className="w-80 border-r flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <GlobeAltIcon className="h-5 w-5 text-picton-blue" />
            External Groups
          </h2>
          <span
            className={`flex items-center gap-1 text-[10px] ${
              socketConnected ? 'text-green-600' : 'text-gray-400'
            }`}
            title={socketConnected ? 'Socket connected' : 'Socket offline'}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                socketConnected ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            {socketConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={groupSearch}
            onChange={(e) => onGroupSearchChange(e.target.value)}
            placeholder="Search groups…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue"
          />
        </div>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <GlobeAltIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {groupSearch ? 'No matching groups' : 'No groups available'}
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const isSelected = selectedGroup?.id === group.id;
            const hasUnread = (group.unread_count ?? 0) > 0;

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b hover:bg-gray-100 transition-colors ${
                  isSelected ? 'bg-picton-blue/10 border-l-2 border-l-picton-blue' : ''
                }`}
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 bg-gradient-to-br from-picton-blue to-indigo-500">
                  {getInitials(group.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4
                        className={`text-sm font-medium truncate ${
                          hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-900'
                        }`}
                      >
                        {group.name}
                      </h4>
                      <GlobeAltIcon
                        className="h-3 w-3 text-indigo-400 shrink-0"
                        title="External group"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {group.timestamp ? (
                        <span className="text-[10px] text-gray-400">
                          {formatMessageTime(group.timestamp)}
                        </span>
                      ) : null}
                      {/* GRP-010: unread badge */}
                      {hasUnread && (
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-picton-blue text-white text-[10px] font-bold px-1">
                          {group.unread_count! > 99 ? '99+' : group.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className={`text-xs truncate ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                    {group.last_message || 'No messages'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatSidebar);
