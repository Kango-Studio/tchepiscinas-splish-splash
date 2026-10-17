import type { ComponentType, ReactNode, SVGProps } from "react";
import { Button, Drawer, Separator } from "@heroui/react";
import {
  ArrowRightFromSquare,
  ArrowUpRightFromSquare,
  Bars,
  ChartColumn,
  Persons,
} from "@gravity-ui/icons";
import { useLocation } from "@tanstack/react-router";
import logo from "@/assets/logo.webp";
import { useAdminAuth } from "./auth";

type NavItem = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

const NAV: NavItem[] = [
  { href: "/admin", label: "Leads", icon: Persons },
  { href: "/admin/dashboard", label: "Dashboard", icon: ChartColumn },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAdminAuth();
  const email = "session" in state ? state.session.user.email : undefined;
  const pathname = useLocation({ select: (l) => l.pathname.replace(/\/+$/, "") });
  const isActive = (href: string) => pathname === href;

  const navLinks = (size: "md" | "lg") => (
    <>
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200 ${
              size === "lg" ? "py-3" : "py-2.5"
            } ${
              active
                ? "bg-accent-soft font-semibold text-accent"
                : "font-medium text-muted hover:bg-default hover:text-foreground"
            }`}
          >
            {/* Barra indicadora da página atual */}
            <span
              aria-hidden
              className={`absolute inset-y-2 left-0 w-1 rounded-full bg-accent transition-all duration-300 ${
                active ? "opacity-100" : "scale-y-0 opacity-0"
              }`}
            />
            <item.icon
              className={`size-4.5 transition-transform duration-200 ${active ? "" : "group-hover:scale-110"}`}
            />
            {item.label}
          </a>
        );
      })}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted transition-colors duration-200 hover:bg-default hover:text-foreground ${
          size === "lg" ? "py-3" : "py-2.5"
        }`}
      >
        <ArrowUpRightFromSquare className="size-4.5" />
        Ver site
      </a>
    </>
  );

  const signOutButton = (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-danger"
      onPress={signOut}
    >
      <ArrowRightFromSquare className="size-4" />
      Sair
    </Button>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-separator bg-surface lg:flex">
        <div className="flex h-20 items-center px-6">
          <img src={logo} alt="Tchê Piscinas" className="h-12 w-auto" />
        </div>
        <nav aria-label="Navegação do painel" className="flex flex-1 flex-col gap-1 px-3 py-2">
          {navLinks("md")}
        </nav>
        <div className="border-t border-separator p-4">
          <p className="truncate px-1 text-xs text-muted" title={email}>
            {email}
          </p>
          <div className="mt-2">{signOutButton}</div>
        </div>
      </aside>

      {/* Topo (mobile/tablet): menu em Drawer, já que o Navbar saiu do HeroUI v3 */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-separator bg-surface/85 px-4 backdrop-blur-md lg:hidden">
        <img src={logo} alt="Tchê Piscinas" className="h-10 w-auto" />
        <Drawer>
          <Button isIconOnly variant="ghost" aria-label="Abrir menu">
            <Bars className="size-5" />
          </Button>
          <Drawer.Backdrop variant="blur">
            <Drawer.Content placement="left">
              <Drawer.Dialog aria-label="Menu do painel">
                <Drawer.CloseTrigger aria-label="Fechar menu" />
                <Drawer.Header>
                  <img src={logo} alt="Tchê Piscinas" className="h-10 w-auto self-start" />
                </Drawer.Header>
                <Drawer.Body>
                  <nav aria-label="Navegação do painel" className="flex flex-col gap-1">
                    {navLinks("lg")}
                  </nav>
                </Drawer.Body>
                <Drawer.Footer className="flex-col items-stretch gap-2">
                  <Separator />
                  <p className="truncate px-1 text-xs text-muted">{email}</p>
                  {signOutButton}
                </Drawer.Footer>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </header>

      <main className="px-4 py-5 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
