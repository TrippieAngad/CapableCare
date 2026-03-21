update public.profiles
set
  name = case
    when id = (select id from auth.users where email = 'family.capablecare@example.com') then 'Nina Carter'
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then 'Jordan Lee'
    else name
  end,
  phone = case
    when id = (select id from auth.users where email = 'family.capablecare@example.com') then '(401) 555-0101'
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then '(401) 555-0172'
    else phone
  end,
  avatar = case
    when id = (select id from auth.users where email = 'family.capablecare@example.com') then 'NC'
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then 'JL'
    else avatar
  end,
  bio = case
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then 'Community-based caretaker focused on routine support, medication reminders, and social engagement.'
    else bio
  end,
  verified = case
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then true
    else verified
  end,
  rating = case
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then 4.9
    else rating
  end,
  assigned_since = case
    when id = (select id from auth.users where email = 'caretaker.capablecare@example.com') then '2025-11-08'::date
    else assigned_since
  end
where id in (
  (select id from auth.users where email = 'family.capablecare@example.com'),
  (select id from auth.users where email = 'caretaker.capablecare@example.com')
);

insert into public.family_members (elderly_client_id, name, relationship, email, permissions, ownership_label)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Nina Carter',
  'Daughter',
  'family.capablecare@example.com',
  array['view_updates', 'manage_tasks', 'contact_support'],
  'Primary family owner'
where exists (select 1 from public.elderly_clients where full_name = 'Elaine Carter')
  and not exists (select 1 from public.family_members where email = 'family.capablecare@example.com');

insert into public.family_members (elderly_client_id, name, relationship, email, permissions, ownership_label)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Marcus Carter',
  'Grandson',
  'marcus.carter@example.com',
  array['view_updates', 'coordinate_transport'],
  'Transportation backup'
where exists (select 1 from public.elderly_clients where full_name = 'Elaine Carter')
  and not exists (select 1 from public.family_members where email = 'marcus.carter@example.com');

insert into public.elderly_clients (
  full_name,
  dob,
  address,
  health_conditions,
  medications,
  special_instructions,
  transportation_flag,
  assigned_caretaker_id,
  subscription_tier_id,
  assigned_since,
  emergency_contacts
)
select
  'Elaine Carter',
  '1945-08-19'::date,
  '18 Harbor View Ave, Providence, RI',
  array['Type 2 diabetes', 'Mild arthritis', 'Uses walker for long distances'],
  array['Metformin', 'Lisinopril', 'Vitamin D'],
  'Prefers lunch at noon, enjoys short outdoor walks, and needs reminders to hydrate.',
  true,
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  'plan-standard',
  '2025-11-08'::date,
  '[{"name":"Nina Carter","relationship":"Daughter","phone":"(401) 555-0101","email":"family.capablecare@example.com"}]'::jsonb
where not exists (
  select 1 from public.elderly_clients where full_name = 'Elaine Carter'
);

insert into public.family_links (customer_user_id, elderly_client_id, relationship)
select
  (select id from auth.users where email = 'family.capablecare@example.com'),
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Daughter'
where not exists (
  select 1 from public.family_links
  where customer_user_id = (select id from auth.users where email = 'family.capablecare@example.com')
    and elderly_client_id = (select id from public.elderly_clients where full_name = 'Elaine Carter')
);

insert into public.subscriptions (customer_id, plan_id, started_at)
select
  (select id from auth.users where email = 'family.capablecare@example.com'),
  'plan-standard',
  '2025-11-08'::date
on conflict (customer_id) do update
set plan_id = excluded.plan_id, started_at = excluded.started_at;

insert into public.scheduled_visits (elderly_client_id, starts_at, type)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  '2026-03-22T14:00:00Z'::timestamptz,
  'in-person'
where not exists (
  select 1 from public.scheduled_visits
  where elderly_client_id = (select id from public.elderly_clients where full_name = 'Elaine Carter')
    and starts_at = '2026-03-22T14:00:00Z'::timestamptz
);

insert into public.scheduled_visits (elderly_client_id, starts_at, type)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  '2026-03-25T17:30:00Z'::timestamptz,
  'virtual'
where not exists (
  select 1 from public.scheduled_visits
  where elderly_client_id = (select id from public.elderly_clients where full_name = 'Elaine Carter')
    and starts_at = '2026-03-25T17:30:00Z'::timestamptz
);

insert into public.visit_logs (elderly_client_id, caretaker_id, visit_type, status, notes, photo_url, emergency_flag, created_at)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  'in-person',
  'Good',
  'Reviewed medication box, prepared lunch, and took a 15-minute walk. Energy level was strong and mood was upbeat.',
  null,
  false,
  '2026-03-20T16:30:00Z'::timestamptz
