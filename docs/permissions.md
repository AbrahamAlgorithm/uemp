# Permissions

Four roles, set on the account: `STUDENT`, `LECTURER`, `DEPT_ADMIN` and `SUPER_ADMIN`. Every account also has a status. Only `ACTIVE` accounts can sign in or use the API. A suspended or deactivated account is refused on its next request, even if its access token has not expired.

Department admins belong to one department, and so do students and lecturers. Super admins belong to none (a database constraint enforces this).

## Permission matrix

Cell values: **own** means the signed-in user's own record, **own dept** means records of the user's department, **all** means every department, and a dash means the action is refused (`403`, or `404` for a record outside the user's scope).

### Accounts

| Action | Student | Lecturer | Dept admin | Super admin |
| --- | --- | --- | --- | --- |
| Sign in, sign out, read own profile | own | own | own | own |
| Change own password | own | own | own | own |
| Edit own phone number | own | own | own | own |
| Edit own address and date of birth | own | - | - | - |
| Edit any other profile field | - | - | - | - |
| Create and edit students | - | - | own dept | all |
| Create and edit lecturers | - | - | own dept | all |
| Create or edit another admin, change any role | - | - | - | all |
| Reset another user's password | - | - | students and lecturers in own dept | all |
| Activate, deactivate or suspend an account | - | - | - | all |
| Delete a user, student or staff record | - | - | - | - |
| List all users | - | - | - | all |

### Academic structure

| Action | Student | Lecturer | Dept admin | Super admin |
| --- | --- | --- | --- | --- |
| Faculties and departments: create, edit, delete | - | - | - | all |
| Sessions and semesters: create, edit | - | - | - | all |
| Set the current semester, open or close registration | - | - | - | all |
| Read the semester list | - | - | yes | yes |
| Programs: create, edit, delete | - | - | own dept | all |
| Courses: create, edit, delete | - | - | own dept | all |
| Open a course for a semester and allocate its lecturer | - | - | own dept | all |
| Change a lecturer after the sheet has left DRAFT | - | - | - | - |
| Assign or remove a department's administrators | - | - | - | all |

### Registration

| Action | Student | Lecturer | Dept admin | Super admin |
| --- | --- | --- | --- | --- |
| See courses open to them and submit a registration | own, while the window is open and the form is not validated | - | - | - |
| Download own registration slip | own | - | - | - |
| List and read registration forms | - | - | own dept's students | all |
| Validate or return a form | - | - | own dept's students | all |
| Read the class list of a course | - | own offerings | own dept's courses | all |

### Results

| Action | Student | Lecturer | Dept admin | Super admin |
| --- | --- | --- | --- | --- |
| Enter, save, import and submit scores | - | own offerings, while DRAFT or REJECTED | - | - |
| Read a result sheet | - | own offerings | own dept's courses | all |
| Approve or reject a submitted sheet | - | - | own dept's courses | - |
| Reopen an approved sheet | - | - | own dept's courses | all |
| See own results, CGPA, statement | own, approved results only | - | - | - |
| See a student's record and results | - | - | own dept's students | all |
| Read the grading scale | yes | yes | yes | yes |
| Change or reset the grading scale | - | - | - | all |

### Reports and oversight

| Action | Student | Lecturer | Dept admin | Super admin |
| --- | --- | --- | --- | --- |
| Own dashboard | yes | yes | yes | yes |
| Student list, registrations, performance, at-risk reports | - | - | own dept | all, or one with `?department=` |
| Compare departments report | - | - | - | all |
| Download a report as CSV | - | - | own dept | all |
| Read the audit log | - | - | - | all |
| Read the department activity feed | - | - | own dept | - |

## How it is enforced

The rules live in the API. The frontend hides links a role cannot use, and its middleware redirects people to their own area, but neither is relied on.

1. **Default permissions.** Every endpoint requires an authenticated, `ACTIVE` user (`IsActiveUser` in `core/permissions.py`, set in `REST_FRAMEWORK`). Public endpoints (`health`, `auth/csrf`, `auth/login`, `auth/refresh`, `auth/logout`) opt out explicitly.
2. **Role permission classes.** `HasRole(...)` names the roles an endpoint accepts. `IsStudent`, `IsLecturer`, `IsDeptAdmin` and `IsSuperAdmin` are shorthand for single roles, and `MANAGERS` is the pair of admin roles. Some actions override the viewset default, for example approve and reject accept only `DEPT_ADMIN`.
3. **Scoped querysets.** `DepartmentScopedQuerysetMixin` (`core/scoping.py`) filters a viewset's queryset to the user's department. Each viewset names its department path (`program__department` for students, `course__department` for offerings and result sheets, `student__program__department` for registration forms). Because the filter is applied before the object is looked up, a record in another department does not exist as far as the caller can tell.
4. **Object checks.** Where scope is by owner and not by department, the query itself is the check. A lecturer's offerings are `CourseOffering.objects.filter(lecturer__user=request.user)`, and a student's data is read from `request.user.student_profile`, so a user can't name someone else's id.
5. **Service-layer state checks.** Services refuse transitions the state does not allow (approving a draft, editing a validated registration, changing the lecturer after submission) with `409`.
6. **Field rules on self-service.** `PATCH /api/auth/me/profile/` accepts a fixed set of fields per role and answers `400 "This field can only be changed by an administrator."` for anything else. Roles never change through the staff or student endpoints, only through the users endpoint.

### 404 or 403

- **404** when the record is outside the caller's scope: another department's student or sheet, another lecturer's offering. Saying "forbidden" would confirm that the record exists.
- **403** when the caller's role can never do the action: a student on an admin endpoint, a super admin trying to approve a sheet.
- **401** when there is no valid session.
- **409** when the action is allowed but the record is in the wrong state.

## Separation of duties

- **A lecturer cannot publish their own marks.** The lecturer enters and submits. A department admin approves or rejects. These are different roles on different endpoints.
- **The department that owns the course approves its results.** For a borrowed course such as MTH 301 taken by Computer Science students, the Mathematics admin approves the sheet, and the Computer Science admin cannot see it. Registration is the other way round: a student's own department validates their form, including the borrowed courses on it.
- **The super admin can reopen but not approve.** The registry can send an approved sheet back for correction. It cannot publish a result or reject one. Reopening requires a reason and is audited.
- **Only the super admin changes roles and accounts.** A department admin can create lecturers and students in their own department, but cannot create, promote or demote an admin, change a status, or see other admins in the staff list.
- **Accounts are never deleted.** They are deactivated or suspended, so the audit trail always points at a real account.
- **Everyone leaves a trail.** Each create, update, transition and sign-in writes an audit row with the actor, the department, before and after values and the client address. The audit log is readable by the super admin only.
