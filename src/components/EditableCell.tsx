import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil } from "lucide-react";

interface EditableCellProps {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "select" | "boolean" | "date";
  options?: string[];
}

export default function EditableCell({ value, onChange, type = "text", options }: EditableCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const displayValue = useMemo(() => {
    if (!value || value === "—") return "—";
    // Date-typed cells: always show MM/DD/YY in Pacific, never time.
    if (type === "date") {
      try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        return d.toLocaleDateString("en-US", {
          timeZone: "America/Los_Angeles",
          month: "2-digit",
          day: "2-digit",
          year: "2-digit",
        });
      } catch {
        return value;
      }
    }
    // ISO timestamp with time → format in Pacific (legacy non-date cells)
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      try {
        const d = new Date(value);
        return d.toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          month: "2-digit",
          day: "2-digit",
          year: "2-digit",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }) + " PT";
      } catch {
        return value;
      }
    }
    // Plain date YYYY-MM-DD → MM/DD/YY
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[2]}/${match[3]}/${match[1].slice(2)}`;
    }
    return value;
  }, [value, type]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
    setOpen(false);
  };

  if (type === "date") {
    // Date column: native HTML5 date input. ISO date strings (YYYY-MM-DD)
    // and ISO timestamps both round-trip cleanly. Empty value clears.
    const dateValue = useMemo(() => {
      if (!value) return "";
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }, [value]);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="group flex items-center gap-1.5 text-left text-sm hover:text-gold transition-colors w-full whitespace-nowrap">
            <span>{value ? displayValue : "—"}</span>
            <Pencil className="w-3 h-3 text-steel opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-card border-border" align="start">
          <Input
            ref={inputRef}
            type="date"
            className="h-8 text-sm bg-muted border-border text-foreground"
            value={draft.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? dateValue}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setOpen(false);
            }}
            autoFocus
          />
          <div className="flex justify-between gap-1 mt-1.5">
            <button
              className="text-[10px] px-2 py-1 rounded text-steel hover:text-destructive transition-colors"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <div className="flex gap-1">
              <button
                className="text-[10px] px-2 py-1 rounded text-steel hover:text-foreground transition-colors"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold"
                onClick={commit}
              >
                Save
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (type === "select" || type === "boolean") {
    const selectOptions =
      type === "boolean" ? ["Yes", "No"] : options ?? [];

    return (
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(v);
        }}
      >
        <SelectTrigger className="h-7 min-w-[90px] text-xs bg-muted border-border text-foreground focus:ring-ring whitespace-nowrap">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {selectOptions.map((opt) => (
            <SelectItem key={opt} value={opt} className="text-xs">
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="group flex items-center gap-1.5 text-left text-sm hover:text-gold transition-colors w-full whitespace-nowrap">
          <span>{displayValue}</span>
          <Pencil className="w-3 h-3 text-steel opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 bg-card border-border" align="start">
        <Input
          ref={inputRef}
          className="h-8 text-sm bg-muted border-border text-foreground"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setOpen(false);
          }}
          autoFocus
        />
        <div className="flex justify-end gap-1 mt-1.5">
          <button
            className="text-[10px] px-2 py-1 rounded text-steel hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-semibold"
            onClick={commit}
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
