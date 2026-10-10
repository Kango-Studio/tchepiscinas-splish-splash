import { useState, type ReactNode } from "react";
import {
  Button,
  Divider,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";
import { useLocation } from "@tanstack/react-router";
import { ExternalLink, LayoutDashboard, LogOut, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAdminAuth } from "./auth";

const NAV = [
  { href: "/admin", label: "Leads", icon: Users },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const email = "session" in state ? state.session.user.email : undefined;
  const pathname = useLocation({ select: (l) => l.pathname.replace(/\/+$/, "") });
  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-dvh bg-[#f4f9fc] text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-default-200 bg-white lg:flex">
        <div className="flex h-20 items-center px-6">
          <img src={logo} alt="Tchê Piscinas" className="h-12 w-auto" />
        </div>
        <nav aria-label="Navegação do painel" className="flex-1 px-3 py-2">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                isActive(item.href)
                  ? "bg-pool-mist font-semibold text-pool-deep"
                  : "font-medium text-default-600 transition hover:bg-default-100"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </a>
          ))}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-default-600 transition hover:bg-default-100"
          >
            <ExternalLink className="size-4" />
            Ver site
          </a>
        </nav>
        <div className="border-t border-default-200 p-4">
          <p className="truncate text-xs text-default-500" title={email}>
            {email}
          </p>
          <Button
            variant="light"
            color="danger"
            size="sm"
            className="mt-2 w-full justify-start"
            startContent={<LogOut className="size-4" />}
            onPress={signOut}
          >
            Sair
          </Button>
        </div>
      </aside>

      {/* Topo (mobile/tablet) */}
      <Navbar
        isMenuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        maxWidth="full"
        isBordered
        className="lg:hidden"
        classNames={{ wrapper: "px-4" }}
      >
        <NavbarContent justify="start">
          <NavbarBrand>
            <img src={logo} alt="Tchê Piscinas" className="h-10 w-auto" />
          </NavbarBrand>
        </NavbarContent>
        <NavbarContent justify="end">
          <NavbarMenuToggle aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} />
        </NavbarContent>
        <NavbarMenu className="gap-1 pt-4">
          {NAV.map((item) => (
            <NavbarMenuItem key={item.href} isActive={isActive(item.href)}>
              <a
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                  isActive(item.href)
                    ? "bg-pool-mist font-semibold text-pool-deep"
                    : "text-default-600"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <item.icon className="size-5" />
                {item.label}
              </a>
            </NavbarMenuItem>
          ))}
          <NavbarMenuItem>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-3 text-default-600"
            >
              <ExternalLink className="size-5" />
              Ver site
            </a>
          </NavbarMenuItem>
          <Divider className="my-2" />
          <NavbarMenuItem>
            <p className="px-3 text-xs text-default-500">{email}</p>
            <Button
              variant="light"
              color="danger"
              className="mt-1 w-full justify-start"
              startContent={<LogOut className="size-5" />}
              onPress={signOut}
            >
              Sair
            </Button>
          </NavbarMenuItem>
        </NavbarMenu>
      </Navbar>

      <main className="px-4 py-5 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
