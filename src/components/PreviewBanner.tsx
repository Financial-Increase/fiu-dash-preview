export function PreviewBanner() {
  if (import.meta.env.VITE_PREVIEW_MODE !== "true") return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#fbbf24",
        color: "#1f2937",
        textAlign: "center",
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "system-ui, sans-serif",
        borderBottom: "1px solid #d97706",
        pointerEvents: "none",
      }}
    >
      Preview build — visual changes only, fixture data, no live backend.
    </div>
  );
}
