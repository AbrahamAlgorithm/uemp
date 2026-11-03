"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, CircleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, SortHeader } from "@/components/data-table";
import { DetailList } from "@/components/detail-list";
import { FilterSelect, matches } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { RegistrationStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { api, ApiError, errorMessage } from "@/lib/api";
import { LEVELS, REGISTRATION_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, semesterLabel } from "@/lib/format";
import type { CourseAllocation, OfferingRegistration, RegistrationFormSummary, RegistrationStatus } from "@/lib/types";

const STATUSES: RegistrationStatus[] = ["SUBMITTED", "VALIDATED", "RETURNED"];

export function RegistrationFormsBrowser({ allDepartments = false }: { allDepartments?: boolean }) {
  const { data, error, reload } = useAsync(async () => {
    const semester = await api.getCurrentSemester();
    const [forms, programs, departments, offerings] = await Promise.all([
      api.getRegistrationForms(semester.id),
      api.getPrograms(),
      allDepartments ? api.getDepartments() : Promise.resolve([]),
      api.getOfferings(semester.id),
    ]);
    return { semester, forms, programs, departments, offerings };
  });
  const [tab, setTab] = useState<string>("SUBMITTED");
  const [level, setLevel] = useState("all");
  const [program, setProgram] = useState("all");
  const [department, setDepartment] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const filtered = data.forms.filter(
    (form) =>
      matches(level, form.student.level) &&
      matches(program, form.student.program.id) &&
      matches(department, form.student.department.id),
  );
  const programs = data.programs.filter((item) => matches(department, item.department.id));

  const columns: ColumnDef<RegistrationFormSummary>[] = [
    {
      id: "student",
      accessorFn: (row) => `${row.student.fullName} ${row.student.matricNumber}`,
      header: ({ column }) => <SortHeader column={column} title="Student" />,
      cell: ({ row }) => (
        <div className="min-w-44">
          <p>{row.original.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{row.original.student.matricNumber}</p>
        </div>
      ),
    },
    ...(allDepartments
      ? [{ id: "department", accessorFn: (row: RegistrationFormSummary) => row.student.department.code, header: "Dept" }]
      : []),
    { id: "level", accessorFn: (row) => row.student.level, header: "Level" },
    { id: "program", accessorFn: (row) => row.student.program.name, header: "Program" },
    { accessorKey: "courseCount", header: "Courses" },
    { accessorKey: "totalUnits", header: ({ column }) => <SortHeader column={column} title="Units" /> },
    {
      accessorKey: "submittedAt",
      header: ({ column }) => <SortHeader column={column} title="Submitted" />,
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.submittedAt)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setOpenId(row.original.id)}>
          Open
        </Button>
      ),
    },
  ];

  const filters = (
    <>
      {allDepartments && (
        <FilterSelect
          label="Department"
          value={department}
          onChange={(value) => {
            setDepartment(value);
            setProgram("all");
          }}
          allLabel="All departments"
          options={data.departments.map((item) => ({ value: item.id, label: item.name }))}
        />
      )}
      <FilterSelect
        label="Program"
        value={program}
        onChange={setProgram}
        allLabel="All programs"
        options={programs.map((item) => ({ value: item.id, label: `${item.award} ${item.name}` }))}
      />
      <FilterSelect
        label="Level"
        value={level}
        onChange={setLevel}
        allLabel="All levels"
        options={LEVELS.map((value) => ({ value, label: `${value} level` }))}
      />
    </>
  );

  return (
    <>
      <PageHeader
        title="Registrations"
        description={`${semesterLabel(data.semester)}${allDepartments ? " · all departments" : ""}`}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUSES.map((status) => (
            <TabsTrigger key={status} value={status}>
              {REGISTRATION_STATUS_LABELS[status]}
              <span className="ml-1.5 text-muted-foreground tabular-nums">
                {filtered.filter((form) => form.status === status).length}
              </span>
            </TabsTrigger>
          ))}
          <TabsTrigger value="course">By course</TabsTrigger>
        </TabsList>
        {STATUSES.map((status) => (
          <TabsContent key={status} value={status} className="mt-4">
            <DataTable
              columns={columns}
              data={filtered.filter((form) => form.status === status)}
              toolbar={filters}
              searchPlaceholder="Search name or matric number"
              emptyTitle={`No ${REGISTRATION_STATUS_LABELS[status].toLowerCase()} registrations`}
              emptyDescription="Forms show up here as students submit them."
            />
          </TabsContent>
        ))}
        <TabsContent value="course" className="mt-4">
          <CourseRoster offerings={data.offerings} showDepartment={allDepartments} />
        </TabsContent>
      </Tabs>

      {openId !== null && <RegistrationFormDialog formId={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  );
}

