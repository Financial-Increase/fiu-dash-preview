import { supabase } from "@/integrations/supabase/client";
import { APP_URL } from "@/lib/config";
import { TaskRow, TeamMemberLite } from "./types";

const READY_FOR_REVIEW_COMMENT =
  "Marked this task Ready for Review. Please review the work and mark it Done if approved.";

export function assigneeNeedsOwnerReview(
  task: TaskRow,
  currentMemberId: string | null,
  isAdmin: boolean,
) {
  return (
    !isAdmin &&
    Boolean(currentMemberId) &&
    currentMemberId === task.assignee_id &&
    task.owner_id !== task.assignee_id
  );
}

export async function notifyTaskOwnerReadyForReview(
  task: TaskRow,
  submitterName: string,
) {
  if (!task.owner?.email) throw new Error("The task owner does not have an email address");

  const pageUrl = `${APP_URL}/tasks?task=${task.id}`;
  const { error } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "task-ready-review",
      recipientEmail: task.owner.email,
      idempotencyKey: `task-ready-review-${task.id}-${task.updated_at}`,
      templateData: {
        recipientName: task.owner.name,
        submitterName,
        taskTitle: task.title,
        taskDescription: task.description,
        pageUrl,
      },
    },
  });
  if (!error) return;

  // Compatibility fallback for environments where the new transactional
  // template has not been deployed yet. notify-mention already exists in
  // production and routes through the same suppression-aware email service.
  const { error: fallbackError } = await supabase.functions.invoke("notify-mention", {
    body: {
      recipientEmail: task.owner.email,
      recipientName: task.owner.name,
      authorName: submitterName,
      contactName: task.title,
      contextLabel: `on the task "${task.title}"`,
      noteText: READY_FOR_REVIEW_COMMENT,
      pageUrl,
    },
  });
  if (fallbackError) throw fallbackError;
}

export async function submitTaskForOwnerReview(
  task: TaskRow,
  submitter: TeamMemberLite,
  position?: number,
) {
  const { data: comment, error: commentError } = await supabase
    .from("task_comments")
    .insert({
      task_id: task.id,
      author_id: submitter.id,
      author_name: submitter.name,
      comment_text: READY_FOR_REVIEW_COMMENT,
    })
    .select("id, task_id, author_id, author_name, comment_text, created_at")
    .single();
  if (commentError) throw commentError;

  const { error: taskError } = await supabase
    .from("tasks")
    .update({
      status: "Waiting For",
      completed_at: null,
      ...(position === undefined ? {} : { position }),
    })
    .eq("id", task.id);
  if (taskError) {
    await supabase.from("task_comments").delete().eq("id", comment.id);
    throw taskError;
  }

  try {
    await notifyTaskOwnerReadyForReview(task, submitter.name);
    return { emailWarning: false, comment };
  } catch {
    return { emailWarning: true, comment };
  }
}
