import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTeamMember } from "@/hooks/useCurrentTeamMember";
import { hasPageAccess } from "@/lib/pagePermissions";
import {
  PanelLeftClose,
  PanelLeft,
  LogOut,
  BookOpen,
  Rocket,
  Users,
  UserCheck,
  Crown,
  CalendarDays,
  Menu,
  X,
  LayoutDashboard,
  Contact,
  ChevronDown,
  DollarSign,
  Receipt,
  FileBarChart,
  PieChart,
  Settings,
  Phone,
  ListTodo,
  Sun,
  Moon,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
  parentAllowed?: boolean;
}

const navItems: NavItem[] = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/shipping", label: "Book", icon: BookOpen },
  { path: "/transactions", label: "Transactions", icon: Receipt },
  { path: "/sales", label: "Sales", icon: DollarSign },
  { path: "/calls", label: "Calls", icon: Phone },
  {
    path: "/contacts", label: "Contacts", icon: Contact,
    children: [
      { path: "/workshop", label: "Workshop", icon: CalendarDays },
      { path: "/membership", label: "Live", icon: Users },
      { path: "/velocity-members", label: "Velocity", icon: UserCheck },
      { path: "/summit", label: "Summit", icon: Crown },
    ],
  },
  {
    path: "/accounting", label: "Accounting", icon: FileBarChart,
    children: [
      { path: "/accounting/pnl", label: "P&L", icon: PieChart },
      { path: "/accounting/receivables", label: "Receivables", icon: Receipt },
      { path: "/accounting/compensation", label: "Compensation", icon: DollarSign },
    ],
  },
  { path: "/tasks", label: "Tasks", icon: ListTodo },
  { path: "/settings", label: "Settings", icon: Settings },
];

function NavItemLink({ item, isActive, onClick, collapsed }: { item: NavItem; isActive: boolean; onClick: () => void; collapsed?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        collapsed ? "justify-center" : ""
      } ${
        isActive
          ? "bg-sidebar-accent text-gold"
          : "text-sidebar-foreground/70 hover:text-gold hover:bg-sidebar-accent/50"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && item.label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: teamMember } = useCurrentTeamMember();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "/transactions": true, "/sales": true, "/contacts": true, "/accounting": true });

  const toggleGroup = (path: string) =>
    setOpenGroups((prev) => ({ ...prev, [path]: !prev[path] }));

  const isGroupOpen = (item: NavItem) => {
    const childActive = item.children?.some((c) => location.pathname === c.path);
    return childActive || !!openGroups[item.path];
  };

  const visibleNavItems = navItems.flatMap((item) => {
    if (item.path === "/settings") return [item];
    if (!item.children) return hasPageAccess(teamMember, item.path) ? [item] : [];

    const children = item.children.filter((child) => hasPageAccess(teamMember, child.path));
    const parentAllowed = item.path === "/contacts" && hasPageAccess(teamMember, item.path);
    return parentAllowed || children.length ? [{ ...item, children, parentAllowed }] : [];
  });

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 ${collapsed ? "w-16" : "w-56"} bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 lg:translate-x-0 lg:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`${collapsed ? "p-3" : "px-4 py-5"} border-b border-sidebar-border flex items-center ${collapsed ? "justify-center" : ""}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/brand/seal-gold.png" alt="" className={`flex-shrink-0 ${collapsed ? "w-8 h-8" : "w-14 h-14"}`} />
            {!collapsed && (
              <h1 className="font-heading text-xl font-bold tracking-normal text-gold leading-[1.05] uppercase">
                <span className="block">Financial</span>
                <span className="block">Increase</span>
              </h1>
            )}
          </div>
        </div>

        <nav className={`flex-1 py-4 ${collapsed ? "px-1.5" : "px-3"} space-y-0.5 overflow-y-auto`}>
          {visibleNavItems.map((item) => {
            if (item.children) {
              const Icon = item.icon;
              const isParentActive = location.pathname === item.path;
              const isOpen = isGroupOpen(item);
              if (collapsed) {
                return (
                  <div key={item.path} className="space-y-0.5">
                    {item.parentAllowed ? (
                      <NavItemLink item={item} isActive={isParentActive} onClick={() => setSidebarOpen(false)} collapsed />
                    ) : (
                      <button title={item.label} onClick={() => toggleGroup(item.path)} className="w-full flex justify-center px-3 py-1.5 rounded-lg text-sidebar-foreground/70 hover:text-gold hover:bg-sidebar-accent/50">
                        <Icon className="w-4 h-4" />
                      </button>
                    )}
                    {item.children.map((child) => (
                      <NavItemLink key={child.path} item={child} isActive={location.pathname === child.path} onClick={() => setSidebarOpen(false)} collapsed />
                    ))}
                  </div>
                );
              }
              return (
                <div key={item.path} className="space-y-0.5">
                  <div className="flex items-center">
                    {item.parentAllowed ? (
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex-1 flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isParentActive ? "bg-sidebar-accent text-gold" : "text-sidebar-foreground/70 hover:text-gold hover:bg-sidebar-accent/50"}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </Link>
                    ) : (
                      <button onClick={() => toggleGroup(item.path)} className="flex-1 flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-gold hover:bg-sidebar-accent/50">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </button>
                    )}
                    <button
                      onClick={() => toggleGroup(item.path)}
                      className="p-1.5 text-sidebar-foreground/70 hover:text-gold transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
                      {item.children.map((child) => (
                        <NavItemLink
                          key={child.path}
                          item={child}
                          isActive={location.pathname === child.path}
                          onClick={() => setSidebarOpen(false)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavItemLink
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
                onClick={() => setSidebarOpen(false)}
                collapsed={collapsed}
              />
            );
          })}
        </nav>

        <div className={`${collapsed ? "p-2" : "p-4"} border-t border-sidebar-border space-y-3`}>
          <div className={`flex items-center ${collapsed ? "flex-col justify-center gap-1" : "gap-1"}`}>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 text-sidebar-foreground/70 hover:text-gold transition-colors rounded-md hover:bg-sidebar-accent/50"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden lg:flex p-1.5 text-sidebar-foreground/70 hover:text-gold transition-colors rounded-md hover:bg-sidebar-accent/50"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            {collapsed && (
              <button onClick={signOut} className="p-1.5 text-sidebar-foreground/70 hover:text-gold transition-colors rounded-md hover:bg-sidebar-accent/50" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-sidebar-foreground truncate min-w-0">{user?.email}</p>
              <button onClick={signOut} className="p-1.5 text-sidebar-foreground/70 hover:text-gold transition-colors rounded-md hover:bg-sidebar-accent/50 flex-shrink-0" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-background/50 backdrop-blur-sm sticky top-0 z-30 lg:hidden">
          <button className="text-steel hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
