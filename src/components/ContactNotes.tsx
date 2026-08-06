import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ContactNotesProps {
  contactId: string;
  contactName: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export default function ContactNotes({ contactId, contactName }: ContactNotesProps) {
  const [newNote, setNewNote] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [mentionedMembers, setMentionedMembers] = useState<TeamMember[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, email")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["contact-notes", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredMembers = mentionQuery !== null
    ? teamMembers.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  const addNote = useMutation({
    mutationFn: async ({ text, mentions }: { text: string; mentions: TeamMember[] }) => {
      const { error } = await supabase
        .from("contact_notes")
        .insert({ contact_id: contactId, note_text: text, created_by_name: "Admin" });
      if (error) throw error;

      // Send email notifications to mentioned team members
      if (mentions.length > 0) {
        for (const member of mentions) {
          try {
            await supabase.functions.invoke("notify-mention", {
              body: {
                recipientEmail: member.email,
                recipientName: member.name,
                contactName,
                noteText: text,
              },
            });
          } catch (err) {
            console.error("Failed to notify", member.name, err);
          }
        }
      }
    },
    onSuccess: (_, { mentions }) => {
      queryClient.invalidateQueries({ queryKey: ["contact-notes", contactId] });
      setNewNote("");
      setMentionedMembers([]);
      if (mentions.length > 0) {
        toast.success(`Notification sent to ${mentions.map(m => m.name).join(", ")}`);
      }
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-notes", contactId] });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart || 0;
    setNewNote(value);
    setCursorPos(pos);

    // Check if we're in a mention context
    const textBeforeCursor = value.slice(0, pos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: TeamMember) => {
    const textBeforeCursor = newNote.slice(0, cursorPos);
    const textAfterCursor = newNote.slice(cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    const before = newNote.slice(0, atIdx);
    const after = textAfterCursor;
    const mentionTag = `@${member.name}`;
    const updated = before + mentionTag + " " + after;
    setNewNote(updated);
    setMentionQuery(null);

    // Track mentioned member
    if (!mentionedMembers.find((m) => m.id === member.id)) {
      setMentionedMembers((prev) => [...prev, member]);
    }

    // Re-focus input
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = before.length + mentionTag.length + 1;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, filteredMembers.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    // Extract mentioned members from the final text
    const finalMentions = teamMembers.filter((m) =>
      newNote.includes(`@${m.name}`)
    );
    addNote.mutate({ text: newNote.trim(), mentions: finalMentions });
  };

  // Render note text with highlighted mentions
  const renderNoteText = (text: string) => {
    const parts = text.split(/(@\w[\w\s]*?)(?=\s|$)/g);
    return parts.map((part, i) => {
      const isMention = part.startsWith("@") && teamMembers.some(m => `@${m.name}` === part.trim());
      if (isMention) {
        return (
          <span key={i} className="text-gold font-medium">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-gold" />
        <span className="text-[10px] uppercase tracking-wider text-steel font-semibold">
          Notes — {contactName}
        </span>
        {notes.length > 0 && (
          <span className="text-[10px] text-steel">({notes.length})</span>
        )}
      </div>

      <div className="relative mb-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              placeholder="Add a note… Type @ to mention a team member"
              value={newNote}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full h-8 min-h-[32px] max-h-24 resize-none rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            {/* Mention dropdown */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute bottom-full left-0 mb-1 w-56 rounded-md border border-border bg-card shadow-lg z-50 py-1 max-h-40 overflow-y-auto"
              >
                {filteredMembers.map((member, idx) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors ${
                      idx === mentionIndex ? "bg-accent/50" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(member);
                    }}
                  >
                    <span className="text-foreground font-medium">{member.name}</span>
                    <span className="text-steel ml-2 text-[10px]">{member.email}</span>
                  </button>
                ))}
              </div>
            )}

            {mentionQuery !== null && filteredMembers.length === 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border border-border bg-card shadow-lg z-50 p-2">
                <p className="text-[10px] text-steel">No team members found</p>
              </div>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 gap-1"
            disabled={!newNote.trim() || addNote.isPending}
            onClick={handleSubmit}
          >
            <Send className="w-3 h-3" />
            Add
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-[11px] text-steel">Loading notes…</p>}

      {notes.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 text-xs py-1.5 px-2 rounded bg-card/50 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-foreground">{renderNoteText(note.note_text)}</p>
                <p className="text-[10px] text-steel mt-0.5">
                  {note.created_by_name} · {format(new Date(note.created_at), "MM/dd/yy h:mm a")}
                </p>
              </div>
              <button
                onClick={() => deleteNote.mutate(note.id)}
                className="text-steel hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
