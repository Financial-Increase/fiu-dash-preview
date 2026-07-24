export interface PagePermissionMember {
  role?: string | null;
  page_permissions?: string[] | null;
}

export const DEFAULT_PAGE_PERMISSIONS = ["/tasks"];

export const PAGE_PERMISSION_GROUPS = [
  {
    label: "General",
    pages: [
      { path: "/", label: "Overview" },
      { path: "/shipping", label: "Book" },
      { path: "/transactions", label: "Transactions" },
      { path: "/sales", label: "Sales" },
      { path: "/calls", label: "Calls" },
    ],
  },
  {
    label: "Contacts",
    pages: [
      { path: "/contacts", label: "Contacts" },
      { path: "/workshop", label: "Workshop" },
      { path: "/membership", label: "Live" },
      { path: "/velocity-members", label: "Velocity" },
      { path: "/summit", label: "Summit" },
    ],
  },
  {
    label: "Accounting",
    pages: [
      { path: "/accounting/pnl", label: "P&L" },
      { path: "/accounting/receivables", label: "Receivables" },
      { path: "/accounting/compensation", label: "Compensation" },
    ],
  },
  { label: "Work", pages: [{ path: "/tasks", label: "Tasks" }] },
] as const;

export const PAGE_PERMISSION_PATHS = PAGE_PERMISSION_GROUPS.flatMap((group) =>
  group.pages.map((page) => page.path),
);

export function isAdmin(member?: PagePermissionMember | null) {
  return member?.role === "Admin";
}

export function hasPageAccess(member: PagePermissionMember | null | undefined, path: string) {
  if (isAdmin(member)) return true;
  return (member?.page_permissions ?? DEFAULT_PAGE_PERMISSIONS).includes(path);
}

export function firstAllowedPage(member?: PagePermissionMember | null) {
  if (isAdmin(member)) return "/";
  return PAGE_PERMISSION_PATHS.find((path) => hasPageAccess(member, path)) ?? "/tasks";
}
