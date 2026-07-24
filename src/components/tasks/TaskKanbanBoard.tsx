import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { CalendarDays, Link2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, TASK_STATUSES, TaskRow, TaskStatus, initials } from "./types";

interface TaskKanbanBoardProps {
  tasks: TaskRow[];
  onOpen: (task: TaskRow) => void;
  onMove: (taskId: string, fields: { status?: string; position: number }) => void;
}

// Fractional positioning: slot the moved card between its new neighbors so only
// the moved row needs to change, not the whole column.
function reinsertPosition(sorted: TaskRow[], movingId: string, destIndex: number): number {
  const filtered = sorted.filter((t) => t.id !== movingId);
  const before = filtered[destIndex - 1];
  const after = filtered[destIndex];
  if (!before && !after) return 0;
  if (!before) return after.position - 1;
  if (!after) return before.position + 1;
  return (before.position + after.position) / 2;
}

export default function TaskKanbanBoard({ tasks, onOpen, onMove }: TaskKanbanBoardProps) {
  const grouped = new Map<TaskStatus, TaskRow[]>();
  for (const s of TASK_STATUSES) grouped.set(s, []);
  for (const t of tasks) grouped.get(t.status)?.push(t);
  for (const s of TASK_STATUSES) {
    grouped.get(s)!.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destStatus = destination.droppableId as TaskStatus;
    const sourceStatus = source.droppableId as TaskStatus;
    const destList = grouped.get(destStatus) ?? [];
    const newPosition = reinsertPosition(destList, draggableId, destination.index);

    const fields: { status?: string; position: number } = { position: newPosition };
    if (destStatus !== sourceStatus) fields.status = destStatus;
    onMove(draggableId, fields);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => {
          const columnTasks = grouped.get(status) ?? [];
          return (
            <Droppable droppableId={status} key={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "w-64 flex-shrink-0 rounded-md border border-border bg-card/50 flex flex-col max-h-[calc(100vh-220px)]",
                    snapshot.isDraggingOver && "ring-1 ring-gold/40"
                  )}
                >
                  <div className="p-3 border-b border-border/60 flex items-center justify-between">
                    <span className={cn("text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border", STATUS_COLORS[status])}>
                      {status}
                    </span>
                    <span className="text-[11px] text-steel">{columnTasks.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnTasks.map((task, index) => {
                      const isOverdue = task.due_date && task.status !== "Done" && new Date(task.due_date) < new Date(new Date().toDateString());
                      return (
                        <Draggable draggableId={task.id} index={index} key={task.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => onOpen(task)}
                              className={cn(
                                "rounded-lg border border-border bg-card p-2.5 cursor-pointer hover:border-gold/40 transition-colors",
                                dragSnapshot.isDragging && "shadow-lg ring-1 ring-gold/50"
                              )}
                            >
                              <p className={cn("text-sm font-medium text-foreground leading-snug", task.status === "Done" && "line-through text-steel")}>
                                {task.title}
                              </p>
                              {task.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {task.tags.map((tag) => (
                                    <span key={tag} className="inline-block text-[10px] text-steel bg-muted/60 rounded-sm px-2 py-0.5">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-[10px] text-steel">
                                  {task.due_date && (
                                    <span className={cn("inline-flex items-center gap-1", isOverdue && "text-destructive font-medium")}>
                                      <CalendarDays className="w-3 h-3" />
                                      {format(new Date(task.due_date), "MMM d")}
                                    </span>
                                  )}
                                  {task.comments.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> {task.comments.length}
                                    </span>
                                  )}
                                  {task.link_url && (
                                    <a
                                      href={task.link_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={task.link_url}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 hover:text-gold transition-colors"
                                    >
                                      <Link2 className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                {task.assignee && (
                                  <div
                                    title={task.assignee.name}
                                    className="w-5 h-5 rounded-full bg-emerald/50 flex items-center justify-center text-[9px] font-bold text-gold flex-shrink-0"
                                  >
                                    {initials(task.assignee.name)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {columnTasks.length === 0 && (
                      <p className="text-[11px] text-steel/60 text-center py-6">No tasks</p>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
