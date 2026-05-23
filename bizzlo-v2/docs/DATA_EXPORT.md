# Data Export

Admin-only Edge Function: `export-organization-data`.

Input:

```json
{ "organization_id": "uuid" }
```

Output is a JSON attachment containing organization-owned students, applications, document metadata with 7-day signed URLs, commissions, and audit events.

Only Videshway admin can call this function. Treat generated exports as confidential.

