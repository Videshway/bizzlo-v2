# Partner Course Catalog

Bizzlo Program Search uses only commissionable partner universities from the uploaded partner PDFs. Non-partner public catalogue rows are not shipped, loaded, or seeded.

## Current Data Files

- `private-data/partner-course-templates.json`: searchable UG/PG programme templates for partner PDF universities. This file is local seed data and is excluded from Vercel deploys.
- `public/data/partner-university-index.json`: partner university eligibility index.

Commission rates and payout values are intentionally excluded.

## Required Course Fields

- `country`
- `university`
- `course`
- `level`

Recommended fields are `city`, `campus`, `subject`, `credential`, `duration`, `mode`, `intake`, `tuition`, `application_fee`, `deadline`, `partner_note`, `eligibility`, `english_requirement`, `academic_requirement`, `scholarship`, `source_url`, `source_name`, `external_course_id`, `source_updated_at`, and `is_verified`.

## Refresh From PDFs

Place updated commissionable partner PDFs in the expected local source folder, then run:

```bash
npm run import:partner-universities
npm run test:catalog-integrations
```

This regenerates:

```bash
public/data/partner-university-index.json
private-data/partner-course-templates.json
```

## Seed Supabase

After Supabase migrations are applied, seed the active course table:

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
npm run seed:supabase-courses
```

The seed script deactivates existing course rows first, then upserts only the partner-PDF catalogue as active. Keep the service-role key server-side/admin-only.

## Production Data Rule

For launch, Program Search should stay partner-only unless Videshway has a clear right to use and display another catalogue. Add new programmes through updated partner PDFs or controlled partner exports, then rerun the refresh and seed commands.
