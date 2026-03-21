create or replace function public.is_customer_for_client(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_links fl
    where fl.customer_user_id = auth.uid()
      and fl.elderly_client_id = client_uuid
  );
$$;

create or replace function public.is_caretaker_for_client(client_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.elderly_clients ec
    where ec.id = client_uuid
      and ec.assigned_caretaker_id = auth.uid()
  );
$$;

create or replace function public.is_thread_participant(thread_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.threads t
    where t.id = thread_uuid
      and (t.customer_id = auth.uid() or t.caretaker_id = auth.uid())
  );
$$;

alter table public.visit_logs add column if not exists incident_flag boolean not null default false;
alter table public.visit_logs add column if not exists checked_in_at timestamptz;
alter table public.visit_logs add column if not exists checked_out_at timestamptz;
alter table public.visit_logs add column if not exists checklist_completed boolean not null default false;
alter table public.visit_logs add column if not exists checklist_items text[] not null default '{}';

alter table public.tasks add column if not exists task_type text not null default 'errand';
alter table public.tasks add column if not exists assigned_to text;

create table if not exists public.care_plans (
  elderly_client_id uuid primary key references public.elderly_clients(id) on delete cascade,
  goals text[] not null default '{}',
  routines text[] not null default '{}',
  restrictions text[] not null default '{}',
  medication_schedule text[] not null default '{}',
  escalation_preferences text not null default '',
  large_text_mode boolean not null default false,
  high_contrast_mode boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.visit_assessments (
  visit_log_id uuid primary key references public.visit_logs(id) on delete cascade,
  mood_score integer check (mood_score between 1 and 5),
  mobility_score integer check (mobility_score between 1 and 5),
  appetite_score integer check (appetite_score between 1 and 5),
  engagement_score integer check (engagement_score between 1 and 5),
  medication_adherence text check (medication_adherence in ('On Track', 'Needs Reminder', 'Missed Dose')),
  home_safety_flag boolean not null default false
);

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  visit_log_id uuid references public.visit_logs(id) on delete set null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  summary text not null,
  actions_taken text not null,
  acknowledged_by_family_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('Low', 'Medium', 'High')),
  summary text not null,
  status text not null default 'Open' check (status in ('Open', 'Monitoring', 'Resolved')),
  triggered_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create table if not exists public.weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  summary text not null,
  concerns text[] not null default '{}',
  next_steps text[] not null default '{}',
  generated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  name text not null,
  relationship text not null,
  email text not null,
  permissions text[] not null default '{}',
  ownership_label text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  title text not null,
  provider text not null,
  scheduled_for timestamptz not null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Confirmed', 'Completed', 'Cancelled')),
  transport_needed boolean not null default false
);

create table if not exists public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  pickup_location text not null,
  dropoff_location text not null,
  scheduled_for timestamptz not null,
  status text not null default 'Requested' check (status in ('Requested', 'Scheduled', 'Completed', 'Cancelled')),
  coordination_notes text
);

create table if not exists public.caretaker_metrics (
  caretaker_id uuid primary key references public.profiles(id) on delete cascade,
  on_time_rate numeric(5,2) not null default 0,
  completion_rate numeric(5,2) not null default 0,
  avg_response_minutes integer not null default 0,
  verified_visit_rate numeric(5,2) not null default 0
);

alter table public.care_plans enable row level security;
alter table public.visit_assessments enable row level security;
alter table public.incident_reports enable row level security;
alter table public.alerts enable row level security;
alter table public.weekly_briefs enable row level security;
alter table public.family_members enable row level security;
alter table public.appointments enable row level security;
alter table public.transport_requests enable row level security;
alter table public.caretaker_metrics enable row level security;

drop policy if exists "visit assessments participant read" on public.visit_assessments;
create policy "visit assessments participant read" on public.visit_assessments
for select using (
  exists (
    select 1 from public.visit_logs vl
    where vl.id = visit_log_id
      and (public.is_customer_for_client(vl.elderly_client_id) or public.is_caretaker_for_client(vl.elderly_client_id))
  )
);

drop policy if exists "visit assessments caretaker insert" on public.visit_assessments;
create policy "visit assessments caretaker insert" on public.visit_assessments
for insert with check (
  exists (
    select 1 from public.visit_logs vl
    where vl.id = visit_log_id and vl.caretaker_id = auth.uid()
  )
);

drop policy if exists "care plans participant read" on public.care_plans;
create policy "care plans participant read" on public.care_plans
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "incidents participant read" on public.incident_reports;
create policy "incidents participant read" on public.incident_reports
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "incidents caretaker insert" on public.incident_reports;
create policy "incidents caretaker insert" on public.incident_reports
for insert with check (public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "alerts participant read" on public.alerts;
create policy "alerts participant read" on public.alerts
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "weekly brief participant read" on public.weekly_briefs;
create policy "weekly brief participant read" on public.weekly_briefs
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "family members participant read" on public.family_members;
create policy "family members participant read" on public.family_members
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "appointments participant read" on public.appointments;
create policy "appointments participant read" on public.appointments
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "transport participant read" on public.transport_requests;
create policy "transport participant read" on public.transport_requests
for select using (public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id));

drop policy if exists "caretaker metrics participant read" on public.caretaker_metrics;
create policy "caretaker metrics participant read" on public.caretaker_metrics
for select using (
  caretaker_id = auth.uid()
  or exists (
    select 1
    from public.elderly_clients ec
    join public.family_links fl on fl.elderly_client_id = ec.id
    where ec.assigned_caretaker_id = caretaker_metrics.caretaker_id
      and fl.customer_user_id = auth.uid()
  )
);
