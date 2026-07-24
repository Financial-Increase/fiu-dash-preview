import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { format } from "date-fns";
import { CalendarDays, Check, ChevronDown, Link2, Send, Share2, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/config";
import { STATUS_COLORS, TASK_STATUSES, TaskComment, TaskRow, TeamMemberLite, initials } from "./types";
import { renderWithLinks } from "./linkify";
import SelectionLinkToolbar from "./SelectionLinkToolbar";
import TagsPopover from "./TagsPopover";
import TaskMemberPickerContent from "./TaskMemberPickerContent";

interface TaskDetailDialogProps {
  task: TaskRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMember: TeamMemberLite | null;
  isAdmin: boolean;
  teamMembers: TeamMemberLite[];
  allTags: string[];
}

export default function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  currentMember,
  isAdmin,
  teamMembers,
  allTags,
}: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const [lastSavedDescription, setLastSavedDescription] = useState("");
  const [draftAssigneeId, setDraftAssigneeId] = useState<string | null>(null);
  const [savedAssigneeId, setSavedAssigneeId] = useState<string | null>(null);
  const [draftCollaboratorIds, setDraftCollaboratorIds] = useState<string[]>([]);
  const [savedCollaboratorIds, setSavedCollaboratorIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [collabOpen, setCollabOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setLastSavedTitle(task.title);
    setLastSavedDescription(task.description ?? "");
    setDueDate(task.due_date ?? "");
    const collaboratorIds = task.collaborators
      .map((collaborator) => collaborator.team_member?.id)
      .filter((id): id is string => Boolean(id))
      .toSorted();
    setDraftAssigneeId(task.assignee_id);
    setSavedAssigneeId(task.assignee_id);
    setDraftCollaboratorIds(collaboratorIds);
    setSavedCollaboratorIds(collaboratorIds);
  }, [open, task?.id]);

  const { data: comments = [], isLoading: commentsLoading } = useQuery<TaskComment[]>({
    queryKey: ["task-comments", task?.id],
    enabled: !!task && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TaskComment[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({ status, completed_at: status === "Done" ? new Date().toISOString() : null })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Status updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateField = useMutation({
    mutationFn: async (fields: {
      title?: string;
      description?: string | null;
      tags?: string[];
      due_date?: string | null;
      assignee_id?: string | null;
    }) => {
      if (!task) return;
      const { error } = await supabase.from("tasks").update(fields).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveTaskDraft = useMutation({
    mutationFn: async ({
      nextTitle,
      nextDescription,
      nextAssigneeId,
      nextCollaboratorIds,
    }: {
      nextTitle: string;
      nextDescription: string;
      nextAssigneeId: string | null;
      nextCollaboratorIds: string[];
    }) => {
      if (!task) return;
      let emailWarning: string | null = null;
      const { error: taskError } = await supabase
        .from("tasks")
        .update({
          title: nextTitle,
          description: nextDescription || null,
          assignee_id: nextAssigneeId,
        })
        .eq("id", task.id);
      if (taskError) throw taskError;

      const toAdd = nextCollaboratorIds.filter((id) => !savedCollaboratorIds.includes(id));
      const toRemove = savedCollaboratorIds.filter((id) => !nextCollaboratorIds.includes(id));

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

      if (nextAssigneeId && nextAssigneeId !== savedAssigneeId) {
        const assignee = teamMembers.find((member) => member.id === nextAssigneeId);
        if (assignee) {
          const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "task-assignment",
              recipientEmail: assignee.email,
              idempotencyKey: `task-assignment-${task.id}-${nextAssigneeId}-${task.updated_at}`,
              templateData: {
                recipientName: assignee.name,
                assignerName: currentMember?.name ?? "A team member",
                taskTitle: nextTitle,
                taskDescription: nextDescription,
                dueDate: task.due_date,
                status: task.status,
                pageUrl: `${APP_URL}/tasks?task=${task.id}`,
              },
            },
          });
          if (emailError) emailWarning = emailError.message;
        }
      }
      return { emailWarning };
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!task || !currentMember) throw new Error("No team member profile linked to your login");
      const text = commentText.trim();
      if (!text) return;

      const { error } = await supabase.from("task_comments").insert({
        task_id: task.id,
        author_id: currentMember.id,
        author_name: currentMember.name,
        comment_text: text,
      });
      if (error) throw error;

      // Notify owner, assignee, and collaborators (minus the comment author)
      const recipientsMap = new Map<string, TeamMemberLite>();
      if (task.owner) recipientsMap.set(task.owner.id, task.owner);
      if (task.assignee) recipientsMap.set(task.assignee.id, task.assignee);
      for (const c of task.collaborators) {
        if (c.team_member) recipientsMap.set(c.team_member.id, c.team_member);
      }
      recipientsMap.delete(currentMember.id);

      const pageUrl = `${APP_URL}/tasks?task=${task.id}`;
      await Promise.allSettled(
        Array.from(recipientsMap.values()).map((member) =>
          supabase.functions.invoke("notify-mention", {
            body: {
              recipientEmail: member.email,
              recipientName: member.name,
              authorName: currentMember.name,
              contactName: task.title,
              contextLabel: `on the task "${task.title}"`,
              noteText: text,
              pageUrl,
            },
          })
        )
      );

      return recipientsMap.size;
    },
    onSuccess: (notifiedCount) => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", task?.id] });
      setCommentText("");
      if (notifiedCount) {
        toast.success(`Comment added — ${notifiedCount} ${notifiedCount === 1 ? "person" : "people"} notified`);
      } else {
        toast.success("Comment added");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", task?.id] });
    },
  });

  if (!task) return null;

  const collaboratorDraftKey = draftCollaboratorIds.toSorted().join(",");
  const collaboratorSavedKey = savedCollaboratorIds.toSorted().join(",");
  const isDirty =
    title.trim() !== lastSavedTitle ||
    description.trim() !== lastSavedDescription ||
    draftAssigneeId !== savedAssigneeId ||
    collaboratorDraftKey !== collaboratorSavedKey;

  const handleSaveEdit = (closeAfterSave = false) => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      toast.error("Title can't be empty");
      return;
    }
    saveTaskDraft.mutate(
      {
        nextTitle: trimmedTitle,
        nextDescription: trimmedDescription,
        nextAssigneeId: draftAssigneeId,
        nextCollaboratorIds: draftCollaboratorIds,
      },
      {
        onSuccess: (result) => {
          setTitle(trimmedTitle);
          setDescription(trimmedDescription);
          setLastSavedTitle(trimmedTitle);
          setLastSavedDescription(trimmedDescription);
          setSavedAssigneeId(draftAssigneeId);
          setSavedCollaboratorIds(draftCollaboratorIds.toSorted());
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          if (result?.emailWarning) {
            toast.warning("Task saved, but the assignment email could not be sent.");
          } else {
            toast.success("Saved");
          }
          if (closeAfterSave) {
            setConfirmCloseOpen(false);
            onOpenChange(false);
          }
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setTitle(lastSavedTitle);
    setDescription(lastSavedDescription);
    setDraftAssigneeId(savedAssigneeId);
    setDraftCollaboratorIds(savedCollaboratorIds);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isDirty) {
      setConfirmCloseOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const handleDiscardAndClose = () => {
    handleCancelEdit();
    setConfirmCloseOpen(false);
    onOpenChange(false);
  };

  const canManage = isAdmin || currentMember?.id === task.owner_id || currentMember?.id === task.assignee_id;
  const canDelete = isAdmin || currentMember?.id === task.owner_id;
  const isOverdue = task.due_date && task.status !== "Done" && new Date(task.due_date) < new Date(new Date().toDateString());
  const collaboratorNames = draftCollaboratorIds
    .map((id) => teamMembers.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const draftAssignee = teamMembers.find((member) => member.id === draftAssigneeId);

  const copyLink = async () => {
    const url = `${APP_URL}/tasks?task=${task.id}`;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(url);
      toast.success("Task link copied");
    } catch {
      // Fallback for sandboxed preview iframes that block the async
      // Clipboard API — the legacy execCommand path still works there.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (copied) toast.success("Task link copied");
      else toast.error(`Couldn't copy automatically — link: ${url}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          <div className="flex items-start justify-between gap-3 pr-6">
            {canManage ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isDirty) handleSaveEdit();
                  }
                }}
                className="text-lg font-semibold leading-snug h-auto px-2 py-1 -mx-2 border-transparent hover:border-border focus-visible:border-border bg-transparent"
              />
            ) : (
              <p className="text-lg text-foreground font-semibold leading-snug px-2 py-1">{task.title}</p>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={task.status}
            onValueChange={(v) => updateStatus.mutate(v)}
            disabled={!canManage || updateStatus.isPending}
          >
            <SelectTrigger className={cn("h-7 w-auto gap-1.5 text-xs font-medium border rounded-sm px-2.5", STATUS_COLORS[task.status])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canManage ? (
            <TagsPopover
              tags={task.tags}
              allTags={allTags}
              onChange={(next) => updateField.mutate({ tags: next })}
              triggerClassName="h-7 rounded-sm border border-transparent hover:border-border px-2 text-xs"
            />
          ) : (
            task.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 h-7 rounded-sm border border-border px-2.5 text-xs text-steel">
                {t}
              </span>
            ))
          )}

          {canManage ? (
            <div className={cn("inline-flex items-center gap-1 h-7 rounded-sm border border-transparent hover:border-border px-2", isOverdue && "text-destructive")}>
              <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs text-steel">Due:</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() => {
                  if (dueDate !== (task.due_date ?? "")) updateField.mutate({ due_date: dueDate || null });
                }}
                className="bg-transparent text-xs focus:outline-none"
              />
            </div>
          ) : (
            task.due_date && (
              <span className={cn("inline-flex items-center gap-1 text-xs", isOverdue ? "text-destructive" : "text-steel")}>
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Due:</span>
                {format(new Date(task.due_date), "MMM d, yyyy")}
                {isOverdue ? " (overdue)" : ""}
              </span>
            )
          )}

          {task.link_url && (
            <a
              href={task.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
            >
              <Link2 className="w-3.5 h-3.5" />
              Link
            </a>
          )}

          <div className="flex-1" />

          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={copyLink} title="Copy task link">
            <Share2 className="w-3.5 h-3.5" />
          </Button>

          {canManage && task.status !== "Done" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() =>
                updateStatus.mutate("Done", {
                  onSuccess: () => onOpenChange(false),
                })
              }
            >
              <Check className="w-3.5 h-3.5" /> Mark as Done
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Delete this task? This cannot be undone.")) deleteTask.mutate();
              }}
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {canManage ? (
          <div className="relative">
            <Textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (isDirty) handleSaveEdit();
                }
              }}
              placeholder="Add a description…"
              rows={3}
              className="text-sm text-foreground leading-relaxed resize-none border-transparent hover:border-border focus-visible:border-border bg-transparent px-2 -mx-2"
            />
            <SelectionLinkToolbar textareaRef={descriptionRef} value={description} onChange={setDescription} />
          </div>
        ) : (
          task.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed px-2">
              {renderWithLinks(task.description)}
            </p>
          )
        )}

        {canManage && isDirty && (
          <div className="flex items-center justify-end gap-2 -mt-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit} disabled={saveTaskDraft.isPending}>
              Save
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-steel" />
            <span className="text-steel">Owner:</span>
            <span className="text-foreground font-medium">{task.owner?.name ?? "—"}</span>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-steel flex-shrink-0" />
            <span className="text-steel">Assignee:</span>
            {canManage ? (
              <Popover modal open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-sm px-1.5 py-1 font-medium text-foreground transition-colors hover:bg-muted/60 hover:text-gold">
                    <span>{draftAssignee?.name ?? "Unassigned"}</span>
                    <ChevronDown className={cn("h-3 w-3 text-steel transition-transform", assigneeOpen && "rotate-180")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                  <TaskMemberPickerContent
                    title="Assignee"
                    description="Choose who is responsible for this task"
                    members={teamMembers}
                    selectedIds={draftAssigneeId ? [draftAssigneeId] : []}
                    disabled={saveTaskDraft.isPending}
                    onChange={(ids) => {
                      setDraftAssigneeId(ids[0] ?? null);
                      setAssigneeOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <span className="text-foreground font-medium">{task.assignee?.name ?? "Unassigned"}</span>
            )}
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <Users className="w-3.5 h-3.5 text-steel flex-shrink-0" />
            <span className="text-steel">Collaborators:</span>
            {canManage ? (
              <Popover modal open={collabOpen} onOpenChange={setCollabOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-foreground font-medium hover:bg-muted/60 hover:text-gold transition-colors"
                  >
                    <span className="max-w-[260px] truncate">
                      {collaboratorNames.length > 0 ? collaboratorNames.join(", ") : "None"}
                    </span>
                    {draftCollaboratorIds.length > 1 && (
                      <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] leading-none text-gold">
                        {draftCollaboratorIds.length}
                      </span>
                    )}
                    <ChevronDown className={cn("w-3 h-3 text-steel flex-shrink-0 transition-transform", collabOpen && "rotate-180")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 overflow-hidden border-border bg-card p-0 shadow-lg" align="start">
                  <TaskMemberPickerContent
                    title="Collaborators"
                    description="Everyone selected receives comment emails"
                    members={teamMembers}
                    selectedIds={draftCollaboratorIds}
                    multiple
                    disabled={saveTaskDraft.isPending}
                    onChange={setDraftCollaboratorIds}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <span className="text-foreground font-medium">
                {task.collaborators.length > 0
                  ? task.collaborators.map((c) => c.team_member?.name).filter(Boolean).join(", ")
                  : "None"}
              </span>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-steel font-semibold mb-2">
            Comments {comments.length > 0 && `(${comments.length})`}
          </p>

          <div className="relative mb-3">
            <Textarea
              ref={commentRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment… everyone in the loop gets emailed"
              rows={2}
              className="bg-background resize-none text-sm pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (commentText.trim()) addComment.mutate();
                }
              }}
            />
            <SelectionLinkToolbar textareaRef={commentRef} value={commentText} onChange={setCommentText} />
            <Button
              size="sm"
              className="h-7 w-7 p-0 absolute bottom-2 right-2"
              disabled={!commentText.trim() || addComment.isPending}
              onClick={() => addComment.mutate()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

          {commentsLoading && <p className="text-xs text-steel">Loading…</p>}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2 text-sm py-2 px-2.5 rounded-lg bg-card/60 group">
                <div className="w-6 h-6 rounded-full bg-emerald/50 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0 mt-0.5">
                  {initials(c.author_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground whitespace-pre-wrap">{renderWithLinks(c.comment_text)}</p>
                  <p className="text-[10px] text-steel mt-0.5">
                    {c.author_name} · {format(new Date(c.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                {(isAdmin || c.author_id === currentMember?.id) && (
                  <button
                    onClick={() => deleteComment.mutate(c.id)}
                    className="text-steel hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {!commentsLoading && comments.length === 0 && (
              <p className="text-xs text-steel py-2">No comments yet.</p>
            )}
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this task. Save them before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="destructive" onClick={handleDiscardAndClose} disabled={saveTaskDraft.isPending}>
              Discard changes
            </Button>
            <AlertDialogCancel disabled={saveTaskDraft.isPending}>Keep editing</AlertDialogCancel>
            <Button onClick={() => handleSaveEdit(true)} disabled={saveTaskDraft.isPending}>
              {saveTaskDraft.isPending ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
