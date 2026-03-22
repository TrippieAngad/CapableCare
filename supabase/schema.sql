create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('customer', 'caretaker')),
  name text not null,
  phone text,
  avatar text,
  bio text,
  verified boolean default false,
  rating numeric(2,1),
  assigned_since date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  price_monthly integer not null,
  visit_frequency text not null,
  update_frequency text not null,
  features jsonb not null default '{}'::jsonb
);

create table if not exists public.elderly_clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  dob date not null,
  address text not null,
  health_conditions text[] not null default '{}',
  medications text[] not null default '{}',
  special_instructions text default '',
  transportation_flag boolean not null default false,
  assigned_caretaker_id uuid references public.profiles(id) on delete set null,
  subscription_tier_id text references public.subscription_plans(id) on delete set null,
  assigned_since date,
  emergency_contacts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  relationship text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_user_id, elderly_client_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id) on delete restrict,
  started_at date not null default current_date
);

create table if not exists public.scheduled_visits (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  starts_at timestamptz not null,
  type text not null check (type in ('in-person', 'virtual', 'errand run')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.visit_logs (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  caretaker_id uuid not null references public.profiles(id) on delete cascade,
  visit_type text not null check (visit_type in ('in-person', 'virtual', 'errand run')),
  status text not null check (status in ('Good', 'Needs Attention', 'Urgent')),
  notes text not null,
  photo_url text,
  emergency_flag boolean not null default false,
  incident_flag boolean not null default false,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  checklist_completed boolean not null default false,
  checklist_items text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  caretaker_id uuid not null references public.profiles(id) on delete cascade,
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (customer_id, elderly_client_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  attachment_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid not null references public.elderly_clients(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  task_type text not null default 'errand',
  assigned_to text,
  priority text not null check (priority in ('Low', 'Medium', 'High')),
  status text not null default 'Submitted' check (status in ('Submitted', 'In Progress', 'Completed')),
  due_date date not null,
  completion_notes text,
  created_at timestamptz not null default timezone('utc', now())
);

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

create table if not exists public.document_sources (
  id uuid primary key default gen_random_uuid(),
  elderly_client_id uuid references public.elderly_clients(id) on delete cascade,
  title text not null,
  source_kind text not null default 'pdf' check (source_kind in ('pdf', 'guide', 'note')),
  source_scope text not null default 'global' check (source_scope in ('global', 'client')),
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.document_sources(id) on delete cascade,
  elderly_client_id uuid references public.elderly_clients(id) on delete cascade,
  chunk_index integer not null,
  heading text,
  content text not null,
  embedding jsonb not null,
  token_estimate integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_id, chunk_index)
);

create index if not exists document_sources_scope_client_idx
  on public.document_sources (source_scope, elderly_client_id, created_at desc);

create index if not exists document_chunks_source_idx
  on public.document_chunks (source_id, chunk_index);

create index if not exists document_chunks_client_idx
  on public.document_chunks (elderly_client_id, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('Billing', 'Caretaker Concern', 'Technical', 'Other')),
  description text not null,
  attachment_url text,
  status text not null default 'Open' check (status in ('Open', 'In Review', 'Resolved')),
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, phone, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'customer'),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    upper(left(coalesce(new.raw_user_meta_data ->> 'name', new.email), 1))
  )
  on conflict (id) do update
  set
    role = excluded.role,
    name = excluded.name,
    phone = excluded.phone;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.elderly_clients enable row level security;
alter table public.family_links enable row level security;
alter table public.subscriptions enable row level security;
alter table public.scheduled_visits enable row level security;
alter table public.visit_logs enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.support_tickets enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.care_plans enable row level security;
alter table public.visit_assessments enable row level security;
alter table public.incident_reports enable row level security;
alter table public.alerts enable row level security;
alter table public.weekly_briefs enable row level security;
alter table public.family_members enable row level security;
alter table public.appointments enable row level security;
alter table public.transport_requests enable row level security;
alter table public.caretaker_metrics enable row level security;
alter table public.document_sources enable row level security;
alter table public.document_chunks enable row level security;

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

create policy "profiles self read" on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1 from public.family_links fl
    join public.elderly_clients ec on ec.id = fl.elderly_client_id
    where fl.customer_user_id = auth.uid() and ec.assigned_caretaker_id = profiles.id
  )
  or exists (
    select 1 from public.family_links fl
    where fl.elderly_client_id in (
      select elderly_client_id from public.threads t where t.caretaker_id = auth.uid()
    ) and fl.customer_user_id = profiles.id
  )
);

create policy "profiles self update" on public.profiles
for update using (id = auth.uid());

