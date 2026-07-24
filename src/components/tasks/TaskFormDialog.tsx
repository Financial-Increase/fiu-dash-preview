import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown, User, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, TASK_STATUSES, TaskRow, TeamMemberLite, normalizeUrl } from "./types";
import SelectionLinkToolbar from "./SelectionLinkToolbar";
import TagsPopover from "./TagsPopover";
import TaskMemberPickerContent from "./TaskMemberPickerContent";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRow | null;
  teamMembers: TeamMemberLite[];
  allTags: string[];
  currentMemberId: string | null;
}

export default function TaskFormDialog({
  open,
  onOpenChange,
  task,
  teamMembers,
  allTags,
  currentMemberId,
}: TaskFormDialogProps) {
  const isEdit = !!task;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("Backlog");
  const [tags, setTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [collabOpen, setCollabOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setTags(task.tags ?? []);
      setDueDate(task.due_date ?? "");
      setLinkUrl(task.link_url ?? "");
      setAssigneeId(task.assignee_id ?? "unassigned");
      setCollaboratorIds(
        task.collaborators.map((c) => c.team_member?.id).filter((id): id is string => !!id)
      );
    } else {
      setTitle("");
      setDescription("");
      setStatus("Backlog");
      setTags([]);
      setDueDate("");
      setLinkUrl("");
      setAssigneeId("unassigned");
      setCollaboratorIds([]);
    }
  }, [open, task]);

  const save = useMutation({
    mutationFn: async () => {
      if (!currentMemberId) throw new Error("No team member profile linked to your login");
      if (!title.trim()) throw new Error("Title is required");

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        tags,
        due_date: dueDate || null,
        link_url: normalizeUrl(linkUrl),
        assignee_id: assigneeId === "unassigned" ? null : assigneeId,
        completed_at: status === "Done" ? new Date().toISOString() : null,
      };

      let taskId: string;
      if (isEdit && task) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
        taskId = task.id;
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...payload, owner_id: currentMemberId })
          .select("id")
          .single();
        if (error) throw error;
        taskId = data.id;
      }

      // Reconcile collaborators
      const existingIds = isEdit && task
        ? task.collaborators.map((c) => c.team_member?.id).filter((id): id is string => !!id)
        : [];
      const toAdd = collaboratorIds.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id) => !collaboratorIds.includes(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from("task_collaborators")
          .insert(toAdd.map((team_member_id) => ({ task_id: taskId, team_member_id })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("task_collaborators")
          .delete()
          .eq("task_id", taskId)
          .in("team_member_id", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(isEdit ? "Task updated" : "Task created");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const selectedAssignee = teamMembers.find((member) => member.id === assigneeId);
  const collaboratorNames = collaboratorIds
    .map((id) => teamMembers.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
          <div className="flex items-start justify-between gap-3 pr-6">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              className="text-lg font-semibold leading-snug h-auto px-2 py-1 -mx-2 border-transparent hover:border-border focus-visible:border-border bg-transparent"
            />
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={cn("h-7 w-auto gap-1.5 text-xs font-medium border rounded-sm px-2.5", STATUS_COLORS[status as keyof typeof STATUS_COLORS])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TagsPopover
            tags={tags}
            allTags={allTags}
            onChange={setTags}
            triggerClassName="h-7 rounded-sm border border-transparent hover:border-border px-2 text-xs"
          />

          <div className="inline-flex items-center gap-1 h-7 rounded-sm border border-transparent hover:border-border px-2">
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs text-steel">Due:</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-transparent text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="relative">
          <Textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description…"
            rows={3}
            className="text-sm text-foreground leading-relaxed resize-none border-transparent hover:border-border focus-visible:border-border bg-transparent px-2 -mx-2"
          />
          <SelectionLinkToolbar textareaRef={descriptionRef} value={description} onChange={setDescription} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-steel flex-shrink-0" />
            <span className="text-steel">Assignee:</span>
            <Popover modal open={assigneeOpen} onOpenChange={setAssigneeOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-gold">
                  <span>{selectedAssignee?.name ?? "Unassigned"}</span>
                  <ChevronDown className={cn("h-3 w-3 text-steel transition-transform", assigneeOpen && "rotate-180")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                <TaskMemberPickerContent
                  title="Assignee"
                  description="Choose who is responsible for this task"
                  members={teamMembers}
                  selectedIds={assigneeId === "unassigned" ? [] : [assigneeId]}
                  onChange={(ids) => {
                    setAssigneeId(ids[0] ?? "unassigned");
                    setAssigneeOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <Users className="w-3.5 h-3.5 text-steel flex-shrink-0" />
            <span className="text-steel">Collaborators:</span>
            <Popover modal open={collabOpen} onOpenChange={setCollabOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-foreground font-medium hover:text-gold transition-colors"
                >
                  <span className="truncate">
                    {collaboratorNames.length > 0 ? collaboratorNames.join(", ") : "None"}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 flex-shrink-0 text-steel transition-transform", collabOpen && "rotate-180")} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                <TaskMemberPickerContent
                  title="Collaborators"
                  description="Everyone selected receives comment emails"
                  members={teamMembers}
                  selectedIds={collaboratorIds}
                  multiple
                  onChange={setCollaboratorIds}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!title.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