where not exists (
  select 1 from public.visit_logs where notes like 'Reviewed medication box%'
);

update public.visit_logs
set
  incident_flag = false,
  checked_in_at = '2026-03-20T16:00:00Z'::timestamptz,
  checked_out_at = '2026-03-20T16:55:00Z'::timestamptz,
  checklist_completed = true,
  checklist_items = array['Medication review', 'Lunch prep', 'Mobility walk', 'Hydration reminder']
where notes like 'Reviewed medication box%';

insert into public.visit_logs (elderly_client_id, caretaker_id, visit_type, status, notes, photo_url, emergency_flag, created_at)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  'virtual',
  'Needs Attention',
  'Noticed light swelling in the right ankle during the check-in. Advised extra rest and flagged for family monitoring.',
  'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=900&q=80',
  false,
  '2026-03-21T09:15:00Z'::timestamptz
where not exists (
  select 1 from public.visit_logs where notes like 'Noticed light swelling%'
);

update public.visit_logs
set
  incident_flag = true,
  checked_in_at = '2026-03-21T09:00:00Z'::timestamptz,
  checked_out_at = '2026-03-21T09:20:00Z'::timestamptz,
  checklist_completed = true,
  checklist_items = array['Virtual check-in', 'Medication reminder', 'Symptom review']
where notes like 'Noticed light swelling%';

insert into public.visit_assessments (visit_log_id, mood_score, mobility_score, appetite_score, engagement_score, medication_adherence, home_safety_flag)
select id, 4, 4, 4, 5, 'On Track', false
from public.visit_logs
where notes like 'Reviewed medication box%'
on conflict (visit_log_id) do update
set mood_score = excluded.mood_score,
    mobility_score = excluded.mobility_score,
    appetite_score = excluded.appetite_score,
    engagement_score = excluded.engagement_score,
    medication_adherence = excluded.medication_adherence,
    home_safety_flag = excluded.home_safety_flag;

insert into public.visit_assessments (visit_log_id, mood_score, mobility_score, appetite_score, engagement_score, medication_adherence, home_safety_flag)
select id, 3, 2, 3, 3, 'Needs Reminder', true
from public.visit_logs
where notes like 'Noticed light swelling%'
on conflict (visit_log_id) do update
set mood_score = excluded.mood_score,
    mobility_score = excluded.mobility_score,
    appetite_score = excluded.appetite_score,
    engagement_score = excluded.engagement_score,
    medication_adherence = excluded.medication_adherence,
    home_safety_flag = excluded.home_safety_flag;

insert into public.incident_reports (elderly_client_id, visit_log_id, severity, summary, actions_taken, acknowledged_by_family_at, created_at)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from public.visit_logs where notes like 'Noticed light swelling%' limit 1),
  'Medium',
  'Right ankle swelling was observed during the virtual check-in.',
  'Family notified, additional rest recommended, and in-person follow-up requested for the next visit.',
  null,
  '2026-03-21T09:16:00Z'::timestamptz
where not exists (
  select 1 from public.incident_reports where summary like 'Right ankle swelling was observed%'
);

insert into public.alerts (elderly_client_id, type, severity, summary, status, triggered_at)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Mobility decline',
  'Medium',
  'Mobility score dropped between the last two structured visits.',
  'Monitoring',
  '2026-03-21T09:18:00Z'::timestamptz
where not exists (
  select 1 from public.alerts where summary like 'Mobility score dropped%'
);

insert into public.weekly_briefs (elderly_client_id, summary, concerns, next_steps, generated_at)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Elaine remained socially engaged this week, but mobility confidence and ankle swelling require follow-up.',
  array['Monitor ankle swelling during the next in-person visit', 'Confirm medication adherence after afternoon reminder'],
  array['Reassess mobility in the next visit', 'Coordinate transportation for the Thursday activity', 'Share a short recap with the family circle'],
  '2026-03-21T10:00:00Z'::timestamptz
where not exists (
  select 1 from public.weekly_briefs where summary like 'Elaine remained socially engaged this week%'
);

insert into public.care_plans (
  elderly_client_id,
  goals,
  routines,
  restrictions,
  medication_schedule,
  escalation_preferences,
  large_text_mode,
  high_contrast_mode
)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  array['Maintain mobility for neighborhood walks', 'Keep medication adherence above 90%', 'Support weekly social participation'],
  array['Lunch at noon', 'Afternoon hydration reminder', 'Short walk after meals when safe'],
  array['Avoid stairs without assistance', 'Monitor for swelling after long activity'],
  array['Metformin at breakfast', 'Lisinopril in the morning', 'Vitamin D with lunch'],
  'Text daughter immediately for urgent issues and log non-urgent changes in the weekly brief.',
  true,
  true
