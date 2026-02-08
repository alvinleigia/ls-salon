"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  CalendarClockIcon,
  ClockIcon,
  PackageIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  MoonIcon,
  ScissorsIcon,
  SettingsIcon,
  SunIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canInvite, canManageUsers, type Role } from "@/lib/permissions"

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
]

export function AppSidebar() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const user = session?.user
  const role = (user as { role?: Role })?.role
  const name = user?.name?.trim() || user?.email?.trim() || "Guest"
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1 text-sm font-semibold">LS Salon</div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname === item.href}
                  >
                    <Link href={item.href} className="flex w-full items-center">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname === item.href
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname.startsWith("/inventory")}
                  >
                    <Link href="/inventory" className="flex w-full items-center">
                      <PackageIcon className="h-4 w-4" />
                      <span>Inventory</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname.startsWith("/inventory")
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/inventory"}
                      >
                        <Link href="/inventory">
                          <PackageIcon className="h-4 w-4" />
                          <span>Products</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/inventory/categories"}
                      >
                        <Link href="/inventory/categories">
                          <TagIcon className="h-4 w-4" />
                          <span>Categories</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/inventory/suppliers"}
                      >
                        <Link href="/inventory/suppliers">
                          <UsersIcon className="h-4 w-4" />
                          <span>Suppliers</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/inventory/purchases"}
                      >
                        <Link href="/inventory/purchases">
                          <CalendarClockIcon className="h-4 w-4" />
                          <span>Purchases</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname.startsWith("/appointments")}
                  >
                    <Link href="/appointments" className="flex w-full items-center">
                      <CalendarClockIcon className="h-4 w-4" />
                      <span>Appointments</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname.startsWith("/appointments")
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/appointments"}
                      >
                        <Link href="/appointments">
                          <CalendarClockIcon className="h-4 w-4" />
                          <span>View</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/appointments/coupons"}
                      >
                        <Link href="/appointments/coupons">
                          <TagIcon className="h-4 w-4" />
                          <span>Coupons</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname.startsWith("/services")}
                  >
                    <Link href="/services" className="flex w-full items-center">
                      <ScissorsIcon className="h-4 w-4" />
                      <span>Services</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname.startsWith("/services")
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/services"}
                      >
                        <Link href="/services">
                          <ScissorsIcon className="h-4 w-4" />
                          <span>Services</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/services/categories"}
                      >
                        <Link href="/services/categories">
                          <TagIcon className="h-4 w-4" />
                          <span>Categories</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname === "/users"}
                  >
                    <Link href="/users" className="flex w-full items-center">
                      <UsersIcon className="h-4 w-4" />
                      <span>Users</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname === "/users"
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/users"}
                      >
                        <Link href="/users">
                          <UsersIcon className="h-4 w-4" />
                          <span>View</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {canInvite(role ?? null) ? (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === "/users/invites"}
                        >
                          <Link href="/users/invites">
                            <MailIcon className="h-4 w-4" />
                            <span>Invitees</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ) : null}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname.startsWith("/shifts")}
                  >
                    <Link href="/shifts" className="flex w-full items-center">
                      <ClockIcon className="h-4 w-4" />
                      <span>Shifts</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname.startsWith("/shifts")
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/shifts"}
                      >
                        <Link href="/shifts">
                          <ClockIcon className="h-4 w-4" />
                          <span>Templates</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/shifts/schedules"}
                      >
                        <Link href="/shifts/schedules">
                          <CalendarClockIcon className="h-4 w-4" />
                          <span>Schedules</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/shifts/roster"}
                      >
                        <Link href="/shifts/roster">
                          <CalendarClockIcon className="h-4 w-4" />
                          <span>Roster</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
              {canManageUsers(role ?? null) ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    data-active={pathname.startsWith("/settings")}
                  >
                    <Link href="/settings" className="flex w-full items-center">
                      <SettingsIcon className="h-4 w-4" />
                      <span>Settings</span>
                      <span
                        className={`ml-auto h-2 w-2 rounded-full ${
                          pathname.startsWith("/settings")
                            ? "bg-sidebar-primary"
                            : "bg-transparent"
                        }`}
                      />
                    </Link>
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/settings"}
                      >
                        <Link href="/settings">
                          <SettingsIcon className="h-4 w-4" />
                          <span>General</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={pathname === "/settings/taxes"}
                      >
                        <Link href="/settings/taxes">
                          <TagIcon className="h-4 w-4" />
                          <span>Taxes</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md border bg-background px-3 py-2 text-left transition hover:bg-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                ) : initials ? (
                  <span>{initials}</span>
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{name}</div>
                {user?.email ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </div>
                ) : null}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-48">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value)}
            >
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                <span>Light</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                <span>Dark</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <span className="text-xs font-semibold">OS</span>
                <span>System</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="justify-start"
              onSelect={() => signOut({ callbackUrl: "/auth/signin" })}
            >
              <LogOutIcon className="mr-1" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
