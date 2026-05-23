-- Application workflow enum values.
-- Keep enum changes isolated so migration runners that wrap DDL in transactions
-- do not mix ALTER TYPE with unrelated table changes.

alter type public.application_status add value if not exists 'offer_received';
alter type public.application_status add value if not exists 'offer_rejected';
alter type public.application_status add value if not exists 'cas_issued';
alter type public.application_status add value if not exists 'visa_granted';
