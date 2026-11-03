# Database Design

PostgreSQL 16. Every table has a `bigint` id and `created_at` / `updated_at` from `core.models.TimeStampedModel` (the audit log keeps only `created_at`). Foreign keys between academic records use `PROTECT`, so a row that is still referenced can't be deleted.

## Entity-relationship diagram

```mermaid
erDiagram
    FACULTY ||--o{ DEPARTMENT : contains
    DEPARTMENT ||--o{ PROGRAM : runs
    DEPARTMENT ||--o{ COURSE : owns
    DEPARTMENT |o--o{ USER : "belongs to"
    ACADEMIC_SESSION ||--o{ SEMESTER : "split into"
    USER ||--o| STUDENT_PROFILE : has
    USER ||--o| STAFF_PROFILE : has
    PROGRAM ||--o{ STUDENT_PROFILE : enrols
    ACADEMIC_SESSION |o--o{ STUDENT_PROFILE : "entry session"
    PROGRAM }o--o{ COURSE : "offered to"
    COURSE ||--o{ COURSE_OFFERING : "runs as"
    SEMESTER ||--o{ COURSE_OFFERING : schedules
    STAFF_PROFILE |o--o{ COURSE_OFFERING : teaches
    STUDENT_PROFILE ||--o{ SEMESTER_REGISTRATION : submits
    SEMESTER ||--o{ SEMESTER_REGISTRATION : "registered in"
    USER |o--o{ SEMESTER_REGISTRATION : validates
    SEMESTER_REGISTRATION ||--o{ COURSE_REGISTRATION : lists
    STUDENT_PROFILE ||--o{ COURSE_REGISTRATION : makes
    COURSE_OFFERING ||--o{ COURSE_REGISTRATION : takes
    COURSE_OFFERING ||--|| RESULT_SHEET : "graded on"
    COURSE_REGISTRATION ||--o| RESULT_ENTRY : "scored in"
    USER |o--o{ RESULT_SHEET : "submits / reviews"
    USER |o--o{ AUDIT_LOG : performs
    DEPARTMENT |o--o{ AUDIT_LOG : scopes

    FACULTY {
        bigint id PK
        varchar name
        varchar code UK
    }
    DEPARTMENT {
        bigint id PK
        bigint faculty_id FK
        varchar name
        varchar code UK
    }
    PROGRAM {
        bigint id PK
        bigint department_id FK
        varchar name "unique per department"
        varchar award "B.Sc., B.Eng."
        smallint duration_years "4 to 6"
    }
    ACADEMIC_SESSION {
        bigint id PK
        varchar name UK "2026/2027"
        date start_date
        date end_date
    }
    SEMESTER {
        bigint id PK
        bigint session_id FK
        varchar term "FIRST or SECOND"
        bool is_current "at most one true"
        bool registration_open "the registration window"
    }
    USER {
        bigint id PK
        varchar email UK
        varchar role
        varchar status
        bigint department_id FK "null only for SUPER_ADMIN"
    }
    STUDENT_PROFILE {
        bigint id PK
        bigint user_id FK, UK
        varchar matric_no UK
        bigint program_id FK
        smallint level "100 to 500"
        varchar gender "M or F"
        date date_of_birth
        bigint entry_session_id FK "nullable"
        varchar phone
        varchar address
    }
    STAFF_PROFILE {
        bigint id PK
        bigint user_id FK, UK
        varchar staff_id UK
        varchar title
        varchar phone
    }
    COURSE {
        bigint id PK
        bigint department_id FK
        varchar code UK
        varchar title
        smallint units "1 to 6"
        smallint level "100 to 500"
        varchar semester_term "FIRST or SECOND"
    }
    COURSE_OFFERING {
        bigint id PK
        bigint course_id FK
        bigint semester_id FK
        bigint lecturer_id FK "staff with role LECTURER"
    }
    SEMESTER_REGISTRATION {
        bigint id PK
        bigint student_id FK
        bigint semester_id FK
        varchar status "SUBMITTED, VALIDATED, RETURNED"
        timestamptz submitted_at
        bigint validated_by_id FK "nullable"
        timestamptz validated_at
        text return_reason
    }
    COURSE_REGISTRATION {
        bigint id PK
        bigint student_id FK
        bigint offering_id FK
        bigint semester_registration_id FK
    }
    GRADE_SCALE {
        bigint id PK
        smallint min_score
        smallint max_score
        varchar grade
        decimal point
    }
    RESULT_SHEET {
        bigint id PK
        bigint offering_id FK, UK
        varchar status "DRAFT, SUBMITTED, APPROVED, REJECTED"
        bigint submitted_by_id FK
        timestamptz submitted_at
        bigint reviewed_by_id FK
        timestamptz reviewed_at
        text feedback
    }
    RESULT_ENTRY {
        bigint id PK
        bigint registration_id FK, UK
        decimal ca_score "0 to 40, nullable"
        decimal exam_score "0 to 60, nullable"
        decimal total "null until submitted"
        varchar grade
        decimal grade_point
    }
    AUDIT_LOG {
        bigint id PK
        bigint actor_id FK "nullable"
        varchar actor_email
        varchar action
        varchar entity_type
        varchar entity_id
        varchar target
        varchar details
        bigint department_id FK "nullable"
        jsonb before
        jsonb after
        inet ip_address
        timestamptz created_at
    }
```

