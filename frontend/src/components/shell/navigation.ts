import {
  BookOpen,
  Building,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  GraduationCap,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  Scale,
  ScrollText,
  Send,
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
        { href: "/student/registration", label: "Course registration", icon: ClipboardList },
        { href: "/student/courses", label: "My courses", icon: BookOpen },
        { href: "/student/results", label: "Results", icon: GraduationCap },
        { href: "/student/profile", label: "Profile", icon: UserRound },
      ],
    },
  ],
  LECTURER: [
    {
      items: [
        { href: "/lecturer", label: "Dashboard", icon: LayoutDashboard },
        { href: "/lecturer/courses", label: "My courses", icon: BookOpen },
        { href: "/lecturer/submissions", label: "Submissions", icon: Send },
        { href: "/lecturer/profile", label: "Profile", icon: UserRound },
      ],
    },
  ],
  DEPT_ADMIN: [
    { items: [{ href: "/department", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "People",
      items: [
        { href: "/department/students", label: "Students", icon: Users },
        { href: "/department/lecturers", label: "Lecturers", icon: UserCog },
      ],
    },
    {
      label: "Academics",
      items: [
        { href: "/department/programs", label: "Programs", icon: Layers },
        { href: "/department/courses", label: "Courses", icon: BookOpen },
        { href: "/department/allocations", label: "Allocations", icon: ListChecks },
        { href: "/department/registrations", label: "Registrations", icon: ClipboardList },
      ],
    },
    {
      label: "Results",
      items: [
        { href: "/department/results", label: "Result sheets", icon: FileCheck },
        { href: "/department/reports", label: "Reports", icon: ChartColumn },
      ],
    },
    { items: [{ href: "/department/profile", label: "Profile", icon: UserRound }] },
  ],
  SUPER_ADMIN: [
    { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Structure",
      items: [
        { href: "/admin/faculties", label: "Faculties", icon: Landmark },
        { href: "/admin/departments", label: "Departments", icon: Building },
        { href: "/admin/programs", label: "Programs", icon: Layers },
        { href: "/admin/sessions", label: "Sessions", icon: CalendarDays },
      ],
    },
    {
      label: "Teaching",
      items: [
        { href: "/admin/courses", label: "Courses", icon: BookOpen },
        { href: "/admin/allocations", label: "Allocations", icon: ListChecks },
        { href: "/admin/registrations", label: "Registrations", icon: ClipboardList },
        { href: "/admin/results", label: "Result approvals", icon: ClipboardCheck },
      ],
    },
    {
      label: "Administration",
      items: [
        { href: "/admin/users", label: "Users", icon: Users },
        { href: "/admin/reports", label: "Reports", icon: ChartColumn },
        { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
        { href: "/admin/grade-scale", label: "Grade scale", icon: Scale },
      ],
    },
  ],
};

export const PROFILE_PATH: Partial<Record<Role, string>> = {
  STUDENT: "/student/profile",
  LECTURER: "/lecturer/profile",
  DEPT_ADMIN: "/department/profile",
};