create policy "plans public read" on public.subscription_plans
for select using (true);

create policy "clients customer or caretaker read" on public.elderly_clients
for select using (
  public.is_customer_for_client(id) or public.is_caretaker_for_client(id)
);

create policy "clients customer update subscription" on public.elderly_clients
for update using (public.is_customer_for_client(id) or public.is_caretaker_for_client(id));

create policy "family links owner read" on public.family_links
for select using (customer_user_id = auth.uid());

create policy "subscriptions owner read" on public.subscriptions
for select using (customer_id = auth.uid());

create policy "subscriptions owner write" on public.subscriptions
for insert with check (customer_id = auth.uid());

create policy "subscriptions owner update" on public.subscriptions
for update using (customer_id = auth.uid());

create policy "scheduled visits participant read" on public.scheduled_visits
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "visit logs participant read" on public.visit_logs
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "visit logs caretaker insert" on public.visit_logs
for insert with check (
  caretaker_id = auth.uid() and public.is_caretaker_for_client(elderly_client_id)
);

create policy "visit assessments participant read" on public.visit_assessments
for select using (
  exists (
    select 1
    from public.visit_logs vl
    where vl.id = visit_log_id
      and (public.is_customer_for_client(vl.elderly_client_id) or public.is_caretaker_for_client(vl.elderly_client_id))
  )
);

create policy "visit assessments caretaker insert" on public.visit_assessments
for insert with check (
  exists (
    select 1
    from public.visit_logs vl
    where vl.id = visit_log_id
      and vl.caretaker_id = auth.uid()
  )
);

create policy "threads participant read" on public.threads
for select using (
  customer_id = auth.uid() or caretaker_id = auth.uid()
);

create policy "threads participant insert" on public.threads
for insert with check (
  customer_id = auth.uid() or caretaker_id = auth.uid()
);

create policy "messages participant read" on public.messages
for select using (public.is_thread_participant(thread_id));

create policy "messages participant insert" on public.messages
for insert with check (
  sender_id = auth.uid() and public.is_thread_participant(thread_id)
);

create policy "tasks participant read" on public.tasks
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "tasks customer insert" on public.tasks
for insert with check (
  submitted_by = auth.uid() and public.is_customer_for_client(elderly_client_id)
);

create policy "tasks caretaker update" on public.tasks
for update using (public.is_caretaker_for_client(elderly_client_id));

create policy "tickets owner read" on public.support_tickets
for select using (customer_id = auth.uid());

create policy "tickets owner insert" on public.support_tickets
for insert with check (customer_id = auth.uid());

create policy "care plans participant read" on public.care_plans
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "incidents participant read" on public.incident_reports
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "incidents caretaker insert" on public.incident_reports
for insert with check (public.is_caretaker_for_client(elderly_client_id));

create policy "alerts participant read" on public.alerts
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "weekly brief participant read" on public.weekly_briefs
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "family members participant read" on public.family_members
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "appointments participant read" on public.appointments
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

create policy "transport participant read" on public.transport_requests
for select using (
  public.is_customer_for_client(elderly_client_id) or public.is_caretaker_for_client(elderly_client_id)
);

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

create policy "document sources participant read" on public.document_sources
for select using (
  elderly_client_id is null
  or public.is_customer_for_client(elderly_client_id)
  or public.is_caretaker_for_client(elderly_client_id)
);

create policy "document chunks participant read" on public.document_chunks
for select using (
  elderly_client_id is null
  or public.is_customer_for_client(elderly_client_id)
  or public.is_caretaker_for_client(elderly_client_id)
);

insert into public.subscription_plans (id, name, price_monthly, visit_frequency, update_frequency, features)
values
  ('plan-basic', 'Basic', 79, '1 weekly visit', 'Weekly family update', '{"virtual_check_ins": true, "errand_assistance": false, "transportation_coordination": false, "direct_messaging": true, "priority_support": false}'),
  ('plan-standard', 'Standard', 149, '2 weekly visits', 'Twice-weekly family updates', '{"virtual_check_ins": true, "errand_assistance": true, "transportation_coordination": false, "direct_messaging": true, "priority_support": false}'),
  ('plan-premium', 'Premium', 249, '4+ weekly visits', 'Daily family updates', '{"virtual_check_ins": true, "errand_assistance": true, "transportation_coordination": true, "direct_messaging": true, "priority_support": true}')
on conflict (id) do update
set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  visit_frequency = excluded.visit_frequency,
  update_frequency = excluded.update_frequency,
  features = excluded.features;

insert into storage.buckets (id, name, public)
values
  ('visit-photos', 'visit-photos', false),
  ('message-attachments', 'message-attachments', false),
  ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;
