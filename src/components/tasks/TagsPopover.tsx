import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagsPopoverProps {
  tags: string[];
  allTags: string[];
  onChange: (next: string[]) => void;
  triggerClassName?: string;
  placeholder?: string;
}

// Multi-tag editor: checkboxes for tags already used elsewhere, plus a field
// to create a new one — same pattern as the Collaborators picker.
export default function TagsPopover({ tags, allTags, onChange, triggerClassName, placeholder = "Add tag" }: TagsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) onChange([...tags, trimmed]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const suggestions = allTags.filter((t) => !tags.includes(t));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("flex items-center gap-1 flex-wrap text-left", triggerClassName)}
        >
          {tags.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-steel">
              <TagIcon className="w-3 h-3" /> {placeholder}
            </span>
          ) : (
            tags.map((tag) => (
              <span key={tag} className="inline-flex items-center text-[10px] text-steel bg-muted/60 rounded-sm px-2 py-0.5">
                {tag}
              </span>
            ))
          )}
          <ChevronDown className="w-3 h-3 text-steel flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 bg-card border-border" align="start">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] text-foreground bg-muted rounded-sm pl-2 pr-1 py-0.5"
              >
                {tag}
                <button type="button" onClick={() => remove(tag)} className="text-steel hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New tag…"
          className="h-8 text-sm bg-background mb-1.5"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addDraft();
            }
          }}
        />
        {suggestions.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {suggestions.map((tag) => (
              <label key={tag} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-accent/50 cursor-pointer text-sm">
                <Checkbox checked={false} onCheckedChange={() => onChange([...tags, tag])} />
                <span className="text-foreground truncate">{tag}</span>
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
