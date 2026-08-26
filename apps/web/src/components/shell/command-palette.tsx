"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { BarChart3, CalendarDays, FolderKanban, Search, Settings, Users, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { KindTag } from "@/components/ui/pills";

type Results = {
  projects: { id: number; code: string; name: string; kind: string; status: string }[];
  people: { id: number; displayName: string; jobTitle: string | null; team: string | null }[];
};

export function CommandPalette({ manager }: { manager: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then(setRes)
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const pages: [string, string, React.ReactNode][] = [
    ["/time", "My timesheet", <CalendarDays key="t" className="size-4" />],
    ...(manager ? ([["/team", "Team", <UsersRound key="u" className="size-4" />]] as [string, string, React.ReactNode][]) : []),
    ["/projects", "Projects", <FolderKanban key="p" className="size-4" />],
    ["/reports", "Reports", <BarChart3 key="r" className="size-4" />],
    ...(manager ? ([["/people", "People", <Users key="pe" className="size-4" />], ["/admin", "Admin", <Settings key="a" className="size-4" />]] as [string, string, React.ReactNode][]) : []),
  ];

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-8 w-52 items-center gap-2 rounded-md bg-surface-2 px-2.5 text-left text-[13px] text-ink-3 transition-colors hover:bg-surface-3">
        <Search className="size-3.5" />
        <span className="flex-1 truncate whitespace-nowrap">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] dark:bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-[14vh] z-50 w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-xl bg-surface shadow-3 hairline">
            <Dialog.Title className="sr-only">Search</Dialog.Title>
            <Command shouldFilter={false} label="Search">
              <div className="flex items-center gap-2 px-4 hairline-b">
                <Search className="size-4 text-ink-3" />
                <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Type SR-229241, a project, a name…" className="h-12 flex-1 bg-transparent text-[14px] outline-none" />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-[13px] text-ink-3">{q.trim().length < 2 ? "Start typing to search. Service Desk references like SR-229241 work too." : "No matches."}</Command.Empty>
                {!q.trim() && (
                  <Command.Group heading={<Heading>Go to</Heading>}>
                    {pages.map(([href, label, icon]) => (
                      <Row key={href} onSelect={() => go(href)} icon={icon}>
                        {label}
                      </Row>
                    ))}
                  </Command.Group>
                )}
                {res?.projects.length ? (
                  <Command.Group heading={<Heading>Projects & work requests</Heading>}>
                    {res.projects.map((p) => (
                      <Row key={p.id} onSelect={() => go(`/projects/${p.id}`)} icon={<FolderKanban className="size-4" />}>
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate">{p.name}</span>
                          <KindTag kind={p.kind} />
                          <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3">{p.code}</span>
                        </span>
                      </Row>
                    ))}
                  </Command.Group>
                ) : null}
                {res?.people.length && manager ? (
                  <Command.Group heading={<Heading>People</Heading>}>
                    {res.people.map((p) => (
                      <Row key={p.id} onSelect={() => go(`/people/${p.id}`)} icon={<Users className="size-4" />}>
                        <span className="truncate">{p.displayName}</span>
                        <span className="ml-auto truncate text-[12px] text-ink-3">
                          {p.jobTitle}
                          {p.team ? ` · ${p.team}` : ""}
                        </span>
                      </Row>
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <span className="label block px-2 pb-1 pt-2">{children}</span>;
}
function Row({ children, icon, onSelect }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item onSelect={onSelect} className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13px] text-ink">
      <span className="flex w-5 shrink-0 justify-center text-ink-3">{icon}</span>
      {children}
    </Command.Item>
  );
}
