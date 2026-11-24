import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Columns3, FileText, LayoutDashboard, LogOut, Menu, Settings, Workflow, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { signOut } from "@/api/auth";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { cn } from "@/lib/classNames";

import { BrandLogo } from "./BrandLogo";

const NAVIGATION_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/resumes", label: "My CVs", icon: FileText },
  { path: "/board", label: "Applications", icon: Columns3 },
  { path: "/pipeline", label: "Pipeline", icon: Workflow },
  { path: "/settings", label: "Settings", icon: Settings },
];

function SidebarNavigation({ username, onNavigate }: { username: string; onNavigate?: () => void }) {
  const queryClient = useQueryClient();

  async function handleSignOutClick() {
    await signOut();
    queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      <div className="px-5 pt-6 pb-8">
        <BrandLogo nameClassName="text-white" />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAVIGATION_ITEMS.map(({ path, label, icon: NavigationIcon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
              )
            }
          >
            {({ isActive }) => (
              <>
                <NavigationIcon className={cn("h-[18px] w-[18px]", isActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300")} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-sm font-semibold text-white uppercase">
          {username.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{username}</div>
          <div className="text-xs text-slate-500">Signed in</div>
        </div>
        <button onClick={handleSignOutClick} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// The app frame: a dark sidebar on desktop, and a top bar with a slide-out menu on phones.
export function AppLayout({ username }: { username: string }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentLocation = useLocation();
  const currentPageLabel =
    NAVIGATION_ITEMS.find(({ path }) => (path === "/" ? currentLocation.pathname === "/" : currentLocation.pathname.startsWith(path)))?.label ?? "";

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarNavigation username={username} />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">{currentPageLabel}</span>
          <button onClick={() => setIsMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-5 right-3 z-10 rounded-lg p-2 text-slate-400 hover:text-white" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarNavigation username={username} onNavigate={() => setIsMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
