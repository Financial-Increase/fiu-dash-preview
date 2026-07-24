import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronDown, ChevronRight, GripVertical, Link2, MessageSquare, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_DESCRIPTIONS, TASK_STATUSES, TaskRow, TaskStatus, TeamMemberLite, initials } from "./types";
import TagsPopover from "./TagsPopover";
import TaskMemberPickerContent from "./TaskMemberPickerContent";

interface TaskListViewProps {
  tasks: TaskRow[];
  isLoading: boolean;
  teamMembers: TeamMemberLite[];
  allTags: string[];
  onOpen: (task: TaskRow) => void;
  onQuickDone: (task: TaskRow) => void;
}

// handle | checkbox | title | status | tag | due | assignee | collab | owner
const GRID_COLS = "grid-cols-[24px_28px_minmax(0,1fr)_130px_100px_110px_130px_90px_110px]";

function reinsertPosition(sorted: TaskRow[], movingId: string, destIndex: number): number {
  const filtered = sorted.filter((t) => t.id !== movingId);
  const before = filtered[destIndex - 1];
  const after = filtered[destIndex];
  if (!before && !after) return 0;
  if (!before) return after.position - 1;
  if (!after) return before.position + 1;
  return (before.position + after.position) / 2;
}

export default function TaskListView({ tasks, isLoading, teamMembers, allTags, onOpen, onQuickDone }: TaskListViewProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());
  const [optimisticTasks, setOptimisticTasks] = useState<TaskRow[] | null>(null);
  const [openPicker, setOpenPicker] = useState<{ taskId: string; type: "assignee" | "collaborators" } | null>(null);

  const toggleGroup = (status: TaskStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const updateField = useMutation({
    mutationFn: async ({
      taskId,
      fields,
    }: {
      taskId: string;
      fields: { tags?: string[]; due_date?: string | null; assignee_id?: string | null; status?: string; position?: number };
    }) => {
      const payload = fields.status
        ? { ...fields, completed_at: fields.status === "Done" ? new Date().toISOString() : null }
        : fields;
      const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
      if (error) throw error;
    },
    // Optimistically patch the cache so drag reorders/status changes render
    // immediately instead of snapping back to the stale order until the
    // round trip + refetch completes.
    onMutate: async ({ taskId, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<TaskRow[]>(["tasks"]);
      queryClient.setQueryData<TaskRow[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, ...fields } : t)) ?? old
      );
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous);
      if (_vars.fields.position !== undefined) setOptimisticTasks(null);
      toast.error(err.message);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (variables.fields.position !== undefined) setOptimisticTasks(null);
    },
  });

  const updateCollaborators = useMutation({
    mutationFn: async ({ task, nextIds }: { task: TaskRow; nextIds: string[] }) => {
      const existingIds = task.collaborators.map((c) => c.team_member?.id).filter((id): id is string => !!id);
      const toAdd = nextIds.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id) => !nextIds.includes(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("task_collaborators")
          .insert(toAdd.map((team_member_id) => ({ task_id: task.id, team_member_id })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("task_collaborators")
          .delete()
          .eq("task_id", task.id)
          .in("team_member_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const grouped = new Map<TaskStatus, TaskRow[]>();
  for (const s of TASK_STATUSES) grouped.set(s, []);
  const displayedTasks = optimisticTasks ?? tasks;
  for (const t of displayedTasks) grouped.get(t.status)?.push(t);
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

    // Keep the dropped order rendered until the server update and refetch both
    // finish. Without this local snapshot, the DnD teardown can briefly render
    // the stale props and make the row jump back before moving into place.
    setOptimisticTasks(
      displayedTasks.map((task) =>
        task.id === draggableId
          ? { ...task, ...fields, status: (fields.status ?? task.status) as TaskStatus }
          : task
      )
    );
    updateField.mutate({ taskId: draggableId, fields });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-steel">Loading…</div>
    );
  }
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-steel">
        No tasks match your filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className={cn("grid items-center bg-muted/30 border-b border-border", GRID_COLS)}>
        <div className="h-8" />
        <div className="h-8" />
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Title</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Status</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Tag</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Due</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Assignee</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Collab</div>
        <div className="h-8 flex items-center text-[10px] uppercase tracking-wider text-steel">Owner</div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        {TASK_STATUSES.map((status) => {
          const groupTasks = grouped.get(status) ?? [];
          const isCollapsed = collapsed.has(status);
          return (
            <div key={status} className="border-b border-border last:border-b-0">
              <button
                onClick={() => toggleGroup(status)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-card/40 hover:bg-card/60 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-steel flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-steel flex-shrink-0" />
                )}
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border", STATUS_COLORS[status])}>
                      {status}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-xs text-left text-xs leading-relaxed">
                    {STATUS_DESCRIPTIONS[status]}
                  </TooltipContent>
                </Tooltip>
                <span className="text-[11px] text-steel">{groupTasks.length}</span>
              </button>

              {!isCollapsed && (
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(snapshot.isDraggingOver && "bg-gold/5")}
                    >
                      {groupTasks.length === 0 && (
                        <div className="px-3 py-3 text-xs text-steel/60">No tasks</div>
                      )}
                      {groupTasks.map((task, index) => {
                        const isOverdue = task.due_date && task.status !== "Done" && new Date(task.due_date) < new Date(new Date().toDateString());
                        const collaboratorIds = task.collaborators.map((c) => c.team_member?.id).filter((id): id is string => !!id);
                        return (
                          <Draggable draggableId={task.id} index={index} key={task.id}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                onClick={(event) => {
                                  const target = event.target as HTMLElement;
                                  if (target.closest("button, input, [role='combobox'], [data-radix-popper-content-wrapper]")) return;
                                  onOpen(task);
                                }}
                                className={cn(
                                  "grid cursor-pointer items-center border-t border-border/50 hover:bg-muted/20",
                                  GRID_COLS,
                                  dragSnapshot.isDragging && "bg-card shadow-lg ring-1 ring-gold/40"
                                )}
                              >
                                <div {...dragProvided.dragHandleProps} className="h-full flex items-center justify-center text-steel/40 hover:text-steel cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                                <div className="py-1.5 flex items-center">
                                  <button
                                    title={task.status === "Done" ? "Done" : "Mark as done"}
                                    onClick={() => onQuickDone(task)}
                                    className={cn(
                                      "w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150 ease-out active:scale-90",
                                      task.status === "Done"
                                        ? "bg-emerald border-emerald"
                                        : "border-steel/40 bg-transparent hover:border-gold hover:bg-gold/10"
                                    )}
                                  >
                                    <Check
                                      className={cn(
                                        "w-3 h-3 text-parchment transition-all duration-150 ease-out",
                                        task.status === "Done" ? "scale-100 opacity-100" : "scale-50 opacity-0"
                                      )}
                                      strokeWidth={3}
                                    />
                                  </button>
                                </div>
                                <div className="text-sm font-medium text-foreground min-w-0 self-stretch">
                                  <button
                                    onClick={() => onOpen(task)}
                                    className="w-full h-full flex items-center gap-2 text-left py-1.5 pr-3 hover:underline decoration-steel/40 underline-offset-2 min-w-0"
                                  >
                                    <span className={cn("truncate", task.status === "Done" && "line-through text-steel")}>{task.title}</span>
                                    {task.comments.length > 0 && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-steel flex-shrink-0">
                                        <MessageSquare className="w-3 h-3" /> {task.comments.length}
                                      </span>
                                    )}
                                    {task.link_url && (
                                      <span title={task.link_url} className="inline-flex items-center text-steel flex-shrink-0">
                                        <Link2 className="w-3 h-3" />
                                      </span>
                                    )}
                                  </button>
                                </div>
                                <div className="py-1.5 pr-2">
                                  <Select
                                    value={task.status}
                                    onValueChange={(v) => updateField.mutate({ taskId: task.id, fields: { status: v, position: task.position } })}
                                  >
                                    <SelectTrigger className={cn("h-6 w-auto gap-1 text-[10px] font-medium border rounded-sm px-2", STATUS_COLORS[task.status])}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TASK_STATUSES.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="py-1.5 pr-2">
                                  <TagsPopover
                                    tags={task.tags}
                                    allTags={allTags}
                                    onChange={(next) => updateField.mutate({ taskId: task.id, fields: { tags: next } })}
                                    triggerClassName="text-xs text-steel rounded px-1 -mx-1 py-0.5 hover:bg-muted/40"
                                    placeholder="—"
                                  />
                                </div>
                                <div className="py-1.5 pr-2">
                                  <input
                                    type="date"
                                    defaultValue={task.due_date ?? ""}
                                    onBlur={(e) => {
                                      if (e.target.value !== (task.due_date ?? "")) updateField.mutate({ taskId: task.id, fields: { due_date: e.target.value || null } });
                                    }}
                                    className={cn(
                                      "w-full bg-transparent text-xs focus:outline-none rounded px-1 -mx-1 py-0.5 hover:bg-muted/40 focus:bg-muted/40",
                                      isOverdue ? "text-destructive font-medium" : "text-steel"
                                    )}
                                  />
                                </div>
                                <div className="py-1.5 pr-2">
                                  <Popover
                                    open={openPicker?.taskId === task.id && openPicker.type === "assignee"}
                                    onOpenChange={(open) => setOpenPicker(open ? { taskId: task.id, type: "assignee" } : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <button type="button" className="flex min-w-0 items-center gap-1 text-xs text-steel transition-colors hover:text-gold">
                                        <span className="truncate">{task.assignee?.name ?? "Unassigned"}</span>
                                        <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                                      <TaskMemberPickerContent
                                        title="Assignee"
                                        description="Choose who is responsible for this task"
                                        members={teamMembers}
                                        selectedIds={task.assignee_id ? [task.assignee_id] : []}
                                        disabled={updateField.isPending}
                                        onChange={(ids) => {
                                          updateField.mutate({ taskId: task.id, fields: { assignee_id: ids[0] ?? null } });
                                          setOpenPicker(null);
                                        }}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="py-1.5 pr-2">
                                  <Popover
                                    open={openPicker?.taskId === task.id && openPicker.type === "collaborators"}
                                    onOpenChange={(open) => setOpenPicker(open ? { taskId: task.id, type: "collaborators" } : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-1 text-steel hover:text-gold transition-colors">
                                        {collaboratorIds.length > 0 ? (
                                          <div className="flex -space-x-1.5">
                                            {task.collaborators.slice(0, 3).map((c, i) => (
                                              <div
                                                key={c.team_member?.id ?? i}
                                                className="w-5 h-5 rounded-full bg-emerald/50 border border-card flex items-center justify-center text-[9px] font-bold text-gold"
                                                title={c.team_member?.name}
                                              >
                                                {initials(c.team_member?.name)}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <Users className="w-3.5 h-3.5" />
                                        )}
                                        <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                                      <TaskMemberPickerContent
                                        title="Collaborators"
                                        description="Everyone selected receives comment emails"
                                        members={teamMembers}
                                        selectedIds={collaboratorIds}
                                        multiple
                                        disabled={updateCollaborators.isPending}
                                        onChange={(ids) => updateCollaborators.mutate({ task, nextIds: ids })}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="py-1.5 pr-3 text-xs text-steel truncate">{task.owner?.name ?? "—"}</div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
}
