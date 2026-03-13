import React, { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../../types';
import TaskCard from './TaskCard';

/* ── Column Definitions ────────────────────────────────── */
const KANBAN_COLUMNS = [
  { id: 'new', title: 'New', color: 'from-blue-500 to-blue-600', lightBg: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  { id: 'in-progress', title: 'In Progress', color: 'from-amber-500 to-orange-500', lightBg: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  { id: 'completed', title: 'Completed', color: 'from-emerald-500 to-green-600', lightBg: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  { id: 'pending', title: 'Pending', color: 'from-gray-400 to-gray-500', lightBg: 'bg-gray-50', textColor: 'text-gray-600', borderColor: 'border-gray-200' },
];

/* ── Shared action callbacks type ──────────────────────── */
interface CardActionProps {
  onView: (task: Task) => void;
  onBookmark: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: string) => void;
  onPriorityChange?: (task: Task, priority: string) => void;
  onAssign?: (task: Task) => void;
  onLink?: (task: Task) => void;
  apiUrl?: string;
  softwareId?: number;
  onImageClick?: (url: string) => void;
  onGalleryOpen?: (images: { url: string; name?: string }[], index: number) => void;
  fontSize?: 'sm' | 'md' | 'lg';
}

/* ── Sortable Card Wrapper ─────────────────────────────── */
const SortableCard: React.FC<{
  task: Task;
  lastComment?: { text: string; author: string; date: string | null };
} & CardActionProps> = ({ task, lastComment, onView, onBookmark, onEdit, onDelete, onStatusChange, onPriorityChange, onAssign, onLink, apiUrl, softwareId, onImageClick, onGalleryOpen, fontSize }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task-${task._local_id || task.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        variant="kanban"
        fontSize={fontSize}
        onView={onView}
        onBookmark={onBookmark}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onPriorityChange={onPriorityChange}
        onAssign={onAssign}
        onLink={onLink}
        lastComment={lastComment}
        isDragging={isDragging}
        apiUrl={apiUrl}
        softwareId={softwareId}
        onImageClick={onImageClick}
        onGalleryOpen={onGalleryOpen}
      />
    </div>
  );
};

/* ── Kanban Column (droppable) ─────────────────────────── */
const KanbanColumn: React.FC<{
  column: typeof KANBAN_COLUMNS[0];
  tasks: Task[];
  lastComments: Record<number, { text: string; author: string; date: string | null }>;
  isOver?: boolean;
} & CardActionProps> = ({ column, tasks, lastComments, isOver, onView, onBookmark, onEdit, onDelete, onStatusChange, onPriorityChange, onAssign, onLink, apiUrl, softwareId, onImageClick, onGalleryOpen, fontSize }) => {
  const taskIds = tasks.map(t => `task-${t._local_id || t.id}`);
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1">
      {/* Column Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${column.lightBg} dark:bg-dark-800`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${column.color}`} />
          <h3 className={`text-sm font-semibold ${column.textColor} dark:text-gray-200`}>{column.title}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.lightBg} dark:bg-dark-700 ${column.textColor} dark:text-gray-300`}>
          {tasks.length}
        </span>
      </div>

      {/* Card List — this is the droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 rounded-b-xl min-h-[200px] border border-t-0 transition-colors
          ${isOver ? `${column.lightBg} dark:bg-dark-800/50 ${column.borderColor} dark:border-dark-600 ring-2 ring-inset ring-opacity-30` : 'bg-gray-50/50 dark:bg-dark-900/50 border-gray-200 dark:border-dark-700'}`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className={`flex items-center justify-center h-24 text-xs rounded-lg border-2 border-dashed transition-colors
              ${isOver ? `${column.borderColor} dark:border-dark-500 ${column.textColor} dark:text-gray-300` : 'border-gray-200 dark:border-dark-600 text-gray-400 dark:text-gray-500'}`}>
              {isOver ? 'Drop here' : 'No tasks'}
            </div>
          ) : (
            tasks.map(task => (
              <SortableCard
                key={task._local_id || task.id}
                task={task}
                onView={onView}
                onBookmark={onBookmark}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onPriorityChange={onPriorityChange}
                onAssign={onAssign}
                onLink={onLink}
                lastComment={lastComments[Number(task.id)]}
                apiUrl={apiUrl}
                softwareId={softwareId}
                onImageClick={onImageClick}
                onGalleryOpen={onGalleryOpen}
                fontSize={fontSize}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
};

/* ── KanbanBoard ───────────────────────────────────────── */
interface KanbanBoardProps {
  tasks: Task[];
  onView: (task: Task) => void;
  onBookmark: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: string) => void;
  onReorder?: (reorderedTasks: { id: number; kanban_order: number }[]) => void;
  onPriorityChange?: (task: Task, priority: string) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onAssign?: (task: Task) => void;
  onLink?: (task: Task) => void;
  lastComments: Record<number, { text: string; author: string; date: string | null }>;
  apiUrl?: string;
  softwareId?: number;
  onImageClick?: (url: string) => void;
  onGalleryOpen?: (images: { url: string; name?: string }[], index: number) => void;
  fontSize?: 'sm' | 'md' | 'lg';
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onView,
  onBookmark,
  onStatusChange,
  onReorder,
  onPriorityChange,
  onEdit,
  onDelete,
  onAssign,
  onLink,
  lastComments,
  apiUrl,
  softwareId,
  onImageClick,
  onGalleryOpen,
  fontSize,
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnTasks = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    for (const col of KANBAN_COLUMNS) {
      grouped[col.id] = [];
    }
    for (const task of tasks) {
      const status = task.status === 'progress' ? 'in-progress' : task.status;
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped['new'].push(task);
      }
    }
    for (const col of KANBAN_COLUMNS) {
      grouped[col.id].sort((a, b) => (a.kanban_order || 0) - (b.kanban_order || 0));
    }
    return grouped;
  }, [tasks]);

  const findTaskById = useCallback((id: string): Task | undefined => {
    const taskId = id.replace('task-', '');
    return tasks.find(t => String(t._local_id) === taskId || String(t.id) === taskId);
  }, [tasks]);

  /** Given any droppable/sortable id, resolve which column it belongs to */
  const resolveColumn = useCallback((id: string): string | null => {
    // Direct column id?
    if (KANBAN_COLUMNS.some(c => c.id === id)) return id;
    // It's a task id — find which column contains it
    for (const [colId, colTasks] of Object.entries(columnTasks)) {
      if (colTasks.some(t => `task-${t._local_id || t.id}` === id)) return colId;
    }
    return null;
  }, [columnTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = findTaskById(String(event.active.id));
    setActiveTask(task || null);
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id ? String(event.over.id) : null;
    setOverColumnId(overId ? resolveColumn(overId) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const targetColumn = resolveColumn(overId);
    if (!targetColumn) return;

    const task = findTaskById(activeId);
    if (!task) return;

    const currentStatus = task.status === 'progress' ? 'in-progress' : task.status;
    if (currentStatus !== targetColumn) {
      // Cross-column: change status
      onStatusChange(task, targetColumn);
    } else if (onReorder) {
      // Same-column: reorder
      const colTasks = [...(columnTasks[targetColumn] || [])];
      const oldIndex = colTasks.findIndex(t => `task-${t._local_id || t.id}` === activeId);
      const overTask = findTaskById(overId);
      const newIndex = overTask
        ? colTasks.findIndex(t => t.id === overTask.id || t._local_id === overTask._local_id)
        : colTasks.length - 1;

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        const updates = reordered.map((t, i) => ({
          id: t._local_id || Number(t.id),
          kanban_order: i,
        }));
        onReorder(updates);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setOverColumnId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
        {KANBAN_COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={columnTasks[column.id] || []}
            onView={onView}
            onBookmark={onBookmark}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onAssign={onAssign}
            onLink={onLink}
            lastComments={lastComments}
            isOver={overColumnId === column.id}
            apiUrl={apiUrl}
            softwareId={softwareId}
            onImageClick={onImageClick}
            onGalleryOpen={onGalleryOpen}
            fontSize={fontSize}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rotate-3 scale-105">
            <TaskCard
              task={activeTask}
              variant="kanban"
              fontSize={fontSize}
              onView={() => {}}
              onBookmark={() => {}}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
