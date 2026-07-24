export const TASK_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Waiting For",
  "Done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_COLORS: Record<TaskStatus, string> = {
  Backlog: "bg-steel/20 text-steel border-steel/30",
  "To Do": "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "In Progress": "bg-gold/20 text-gold border-gold/30",
  "Waiting For": "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  Done: "bg-emerald/30 text-parchment border-emerald/50",
};

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  Backlog: "The universe, wishlist, and brain dump of everything that could be done.",
  "To Do": "Tasks chosen from the Backlog to focus on, but not started yet.",
  "In Progress": "Tasks that have been started and are being worked on now.",
  "Waiting For": "No further action can be taken yet, except perhaps following up, because something else must happen before the next step.",
  Done: "Completed tasks.",
};

export interface TeamMemberLite {
  id: string;
  name: string;
  email: string;
  role?: string;
  auth_user_id?: string | null;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name: string;
  comment_text: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  tags: string[];
  due_date: string | null;
  link_url: string | null;
  position: number;
  owner_id: string;
  assignee_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  owner: TeamMemberLite | null;
  assignee: TeamMemberLite | null;
  collaborators: { team_member: TeamMemberLite | null }[];
  comments: { id: string }[];
}

// Explicit FK constraint names disambiguate the two team_members references on tasks.
export const TASKS_SELECT = `
  *,
  owner:team_members!tasks_owner_id_fkey(id,name,email),
  assignee:team_members!tasks_assignee_id_fkey(id,name,email),
  collaborators:task_collaborators(team_member:team_members(id,name,email)),
  comments:task_comments(id)
`;

// Adds a protocol if the user typed a bare domain (e.g. "notion.so/doc") so the
// link opens as an external URL instead of a relative in-app route.
export function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
