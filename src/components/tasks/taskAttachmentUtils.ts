import { supabase } from "@/integrations/supabase/client";

const ATTACHMENTS_BUCKET = "task-attachments";
export const MAX_TASK_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function safeFileName(name: string) {
  const sanitized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return sanitized.replace(/^-+|-+$/g, "") || "attachment";
}

export function formatTaskAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadTaskAttachments(
  taskId: string,
  currentMemberId: string,
  files: File[],
) {
  const oversized = files.find((file) => file.size > MAX_TASK_ATTACHMENT_SIZE);
  if (oversized) throw new Error(`${oversized.name} is larger than the 10 MB limit`);

  for (const file of files) {
    const storagePath = `${taskId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (storageError) throw storageError;

    const { error: metadataError } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      uploaded_by: currentMemberId,
      file_name: file.name,
      storage_path: storagePath,
      content_type: file.type || null,
      size_bytes: file.size,
    });
    if (metadataError) {
      await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
      throw metadataError;
    }
  }
}
