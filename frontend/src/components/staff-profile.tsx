"use client";

import { ChangePasswordButton } from "@/components/change-password";
import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";

export function StaffProfileView() {
  const { data, error, reload } = useAsync(api.getStaffProfile);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  return (
    <>
      <PageHeader title="My profile" description="Contact the registry to change any of these details." actions={<ChangePasswordButton />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg font-medium text-primary-foreground">{initials(data.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{data.fullName}</p>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[data.role]}</p>
            </div>
            <UserStatusBadge status={data.status} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Staff record</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Staff ID", value: data.staffId },
                { label: "Title", value: data.title },
                { label: "Department", value: data.department?.name },
                { label: "Faculty", value: data.faculty?.name },
                { label: "Email", value: data.email },
                { label: "Phone", value: data.phone },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