where not exists (
  select 1 from public.care_plans where elderly_client_id = (select id from public.elderly_clients where full_name = 'Elaine Carter')
);

insert into public.caretaker_metrics (caretaker_id, on_time_rate, completion_rate, avg_response_minutes, verified_visit_rate)
select
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  96.00,
  94.00,
  18,
  100.00
where not exists (
  select 1 from public.caretaker_metrics where caretaker_id = (select id from auth.users where email = 'caretaker.capablecare@example.com')
);

insert into public.threads (customer_id, caretaker_id, elderly_client_id)
select
  (select id from auth.users where email = 'family.capablecare@example.com'),
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  (select id from public.elderly_clients where full_name = 'Elaine Carter')
where not exists (
  select 1 from public.threads
  where customer_id = (select id from auth.users where email = 'family.capablecare@example.com')
    and elderly_client_id = (select id from public.elderly_clients where full_name = 'Elaine Carter')
);

insert into public.messages (thread_id, sender_id, content, created_at)
select
  t.id,
  (select id from auth.users where email = 'caretaker.capablecare@example.com'),
  'Finished today''s virtual check-in. I added a note to the feed about Elaine''s ankle so you can keep an eye on it.',
  '2026-03-21T09:20:00Z'::timestamptz
from public.threads t
where t.customer_id = (select id from auth.users where email = 'family.capablecare@example.com')
  and not exists (select 1 from public.messages where content like 'Finished today''s virtual check-in%');

insert into public.messages (thread_id, sender_id, content, created_at)
select
  t.id,
  (select id from auth.users where email = 'family.capablecare@example.com'),
  'Thanks. Please let me know after the in-person visit tomorrow if the swelling changes.',
  '2026-03-21T09:27:00Z'::timestamptz
from public.threads t
where t.customer_id = (select id from auth.users where email = 'family.capablecare@example.com')
  and not exists (select 1 from public.messages where content like 'Thanks. Please let me know after the in-person visit tomorrow%');

insert into public.tasks (elderly_client_id, submitted_by, title, description, priority, status, due_date)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from auth.users where email = 'family.capablecare@example.com'),
  'Pick up refill at CVS',
  'Metformin refill is ready after 3 PM.',
  'High',
  'In Progress',
  '2026-03-22'::date
where not exists (
  select 1 from public.tasks where title = 'Pick up refill at CVS'
);

update public.tasks
set task_type = 'errand', assigned_to = 'caretaker'
where title = 'Pick up refill at CVS';

insert into public.tasks (elderly_client_id, submitted_by, title, description, priority, status, due_date)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from auth.users where email = 'family.capablecare@example.com'),
  'Schedule senior center ride',
  'Coordinate transportation for Thursday''s 10 AM activity.',
  'Medium',
  'Submitted',
  '2026-03-24'::date
where not exists (
  select 1 from public.tasks where title = 'Schedule senior center ride'
);

update public.tasks
set task_type = 'transport', assigned_to = 'transportation backup'
where title = 'Schedule senior center ride';

insert into public.appointments (elderly_client_id, title, provider, scheduled_for, status, transport_needed)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  'Thursday senior center visit',
  'Elm Street Senior Center',
  '2026-03-26T10:00:00Z'::timestamptz,
  'Confirmed',
  true
where not exists (
  select 1 from public.appointments where title = 'Thursday senior center visit'
);

insert into public.transport_requests (elderly_client_id, appointment_id, pickup_location, dropoff_location, scheduled_for, status, coordination_notes)
select
  (select id from public.elderly_clients where full_name = 'Elaine Carter'),
  (select id from public.appointments where title = 'Thursday senior center visit'),
  '18 Harbor View Ave, Providence, RI',
  'Elm Street Senior Center',
  '2026-03-26T09:15:00Z'::timestamptz,
  'Scheduled',
  'Marcus will confirm driver availability the night before.'
where not exists (
  select 1 from public.transport_requests where coordination_notes like 'Marcus will confirm driver availability%'
);

insert into public.support_tickets (customer_id, category, description, status, created_at)
select
  (select id from auth.users where email = 'family.capablecare@example.com'),
  'Billing',
  'Need a copy of the most recent invoice for reimbursement paperwork.',
  'In Review',
  '2026-03-18T13:45:00Z'::timestamptz
where not exists (
  select 1 from public.support_tickets where description like 'Need a copy of the most recent invoice%'
);
