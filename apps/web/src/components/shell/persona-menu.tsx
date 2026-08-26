"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setTheme, signOut } from "@/app/actions";

export function PersonaMenu({ me, children, align = "start" }: { me: { displayName: string; role: string }; children: React.ReactNode; align?: "start" | "end" }) {
  const router = useRouter();
  const [, start] = useTransition();
  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    start(() => setTheme(next));
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} className="z-50 min-w-56 rounded-lg bg-surface p-1 shadow-3 hairline">
          <div className="px-2.5 py-2">
            <p className="text-[13px] font-medium">{me.displayName}</p>
            <p className="text-[11.5px] capitalize text-ink-3">{me.role} · signed in with Entra ID</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <Item onSelect={toggleTheme} icon={<span className="relative size-4"><Sun className="absolute inset-0 size-4 dark:opacity-0" /><Moon className="absolute inset-0 size-4 opacity-0 dark:opacity-100" /></span>}>Toggle theme</Item>
          <Item onSelect={() => router.push("/login")} icon={<UserRound className="size-4" />}>Sign in as someone else (dev)</Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <Item onSelect={() => start(() => signOut())} icon={<LogOut className="size-4" />}>Sign out</Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({ children, icon, onSelect }: { children: React.ReactNode; icon: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className="flex h-8 cursor-pointer select-none items-center gap-2.5 rounded-md px-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
      <span className="text-ink-3">{icon}</span>
      {children}
    </DropdownMenu.Item>
  );
}
