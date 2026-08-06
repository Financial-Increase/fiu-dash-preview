import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  formatTaskAttachmentSize,
  uploadTaskAttachments,
} from "./taskAttachmentUtils";

const ATTACHMENTS_BUCKET = "task-attachments";

interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string | null;
  file_name: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
  created_at: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  currentMemberId: string | null;
  canManage: boolean;
}

export default function TaskAttachments({
  taskId,
  currentMemberId,
  canManage,
}: TaskAttachmentsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useQuery<TaskAttachment[]>({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!currentMemberId) throw new Error("No team member profile linked to your login");
      await uploadTaskAttachments(taskId, currentMemberId, files);
    },
    onSuccess: (_data, files) => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success(`${files.length} ${files.length === 1 ? "attachment" : "attachments"} added`);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const remove = useMutation({
    mutationFn: async (attachment: TaskAttachment) => {
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove([attachment.storage_path]);
      if (storageError) throw storageError;

      const { error: metadataError } = await supabase
        .from("task_attachments")
        .delete()
        .eq("id", attachment.id);
      if (metadataError) throw metadataError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Attachment removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const download = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const { data, error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .download(attachment.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.file_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download attachment");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="space-y-2 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-steel" />
          <h3 className="text-sm font-medium">Attachments</h3>
          {attachments.length > 0 ? (
            <span className="text-xs text-steel">{attachments.length}</span>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) upload.mutate(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={!currentMemberId || upload.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {upload.isPending ? "Uploading…" : "Add files"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-steel">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-steel">No attachments yet. Files can be up to 10 MB each.</p>
      ) : (
        <div className="divide-y divide-border/50 rounded-md border border-border/60">
          {attachments.map((attachment) => {
            const canDelete = canManage || attachment.uploaded_by === currentMemberId;
            return (
              <div key={attachment.id} className="flex items-center gap-2 px-3 py-2">
                <Paperclip className="h-3.5 w-3.5 flex-shrink-0 text-steel" />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:text-gold"
                  onClick={() => void download(attachment)}
                  title={`Download ${attachment.file_name}`}
                >
                  {attachment.file_name}
                </button>
                <span className="flex-shrink-0 text-[11px] text-steel">
                  {formatTaskAttachmentSize(attachment.size_bytes)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={downloadingId === attachment.id}
                  onClick={() => void download(attachment)}
                  title="Download attachment"
                >
                  {downloadingId === attachment.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                </Button>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(`Remove "${attachment.file_name}"?`)) remove.mutate(attachment);
                    }}
                    title="Remove attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