## Tables

- `academics_faculty`: top level of the university structure; `code` is unique.
- `academics_department`: a department inside a faculty; `code` is unique.
- `academics_program`: a degree programme run by a department, with its award such as B.Sc. or B.Eng.; `(department, name)` is unique and `duration_years` is between 4 and 6.
- `academics_academicsession`: an academic year such as `2026/2027`, with optional start and end dates; `name` is unique.
- `academics_semester`: the FIRST or SECOND term of a session; `(session, term)` is unique, and a partial unique index on `is_current = true` allows only one current semester. `registration_open` is the registration window that students need open to submit.
- `accounts_user`: the sign-in account for every role; `email` is unique and `department` is null if and only if `role = SUPER_ADMIN` (a check constraint). Accounts are never deleted, only set to ACTIVE, INACTIVE or SUSPENDED.
- `accounts_studentprofile`: student details, one per user and deleted with it; `matric_no` is unique, `level` is one of 100, 200, 300, 400, 500, the department is read through `program`, and gender (M or F), date of birth and `entry_session` are optional. `entry_session` is a protected reference to the session the student started in.
- `accounts_staffprofile`: staff details (staff ID, title, phone) for lecturers, department admins and super admins, one per user and deleted with it; `staff_id` is unique and is one of the identifiers accepted at sign-in.
- `courses_course`: a catalogue course owned by a department; `code` is unique, `units` is 1 to 6, `level` is one of 100 to 500, and `semester_term` is FIRST or SECOND.
- `courses_course_programs`: join table for the programmes a course is offered to.
- `courses_courseoffering`: a course running in a given semester; `(course, semester)` is unique, `lecturer` must be a staff profile whose user is a LECTURER (checked in `clean()` and `courses.services.assign_lecturer`, not by the database) and is set to null if the profile is deleted, and saving a new offering creates its result sheet.
- `registrations_semesterregistration`: one form per student per semester, `(student, semester)` unique, with a `status` of SUBMITTED, VALIDATED or RETURNED. Only VALIDATED forms put a student on a class list. It records who validated it and when, and the reason when a form is returned.
- `registrations_courseregistration`: a course on a student's form; `(student, offering)` is unique and `semester_registration` points at the form it belongs to. The service keeps the student and semester in step with the form, because the database can't check across tables. The 24-unit cap (`MAX_UNITS_PER_SEMESTER`) is checked in application code.
- `results_gradescale`: maps a score band to a grade and grade point; `0 <= min_score <= max_score <= 100`.
- `results_resultsheet`: one per offering, created as DRAFT when the offering is created; `status` is indexed, and the submitter and reviewer are nullable references to users that can't be deleted while referenced.
- `results_resultentry`: a student's score for one registration, at most one per registration. `ca_score` (0 to 40) and `exam_score` (0 to 60) are each nullable, so a lecturer can save CA only, exam only, both or neither. `total`, `grade` and `grade_point` stay null until the sheet is submitted, when blank scores count as 0.
- `audit_auditlog`: an append-only record of who changed what, with display text in `target` and `details` and an optional `department` for department-level activity feeds; indexed on `(entity_type, entity_id)` and on `created_at`. `actor` and `department` are set to null when their row is deleted, while `actor_email` keeps the name, and it is read-only in the admin.
- `token_blacklist_outstandingtoken` and `token_blacklist_blacklistedtoken`: SimpleJWT's record of issued refresh tokens and the ones revoked by rotation or sign-out.
