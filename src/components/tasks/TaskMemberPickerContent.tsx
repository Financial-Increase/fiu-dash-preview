import { Check, UserRound } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { initials, TeamMemberLite } from "./types";

interface TaskMemberPickerContentProps {
  title: string;
  description: string;
  members: TeamMemberLite[];
  selectedIds: string[];
  multiple?: boolean;
  disabled?: boolean;
  onChange: (nextIds: string[]) => void;
}

export default function TaskMemberPickerContent({
  title,
  description,
  members,
  selectedIds,
  multiple = false,
  disabled = false,
  onChange,
}: TaskMemberPickerContentProps) {
  const optionCount = members.length + (multiple ? 0 : 1);
  const pickerHeight = Math.min(256, Math.max(56, optionCount * 44 + 12));

  const choose = (memberId: string) => {
    if (multiple) {
      onChange(
        selectedIds.includes(memberId)
          ? selectedIds.filter((id) => id !== memberId)
          : [...selectedIds, memberId],
      );
      return;
    }
    onChange([memberId]);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="truncate text-[10px] text-steel">{description}</p>
        </div>
        <span className="ml-3 flex-shrink-0 text-[10px] tabular-nums text-steel">
          {multiple ? `${selectedIds.length} selected · ` : ""}
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
      </div>

      <ScrollArea type="always" className="w-full" style={{ height: pickerHeight }}>
        <div className="p-1.5 pr-3">
        {!multiple && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([])}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm border border-transparent px-2 py-2 text-left transition-colors",
              selectedIds.length === 0 ? "bg-gold/10" : "hover:bg-muted/60",
            )}
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-steel/15 text-steel">
              <UserRound className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">Unassigned</span>
              <span className="block text-[10px] text-steel">No team member assigned</span>
            </span>
            {selectedIds.length === 0 && <Check className="h-3.5 w-3.5 flex-shrink-0 text-gold" />}
          </button>
        )}

        {members.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-steel">No team members yet</p>
        )}
        {members.map((member) => {
          const checked = selectedIds.includes(member.id);
          return (
            <button
              type="button"
              key={member.id}
              disabled={disabled}
              onClick={() => choose(member.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-sm border border-transparent px-2 py-2 text-left transition-colors",
                checked ? "bg-gold/10" : "hover:bg-muted/60",
              )}
            >
              {multiple && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 flex-shrink-0 items-center justify-center border",
                    checked ? "border-gold bg-gold text-sidebar" : "border-gold bg-transparent",
                  )}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
              )}
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  checked ? "bg-gold text-sidebar" : "bg-steel/15 text-steel",
                )}
              >
                {initials(member.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{member.name}</span>
                <span className="block truncate text-[10px] text-steel">{member.email}</span>
              </span>
              {checked && <Check className="h-3.5 w-3.5 flex-shrink-0 text-gold" />}
            </button>
          );
        })}
        </div>
      </ScrollArea>
    </>
  );
}
