import { RefObject, useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeUrl } from "./types";
import { getCaretCoordinates } from "./caretPosition";

interface SelectionLinkToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
}

const TOOLBAR_OFFSET = 36;

// Floating "add link" bubble that appears above a text selection inside a
// plain <textarea> — mirrors the highlight-to-link UX of rich text editors,
// without pulling in a full rich text editor for what's otherwise plain text.
export default function SelectionLinkToolbar({ textareaRef, value, onChange }: SelectionLinkToolbarProps) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const updateFromSelection = () => {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) {
        setSelection(null);
        setPos(null);
        return;
      }
      const caret = getCaretCoordinates(el, start);
      setSelection({ start, end });
      setPos({
        top: caret.top - el.scrollTop - TOOLBAR_OFFSET,
        left: Math.max(0, caret.left - el.scrollLeft),
      });
    };

    const handleOutsideMouseDown = (e: MouseEvent) => {
      // While the popover is open, its content renders in a portal outside
      // containerRef — let Radix's own dismiss handling manage it instead of
      // racing it (a document-level mousedown here would close it before the
      // Input/Add button inside ever sees the click).
      if (linkOpen) return;
      const target = e.target as Node;
      if (el.contains(target) || containerRef.current?.contains(target)) return;
      setSelection(null);
      setPos(null);
    };

    el.addEventListener("mouseup", updateFromSelection);
    el.addEventListener("keyup", updateFromSelection);
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      el.removeEventListener("mouseup", updateFromSelection);
      el.removeEventListener("keyup", updateFromSelection);
      document.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, [textareaRef, linkOpen]);

  if (!selection || !pos) return null;

  const insert = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    const { start, end } = selection;
    const label = value.slice(start, end);
    const markdown = `[${label}](${normalized})`;
    const next = value.slice(0, start) + markdown + value.slice(end);
    onChange(next);
    setLinkOpen(false);
    setSelection(null);
    setPos(null);
    setUrl("");

    // Refocus so the field's own onBlur-save (e.g. task description) still
    // fires with the updated text once the user clicks away again.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const caret = start + markdown.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-10"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Popover
        open={linkOpen}
        onOpenChange={(next) => {
          setLinkOpen(next);
          if (!next) {
            setSelection(null);
            setPos(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Add link"
            onClick={() => setLinkOpen(true)}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-popover border border-border shadow-md text-steel hover:text-gold transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 bg-card border-border flex gap-1.5" align="start" sideOffset={4}>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoFocus
            className="h-8 text-sm bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insert();
              }
            }}
          />
          <Button size="sm" className="h-8 px-2.5 text-xs flex-shrink-0" disabled={!url.trim()} onClick={insert}>
            Add
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
