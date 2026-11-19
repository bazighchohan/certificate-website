-- Migration: Add source and note columns to public.attendees
-- Run this in your Supabase SQL editor.

alter table public.attendees 
  add column if not exists source text not null default 'csv' check (source in ('csv', 'manual')),
  add column if not exists note text;

-- Add index on roll_no for faster grouping and lookups if not already created
create index if not exists idx_attendees_roll_no on public.attendees (roll_no);