function RegistrationFormDialog({ formId, onClose, onChanged }: { formId: number; onClose: () => void; onChanged: () => void }) {
  const { data: form, error, setData } = useAsync(() => api.getRegistrationForm(formId), formId);
  const [validating, setValidating] = useState(false);
  const [returning, setReturning] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  const validate = async () => {
    setValidating(true);
    try {
      const saved = await api.validateRegistrationForm(formId);
      setData(saved);
      toast.success(`Validated ${saved.student.fullName}'s registration`);
      onChanged();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setValidating(false);
    }
  };

  const sendBack = async (reason: string) => {
    try {
      const saved = await api.returnRegistrationForm(formId, reason);
      setData(saved);
      setBlocked(null);
      toast.success(`Returned to ${saved.student.fullName}`);
      onChanged();
      return true;
    } catch (failure) {
      // scores already entered: keep the form open and say why
      if (failure instanceof ApiError && failure.status === 409) {
        setBlocked(errorMessage(failure));
        return true;
      }
      toast.error(errorMessage(failure));
      return false;
    }
  };

  const canReturn = form?.status === "SUBMITTED" || form?.status === "VALIDATED";

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.student.fullName ?? "Registration form"}</DialogTitle>
            <DialogDescription>
              {form ? `${form.student.matricNumber} · ${semesterLabel(form.semester)}` : "Loading the form"}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          ) : !form ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <DetailList
                items={[
                  { label: "Program", value: `${form.student.program.award} ${form.student.program.name}` },
                  { label: "Level", value: `${form.student.level} level` },
                  { label: "Department", value: form.student.department.name },
                  { label: "Status", value: <RegistrationStatusBadge status={form.status} /> },
                  { label: "Submitted", value: formatDateTime(form.submittedAt) },
                  form.status === "VALIDATED"
                    ? {
                        label: "Validated",
                        value: `${form.validatedAt ? formatDateTime(form.validatedAt) : ""}${form.validatedBy ? ` by ${form.validatedBy.name}` : ""}`,
                      }
                    : { label: "Return reason", value: form.returnReason },
                ]}
              />
              {blocked && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Can&apos;t return this registration</AlertTitle>
                  <AlertDescription>{blocked}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.courses.map((course) => (
                      <TableRow key={course.offeringId}>
                        <TableCell className="font-medium whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            {course.code}
                            {course.isCarryOver && (
                              <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                                Carry-over
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{course.title}</TableCell>
                        <TableCell className="tabular-nums">{course.level}</TableCell>
                        <TableCell className="text-right tabular-nums">{course.units}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{form.totalUnits} units</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            {canReturn && (
              <Button variant="outline" onClick={() => setReturning(true)} disabled={validating}>
                Return to student
              </Button>
            )}
            {form?.status === "SUBMITTED" && (
              <Button onClick={validate} disabled={validating}>
                {validating && <Spinner />}
                Validate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={returning}
        onOpenChange={setReturning}
        title="Return this registration?"
        description="The student sees your reason and can change their courses and submit again."
        confirmLabel="Return to student"
        destructive
        reason={{ label: "Reason", placeholder: "Tell the student what to change", minLength: 3 }}
        onConfirm={sendBack}
      />
    </>
  );
}

function CourseRoster({ offerings, showDepartment }: { offerings: CourseAllocation[]; showDepartment: boolean }) {
  const [offeringId, setOfferingId] = useState("");
  const sorted = [...offerings].sort((a, b) => a.course.code.localeCompare(b.course.code));

  if (sorted.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title="No courses this semester" description="Courses appear here once they're offered." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={offeringId} onValueChange={setOfferingId}>
        <SelectTrigger aria-label="Course" className="w-full rounded-full pl-4 data-[size=default]:h-10 sm:w-96">
          <SelectValue placeholder="Choose a course" />
        </SelectTrigger>
        <SelectContent>
          {sorted.map((offering) => (
            <SelectItem key={offering.allocationId} value={String(offering.allocationId)}>
              {offering.course.code} {offering.course.title}
              {showDepartment && ` · ${offering.course.department.code}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {offeringId ? (
        <Roster key={offeringId} offeringId={Number(offeringId)} />
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Choose a course"
            description="See every student registered on it, from any department, and where their form stands."
          />
        </Card>
      )}
    </div>
  );
}

const rosterColumns: ColumnDef<OfferingRegistration>[] = [
  {
    id: "matric",
    accessorFn: (row) => row.student.matricNumber,
    header: ({ column }) => <SortHeader column={column} title="Matric no" />,
    cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
  },
  { id: "name", accessorFn: (row) => row.student.fullName, header: ({ column }) => <SortHeader column={column} title="Name" /> },
  { id: "department", accessorFn: (row) => row.student.department.code, header: "Dept" },
  { id: "level", accessorFn: (row) => row.student.level, header: "Level" },
  {
    accessorKey: "formStatus",
    header: "Form",
    cell: ({ row }) => <RegistrationStatusBadge status={row.original.formStatus} />,
  },
  {
    accessorKey: "registeredAt",
    header: ({ column }) => <SortHeader column={column} title="Registered" />,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.registeredAt)}</span>,
  },
];

function Roster({ offeringId }: { offeringId: number }) {
  const { data, error, reload } = useAsync(() => api.getOfferingRegistrations(offeringId), offeringId);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-48 w-full rounded-2xl" />;

  return (
    <DataTable
      columns={rosterColumns}
      data={data}
      searchPlaceholder="Search student"
      emptyTitle="No students registered"
      emptyDescription="Nobody has registered for this course yet."
    />
  );
}
