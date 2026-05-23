# Data Deletion

Admin-only Edge Functions:

- `purge-student`
- `purge-organization`

Student purge removes document files from Storage, deletes document metadata, anonymizes the student profile fields, and records a `data_erasure_events` row.

Organization purge anonymizes all students, deletes their document files, disables partner profiles, marks the organization `purged`, and records an erasure event.

Audit and application records are retained in anonymized form for business integrity.

