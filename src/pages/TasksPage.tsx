import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, LayoutGrid, ListTodo, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import TaskDetailDialog from "@/components/tasks/TaskDetailDialog";
import TaskListView from "@/components/tasks/TaskListView";
import TaskKanbanBoard from "@/components/tasks/TaskKanbanBoard";
import { TASKS_SELECT, TaskRow, TeamMemberLite } from "@/components/tasks/types";
import { cn } from "@/lib/utils";

type TaskScope = "me" | "all" | `member:${string}`;

export default function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "kanban">("list");
  const [search, setSearch] = useState("");
  const [taskScope, setTaskScope] = useState<TaskScope | null>(null);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);

  const { data: teamMembers = [], refetch: refetchTeamMembers } = useQuery<TeamMemberLite[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("name");
      if (error) throw error;
      return data as TeamMemberLite[];
    },
  });

  const currentMember = useMemo(
    () => teamMembers.find((m) => m.auth_user_id === user?.id) ?? null,
    [teamMembers, user?.id]
  );
  const isAdmin = currentMember?.role === "Admin";
  const effectiveTaskScope: TaskScope = taskScope ?? (isAdmin ? "all" : "me");

  const { data: tasks = [], isLoading, error: tasksError } = useQuery<TaskRow[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(TASKS_SELECT)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as TaskRow[];
    },
  });

  // Deep-link from comment notification emails: /tasks?task=<id>
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || isLoading || tasksError) return;
    const found = tasks.find((t) => t.id === taskId);
    if (found) {
      setDetailTask(found);
    } else {
      toast.error("That task was not found or you no longer have access to it.");
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("task");
      return next;
    }, { replace: true });
  }, [tasks, isLoading, tasksError, searchParams, setSearchParams]);

  // Keep the open detail dialog's data fresh after mutations
  useEffect(() => {
    if (!detailTask) return;
    const fresh = tasks.find((t) => t.id === detailTask.id);
    if (fresh && fresh !== detailTask) setDetailTask(fresh);
  }, [tasks, detailTask]);

  const updateTask = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: { status?: string; position?: number } }) => {
      const payload = fields.status
        ? { ...fields, completed_at: fields.status === "Done" ? new Date().toISOString() : null }
        : fields;
      const { error } = await supabase.from("tasks").update(payload).eq("id", id);
      if (error) throw error;
    },
    // Optimistic patch so Kanban drag reorders render immediately instead of
    // snapping back to the stale order until the round trip completes.
    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previous = queryClient.getQueryData<TaskRow[]>(["tasks"]);
      queryClient.setQueryData<TaskRow[]>(["tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...fields } : t)) ?? old
      );
      return { previous };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["tasks"], context.previous);
      toast.error(err.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const tags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(),
    [tasks]
  );

  const participantMembers = useMemo(() => {
    const participantIds = new Set<string>();
    for (const task of tasks) {
      if (task.assignee_id) participantIds.add(task.assignee_id);
      for (const collaborator of task.collaborators) {
        if (collaborator.team_member?.id) participantIds.add(collaborator.team_member.id);
      }
    }

    return teamMembers
      .filter((member) => participantIds.has(member.id) && member.id !== currentMember?.id)
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [tasks, teamMembers, currentMember?.id]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      }
      const selectedMemberId = effectiveTaskScope === "me"
        ? currentMember?.id
        : effectiveTaskScope.startsWith("member:")
          ? effectiveTaskScope.slice("member:".length)
          : null;

      if (selectedMemberId) {
        const isAssociated =
          t.owner_id === selectedMemberId ||
          t.assignee_id === selectedMemberId ||
          t.collaborators.some((c) => c.team_member?.id === selectedMemberId);
        if (!isAssociated) return false;
      }
      if (tagFilters.length > 0 && !tagFilters.some((tag) => t.tags.includes(tag))) return false;
      return true;
    });
  }, [tasks, search, effectiveTaskScope, currentMember?.id, tagFilters]);

  const openCreate = () => {
    void refetchTeamMembers();
    setEditingTask(null);
    setFormOpen(true);
  };
  const openDetail = (task: TaskRow) => {
    void refetchTeamMembers();
    setDetailTask(task);
  };
  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="font-heading text-2xl tracking-wider text-gold uppercase">Tasks</h1>
          <p className="text-sm text-steel mt-1">
            {isAdmin ? "All tasks across the team" : "Tasks you own, are assigned to, or collaborate on"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-8 gap-1.5" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" />
          New Task
        </Button>

        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 text-steel absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <Select
          value={effectiveTaskScope}
          onValueChange={(value) => setTaskScope(value as TaskScope)}
          disabled={!isAdmin}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs bg-background disabled:cursor-not-allowed disabled:opacity-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">Me</SelectItem>
            {isAdmin && <SelectItem value="all">All</SelectItem>}
            {isAdmin && participantMembers.map((member) => (
              <SelectItem key={member.id} value={`member:${member.id}`}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-[150px] justify-between text-xs font-normal bg-background"
            >
              <span className="truncate">
                {tagFilters.length === 0
                  ? "All Tags"
                  : tagFilters.length === 1
                    ? tagFilters[0]
                    : `${tagFilters.length} tags`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-steel flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-card border-border max-h-64 overflow-y-auto" align="start">
            {tags.length === 0 ? (
              <p className="text-xs text-steel px-1 py-1">No tags yet</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setTagFilters([])}
                  className="w-full text-left text-xs text-gold hover:underline px-1 py-1 mb-1"
                >
                  Clear selection
                </button>
                {tags.map((tag) => {
                  const checked = tagFilters.includes(tag);
                  return (
                    <label key={tag} className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-accent/50 cursor-pointer text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setTagFilters((prev) => (checked ? prev.filter((t) => t !== tag) : [...prev, tag]))
                        }
                      />
                      <span className="text-foreground truncate">{tag}</span>
                    </label>
                  );
                })}
              </>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("list")}
            className={cn(
              "h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors",
              view === "list" ? "bg-sidebar-accent text-gold" : "text-steel hover:text-foreground"
            )}
          >
            <ListTodo className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "h-8 px-2.5 flex items-center gap-1.5 text-xs font-medium transition-colors border-l border-border",
              view === "kanban" ? "bg-sidebar-accent text-gold" : "text-steel hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Board
          </button>
        </div>
      </div>

      {tasksError ? (
        <div className="rounded-lg border border-destructive/40 p-8 text-center text-sm text-destructive">
          Unable to load tasks. Please refresh the page or contact an administrator.
        </div>
      ) : view === "list" ? (
        <TaskListView
          tasks={filteredTasks}
          isLoading={isLoading}
          teamMembers={teamMembers}
          allTags={tags}
          onOpen={openDetail}
          onQuickDone={(task) =>
            updateTask.mutate({ id: task.id, fields: { status: task.status === "Done" ? "To Do" : "Done" } })
          }
        />
      ) : (
        <TaskKanbanBoard
          tasks={filteredTasks}
          onOpen={openDetail}
          onMove={(id, fields) => updateTask.mutate({ id, fields })}
        />
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        teamMembers={teamMembers}
        allTags={tags}
        currentMemberId={currentMember?.id ?? null}
      />

      <TaskDetailDialog
        task={detailTask}
        open={!!detailTask}
        onOpenChange={(open) => !open && setDetailTask(null)}
        currentMember={currentMember}
        isAdmin={isAdmin}
        teamMembers={teamMembers}
        allTags={tags}
      />
    </div>
  );
}
