import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  Scale,
  ScrollText,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAVIGATION: Record<Role, NavGroup[]> = {
  STUDENT: [
    {
      items: [
        { href: "/student", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/my-courses", label: "My Courses", icon: BookOpen },
        { href: "/student/profile", label: "Profile", icon: UserRound },
      ],
    },
  ],
  LECTURER: [
    {
      items: [
        { href: "/lecturer", label: "Dashboard", icon: LayoutDashboard },
        { href: "/lecturer/courses", label: "My Courses", icon: BookOpen },
        { href: "/lecturer/profile", label: "Profile", icon: UserRound },
      ],
    },
  ],
  DEPT_ADMIN: [
    {
      items: [
        { href: "/department", label: "Dashboard", icon: LayoutDashboard },
        { href: "/department/students", label: "Students", icon: Users },
        { href: "/department/lecturers", label: "Lecturers", icon: UserCog },
        { href: "/department/programs", label: "Programs", icon: Layers },
        { href: "/department/courses", label: "Courses", icon: BookOpen },
        { href: "/department/allocations", label: "Allocations", icon: ListChecks },
        { href: "/department/registrations", label: "Registrations", icon: ClipboardList },
        { href: "/department/results", label: "Results", icon: FileCheck },
        { href: "/department/reports", label: "Reports", icon: ChartColumn },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin/structure", label: "Academic Structure", icon: Landmark },
        { href: "/admin/calendar", label: "Academic Calendar", icon: CalendarDays },
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/registrations", label: "Registrations", icon: ClipboardList },
        { href: "/admin/results", label: "Results", icon: ClipboardCheck },
        { href: "/admin/reports", label: "Reports", icon: ChartColumn },
        { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
        { href: "/admin/grade-scale", label: "Grading Scale", icon: Scale },
      ],
    },
  ],
};

export const PROFILE_PATH: Partial<Record<Role, string>> = {
  STUDENT: "/student/profile",
  LECTURER: "/lecturer/profile",
  DEPT_ADMIN: "/department/profile",
};
