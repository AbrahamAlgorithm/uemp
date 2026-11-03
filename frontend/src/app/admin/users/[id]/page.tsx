"use client";

import { useParams } from "next/navigation";

import { ActivityFeed } from "@/components/activity-feed";
import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { UserActions } from "@/components/user-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const { data, error, reload } = useAsync(() => Promise.all([api.getUser(userId), api.getDepartments()]), userId);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={0} rows={6} />;

  const [user, departments] = data;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Users", href: "/admin/users" }, { label: user.fullName }]}
        title={user.fullName}
        description={
          <span className="flex items-center gap-3">
            {ROLE_LABELS[user.role]}
            {user.department && ` · ${user.department.name}`}
            <UserStatusBadge status={user.status} />
          </span>
        }
        actions={<UserActions user={user} departments={departments} onChanged={reload} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={[
                  { label: "Email", value: user.email },
                  { label: "Phone", value: user.phone },
                  { label: "Role", value: ROLE_LABELS[user.role] },
                  { label: "Department", value: user.department?.name ?? "University-wide" },
                  { label: "Joined", value: formatDate(user.dateJoined) },
                  { label: "Last sign-in", value: formatDateTime(user.lastLogin) },
                ]}
              />
            </CardContent>
          </Card>
          {user.student && (
            <Card>
              <CardHeader>
                <CardTitle>Student record</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    { label: "Matric number", value: user.student.matricNumber },
                    { label: "Program", value: `${user.student.program.award} ${user.student.program.name}` },
                    { label: "Level", value: `${user.student.level} level` },
                    { label: "Faculty", value: user.student.faculty.name },
                    { label: "Entry session", value: user.student.entrySession },
                    { label: "Address", value: user.student.address },
                  ]}
                />
              </CardContent>
            </Card>
          )}
          {user.staff && (
            <Card>
              <CardHeader>
                <CardTitle>Staff record</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    { label: "Staff ID", value: user.staff.staffId },
                    { label: "Title", value: user.staff.title },
                    { label: "Faculty", value: user.staff.faculty?.name ?? "—" },
                  ]}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={user.recentActivity} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
