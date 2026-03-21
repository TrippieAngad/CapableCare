import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "customer" | "caretaker";
export type ConfidenceStatus = "Stable" | "Watch" | "Action Needed";

type Direction = "up" | "down" | "flat";

export interface PortalUser {
  id: string;
  role: Role;
  name: string;
  phone: string | null;
  subscription_plan_id: string | null;
  upcoming_visits: ScheduledVisit[];
}

export interface ScheduledVisit {
  id: string;
  starts_at: string;
  type: string;
}

export interface ClientProfile {
  id: string;
  full_name: string;
  dob: string;
  address: string;
  transportation_flag: boolean;
  subscription_tier_id: string | null;
  emergency_contacts: Array<{ name?: string; phone?: string }>;
}

type RawClient = Record<string, unknown> & {
  id: string;
  assigned_caretaker_id?: string | null;
  subscription_tier_id?: string | null;
};

export interface CarePlan {
  elderly_client_id: string;
  goals: string[];
  routines: string[];
  restrictions: string[];
  medication_schedule: string[];
  escalation_preferences: string;
  large_text_mode: boolean;
  high_contrast_mode: boolean;
}

export interface CaretakerProfile {
  id: string;
  name: string;
  verified: boolean;
}

export interface CaretakerMetrics {
  on_time_rate: number;
  completion_rate: number;
  avg_response_minutes: number;
  verified_visit_rate: number;
}

export interface ChangeSummaryItem {
  label: string;
  detail: string;
  direction: Direction;
}

export interface WeeklyBrief {
  id: string;
  summary: string;
  concerns: string[];
  next_steps: string[];
  generated_at: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  email: string;
  permissions: string[];
  ownership_label: string | null;
}

export interface Appointment {
  id: string;
  title: string;
  provider: string;
  scheduled_for: string;
  status: "Scheduled" | "Confirmed" | "Completed" | "Cancelled";
  transport_needed: boolean;
}

export interface TransportRequest {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  scheduled_for: string;
  status: "Requested" | "Scheduled" | "Completed" | "Cancelled";
  coordination_notes: string | null;
}

export interface Alert {
  id: string;
  type: string;
  severity: "Low" | "Medium" | "High";
  summary: string;
  status: "Open" | "Monitoring" | "Resolved";
  triggered_at: string;
}

export interface Incident {
  id: string;
  severity: "Low" | "Medium" | "High";
  summary: string;
  actions_taken: string;
  acknowledged_by_family_at: string | null;
}

export interface Thread {
  id: string;
  customer_id: string;
  caretaker_id: string;
  elderly_client_id: string;
}

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  created_at: string;
}

export interface VisitAssessment {
  mood_score: number | null;
  mobility_score: number | null;
  appetite_score: number | null;
  engagement_score: number | null;
  medication_adherence: string | null;
  home_safety_flag: boolean;
}

export interface VisitLog {
  id: string;
  created_at: string;
  visit_type: string;
  status: "Good" | "Needs Attention" | "Urgent";
  notes: string;
  photo_url: string | null;
  emergency_flag: boolean;
  incident_flag: boolean;
  verification: {
    checked_in_at: string | null;
    checked_out_at: string | null;
    checklist_completed: boolean;
    checklist_items: string[];
  };
  assessment: VisitAssessment;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  assigned_to: string | null;
  priority: "Low" | "Medium" | "High";
  status: "Submitted" | "In Progress" | "Completed";
  due_date: string;
}

export interface Ticket {
  id: string;
  category: string;
  description: string;
  status: "Open" | "In Review" | "Resolved";
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: number;
  visit_frequency: string;
  update_frequency: string;
  features: Record<string, boolean>;
}

export interface DashboardData {
  user: PortalUser | null;
  client: ClientProfile | null;
  thread: Thread | null;
  messages: Message[];
  logs: VisitLog[];
  tasks: Task[];
  tickets: Ticket[];
  plans: SubscriptionPlan[];
  alerts: Alert[];
  incidents: Incident[];
  familyMembers: FamilyMember[];
  appointments: Appointment[];
  transportRequests: TransportRequest[];
  carePlan: CarePlan | null;
  weeklyBrief: WeeklyBrief | null;
  caretakerProfile: CaretakerProfile | null;
  caretakerMetrics: CaretakerMetrics | null;
  confidenceStatus: ConfidenceStatus;
  confidenceSummary: string;
  changeSummary: ChangeSummaryItem[];
}

export const initialData: DashboardData = {
  user: null,
  client: null,
  thread: null,
  messages: [],
  logs: [],
  tasks: [],
  tickets: [],
  plans: [],
  alerts: [],
  incidents: [],
  familyMembers: [],
  appointments: [],
  transportRequests: [],
  carePlan: null,
  weeklyBrief: null,
  caretakerProfile: null,
  caretakerMetrics: null,
  confidenceStatus: "Stable",
  confidenceSummary: "Sign in to load care details.",
  changeSummary: [],
};

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(input: {
  email: string;
  password: string;
  role: Role;
  name: string;
  phone: string;
}) {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        role: input.role,
        name: input.name,
        phone: input.phone,
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadDashboard(): Promise<DashboardData> {
  const authUser = await requireUser();
  const profile = await fetchProfile(authUser.id);
  const plans = await fetchPlans();

  const client = await fetchClientForProfile(profile);
  const subscriptionPlanId = await fetchSubscriptionPlanId(profile, client);
  const upcomingVisits = client ? await fetchUpcomingVisits(client.id) : [];
  const user: PortalUser = {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    phone: profile.phone ?? null,
    subscription_plan_id: subscriptionPlanId,
    upcoming_visits: upcomingVisits,
  };

  if (!client) {
    return {
      ...initialData,
      user,
      plans,
      confidenceSummary: "Create or link a care profile to begin coordination.",
    };
  }

  const thread = await ensureThread(profile, client.id, client.assigned_caretaker_id ?? null);

  const [
    rawLogs,
    assessments,
    tasks,
    tickets,
    carePlan,
    incidents,
    alerts,
    weeklyBrief,
    familyMembers,
    appointments,
    transportRequests,
    caretakerProfile,
    caretakerMetrics,
    messages,
  ] = await Promise.all([
    fetchVisitLogs(client.id),
    fetchVisitAssessments(client.id),
    fetchTasks(client.id),
    profile.role === "customer" ? fetchSupportTickets(profile.id) : Promise.resolve([] as Ticket[]),
    fetchCarePlan(client.id),
    fetchIncidents(client.id),
    fetchAlerts(client.id),
    fetchWeeklyBrief(client.id),
    fetchFamilyMembers(client.id),
    fetchAppointments(client.id),
    fetchTransportRequests(client.id),
    client.assigned_caretaker_id ? fetchCaretakerProfile(client.assigned_caretaker_id) : Promise.resolve(null),
    client.assigned_caretaker_id ? fetchCaretakerMetrics(client.assigned_caretaker_id) : Promise.resolve(null),
    thread ? fetchMessages(thread.id) : Promise.resolve([] as Message[]),
  ]);

  const logs = mergeLogsWithAssessments(rawLogs, assessments);
  const changeSummary = buildChangeSummary(logs);
  const confidenceStatus = deriveConfidenceStatus(logs, alerts, incidents);
  const confidenceSummary = deriveConfidenceSummary(confidenceStatus, logs, alerts, incidents);

  return {
    user,
    client: normalizeClient(client),
    thread,
    messages,
    logs,
    tasks,
    tickets,
    plans,
    alerts,
    incidents,
    familyMembers,
    appointments,
    transportRequests,
    carePlan,
    weeklyBrief,
    caretakerProfile,
    caretakerMetrics,
    confidenceStatus,
    confidenceSummary,
    changeSummary,
  };
}

export async function submitMessage(
  threadId: string,
  payload: { content: string; attachment_url: string | null },
) {
  const authUser = await requireUser();
  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: authUser.id,
    content: payload.content,
    attachment_url: payload.attachment_url,
  });
  if (error) throw error;
}

export async function submitTask(
  clientId: string,
  payload: {
    title: string;
    description: string;
    priority: string;
    due_date: string;
    task_type: string;
    assigned_to: string | null;
  },
) {
  const authUser = await requireUser();
  const { error } = await supabase.from("tasks").insert({
    elderly_client_id: clientId,
    submitted_by: authUser.id,
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    due_date: payload.due_date,
    task_type: payload.task_type,
    assigned_to: payload.assigned_to,
  });
  if (error) throw error;
}

export async function updateTask(taskId: string, status: Task["status"]) {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) throw error;
}

export async function submitSupportTicket(payload: {
  category: string;
  description: string;
  attachment_url: string | null;
}) {
  const authUser = await requireUser();
  const { error } = await supabase.from("support_tickets").insert({
    customer_id: authUser.id,
    category: payload.category,
    description: payload.description,
    attachment_url: payload.attachment_url,
  });
  if (error) throw error;
}

export async function switchPlan(planId: string) {
  const authUser = await requireUser();
  const profile = await fetchProfile(authUser.id);
  if (profile.role !== "customer") {
    throw new Error("Only family accounts can switch plans.");
  }

  const client = await fetchClientForProfile(profile);
  if (!client) {
    throw new Error("No linked client found.");
  }

  const { error: upsertError } = await supabase.from("subscriptions").upsert(
    {
      customer_id: authUser.id,
      plan_id: planId,
      started_at: new Date().toISOString().slice(0, 10),
    },
    { onConflict: "customer_id" },
  );
  if (upsertError) throw upsertError;

  const { error: clientError } = await supabase
    .from("elderly_clients")
    .update({ subscription_tier_id: planId })
    .eq("id", client.id);
  if (clientError) throw clientError;
}

export async function submitVisitLog(
  clientId: string,
  payload: {
    visit_type: string;
    status: "Good" | "Needs Attention" | "Urgent";
    notes: string;
    photo_url: string | null;
    emergency_flag: boolean;
    incident_flag: boolean;
    checked_in_at: string;
    checked_out_at: string;
    checklist_completed: boolean;
    checklist_items: string[];
    mood_score: number | null;
    mobility_score: number | null;
    appetite_score: number | null;
    engagement_score: number | null;
    medication_adherence: string | null;
    home_safety_flag: boolean;
    incident_summary: string | null;
    incident_severity: string | null;
    incident_actions: string | null;
  },
) {
  const authUser = await requireUser();
  const { data: insertedLog, error: logError } = await supabase
    .from("visit_logs")
    .insert({
      elderly_client_id: clientId,
      caretaker_id: authUser.id,
      visit_type: payload.visit_type,
      status: payload.status,
      notes: payload.notes,
      photo_url: payload.photo_url,
      emergency_flag: payload.emergency_flag,
      incident_flag: payload.incident_flag,
      checked_in_at: toIsoString(payload.checked_in_at),
      checked_out_at: toIsoString(payload.checked_out_at),
      checklist_completed: payload.checklist_completed,
      checklist_items: payload.checklist_items,
    })
    .select("id")
    .single();
  if (logError) throw logError;

  const { error: assessmentError } = await supabase.from("visit_assessments").insert({
    visit_log_id: insertedLog.id,
    mood_score: payload.mood_score,
    mobility_score: payload.mobility_score,
    appetite_score: payload.appetite_score,
    engagement_score: payload.engagement_score,
    medication_adherence: payload.medication_adherence,
    home_safety_flag: payload.home_safety_flag,
  });
  if (assessmentError) throw assessmentError;

  if (payload.incident_flag && payload.incident_summary && payload.incident_actions && payload.incident_severity) {
    const { error: incidentError } = await supabase.from("incident_reports").insert({
      elderly_client_id: clientId,
      visit_log_id: insertedLog.id,
      severity: payload.incident_severity,
      summary: payload.incident_summary,
      actions_taken: payload.incident_actions,
    });
    if (incidentError) throw incidentError;
  }
}

async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("No active session.");
  }
  return session.user;
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data as {
    id: string;
    role: Role;
    name: string;
    phone: string | null;
  };
}

async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from("subscription_plans").select("*").order("price_monthly");
  if (error) throw error;
  return (data ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    price_monthly: plan.price_monthly,
    visit_frequency: plan.visit_frequency,
    update_frequency: plan.update_frequency,
    features: normalizeFeatures(plan.features),
  }));
}

async function fetchClientForProfile(profile: { id: string; role: Role }): Promise<RawClient | null> {
  if (profile.role === "customer") {
    const { data, error } = await supabase
      .from("family_links")
      .select("elderly_clients(*)")
      .eq("customer_user_id", profile.id)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.elderly_clients ?? null) as RawClient | null;
  }

  const { data, error } = await supabase
    .from("elderly_clients")
    .select("*")
    .eq("assigned_caretaker_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RawClient | null;
}

async function fetchSubscriptionPlanId(
  profile: { id: string; role: Role },
  client: { subscription_tier_id?: string | null } | null,
) {
  if (profile.role !== "customer") {
    return client?.subscription_tier_id ?? null;
  }
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("customer_id", profile.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.plan_id as string | null | undefined) ?? client?.subscription_tier_id ?? null;
}

async function fetchUpcomingVisits(clientId: string): Promise<ScheduledVisit[]> {
  const { data, error } = await supabase
    .from("scheduled_visits")
    .select("*")
    .eq("elderly_client_id", clientId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ScheduledVisit[];
}

async function ensureThread(
  profile: { id: string; role: Role },
  clientId: string,
  assignedCaretakerId: string | null,
): Promise<Thread | null> {
  const threadQuery = profile.role === "customer"
    ? supabase.from("threads").select("*").eq("customer_id", profile.id).eq("elderly_client_id", clientId)
    : supabase.from("threads").select("*").eq("caretaker_id", profile.id).eq("elderly_client_id", clientId);
  const { data: existing, error: existingError } = await threadQuery.limit(1).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as Thread;

  let customerId: string | null = null;
  let caretakerId: string | null = assignedCaretakerId;

  if (profile.role === "customer") {
    customerId = profile.id;
  } else {
    caretakerId = profile.id;
    const { data: familyLink, error: familyError } = await supabase
      .from("family_links")
      .select("customer_user_id")
      .eq("elderly_client_id", clientId)
      .limit(1)
      .maybeSingle();
    if (familyError) throw familyError;
    customerId = (familyLink?.customer_user_id as string | null | undefined) ?? null;
  }

  if (!customerId || !caretakerId) return null;

  const { data: inserted, error: insertError } = await supabase
    .from("threads")
    .insert({
      customer_id: customerId,
      caretaker_id: caretakerId,
      elderly_client_id: clientId,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return inserted as Thread;
}

async function fetchMessages(threadId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

async function fetchVisitLogs(clientId: string) {
  const { data, error } = await supabase
    .from("visit_logs")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function fetchVisitAssessments(clientId: string) {
  const { data, error } = await supabase
    .from("visit_assessments")
    .select("*, visit_logs!inner(elderly_client_id)")
    .eq("visit_logs.elderly_client_id", clientId);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function fetchTasks(clientId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

async function fetchSupportTickets(customerId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

async function fetchCarePlan(clientId: string): Promise<CarePlan | null> {
  const { data, error } = await supabase.from("care_plans").select("*").eq("elderly_client_id", clientId).maybeSingle();
  if (error) throw error;
  return (data as CarePlan | null) ?? null;
}

async function fetchIncidents(clientId: string): Promise<Incident[]> {
  const { data, error } = await supabase
    .from("incident_reports")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Incident[];
}

async function fetchAlerts(clientId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("triggered_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Alert[];
}

async function fetchWeeklyBrief(clientId: string): Promise<WeeklyBrief | null> {
  const { data, error } = await supabase
    .from("weekly_briefs")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as WeeklyBrief | null) ?? null;
}

async function fetchFamilyMembers(clientId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from("family_members")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyMember[];
}

async function fetchAppointments(clientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Appointment[];
}

async function fetchTransportRequests(clientId: string): Promise<TransportRequest[]> {
  const { data, error } = await supabase
    .from("transport_requests")
    .select("*")
    .eq("elderly_client_id", clientId)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TransportRequest[];
}

async function fetchCaretakerProfile(caretakerId: string): Promise<CaretakerProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, verified")
    .eq("id", caretakerId)
    .maybeSingle();
  if (error) throw error;
  return (data as CaretakerProfile | null) ?? null;
}

async function fetchCaretakerMetrics(caretakerId: string): Promise<CaretakerMetrics | null> {
  const { data, error } = await supabase
    .from("caretaker_metrics")
    .select("*")
    .eq("caretaker_id", caretakerId)
    .maybeSingle();
  if (error) throw error;
  return (data as CaretakerMetrics | null) ?? null;
}

function normalizeClient(client: RawClient): ClientProfile {
  return {
    id: String(client.id),
    full_name: String(client.full_name),
    dob: String(client.dob),
    address: String(client.address ?? ""),
    transportation_flag: Boolean(client.transportation_flag),
    subscription_tier_id: (client.subscription_tier_id as string | null | undefined) ?? null,
    emergency_contacts: Array.isArray(client.emergency_contacts)
      ? (client.emergency_contacts as Array<{ name?: string; phone?: string }>)
      : [],
  };
}

function normalizeFeatures(features: unknown): Record<string, boolean> {
  if (!features || typeof features !== "object" || Array.isArray(features)) return {};
  return Object.fromEntries(
    Object.entries(features).map(([key, value]) => [key, Boolean(value)]),
  );
}

function mergeLogsWithAssessments(
  logs: Array<Record<string, unknown>>,
  assessments: Array<Record<string, unknown>>,
): VisitLog[] {
  const assessmentByLogId = new Map<string, VisitAssessment>();
  for (const assessment of assessments) {
    const visitLogId = assessment.visit_log_id;
    if (typeof visitLogId !== "string") continue;
    assessmentByLogId.set(visitLogId, {
      mood_score: numberOrNull(assessment.mood_score),
      mobility_score: numberOrNull(assessment.mobility_score),
      appetite_score: numberOrNull(assessment.appetite_score),
      engagement_score: numberOrNull(assessment.engagement_score),
      medication_adherence: stringOrNull(assessment.medication_adherence),
      home_safety_flag: Boolean(assessment.home_safety_flag),
    });
  }

  return logs.map((log) => ({
    id: String(log.id),
    created_at: String(log.created_at),
    visit_type: String(log.visit_type),
    status: log.status as VisitLog["status"],
    notes: String(log.notes),
    photo_url: stringOrNull(log.photo_url),
    emergency_flag: Boolean(log.emergency_flag),
    incident_flag: Boolean(log.incident_flag),
    verification: {
      checked_in_at: stringOrNull(log.checked_in_at),
      checked_out_at: stringOrNull(log.checked_out_at),
      checklist_completed: Boolean(log.checklist_completed),
      checklist_items: Array.isArray(log.checklist_items) ? (log.checklist_items as string[]) : [],
    },
    assessment: assessmentByLogId.get(String(log.id)) ?? {
      mood_score: null,
      mobility_score: null,
      appetite_score: null,
      engagement_score: null,
      medication_adherence: null,
      home_safety_flag: false,
    },
  }));
}

function buildChangeSummary(logs: VisitLog[]): ChangeSummaryItem[] {
  if (logs.length === 0) {
    return [
      { label: "Care updates", detail: "Waiting for the first verified visit log.", direction: "flat" },
    ];
  }

  const latest = logs[0];
  const previous = logs[1];

  if (!previous) {
    return [
      {
        label: "First verified visit",
        detail: `${latest.status} visit logged with ${latest.verification.checklist_items.length} checklist items.`,
        direction: latest.status === "Good" ? "up" : latest.status === "Urgent" ? "down" : "flat",
      },
    ];
  }

  const metricChanges: ChangeSummaryItem[] = [
    compareMetric("Mood", latest.assessment.mood_score, previous.assessment.mood_score),
    compareMetric("Mobility", latest.assessment.mobility_score, previous.assessment.mobility_score),
    compareMetric("Appetite", latest.assessment.appetite_score, previous.assessment.appetite_score),
    compareMetric("Engagement", latest.assessment.engagement_score, previous.assessment.engagement_score),
  ];

  const medicationShift =
    latest.assessment.medication_adherence === previous.assessment.medication_adherence
      ? {
          label: "Medication adherence",
          detail: `Still ${latest.assessment.medication_adherence ?? "unreported"}.`,
          direction: "flat" as Direction,
        }
      : {
          label: "Medication adherence",
          detail: `${previous.assessment.medication_adherence ?? "Unreported"} to ${latest.assessment.medication_adherence ?? "unreported"}.`,
          direction: (
            latest.assessment.medication_adherence === "On Track"
              ? "up"
              : latest.assessment.medication_adherence === "Missed Dose"
                ? "down"
                : "flat"
          ) as Direction,
        };

  return [...metricChanges, medicationShift].filter(Boolean);
}

function compareMetric(label: string, latest: number | null, previous: number | null): ChangeSummaryItem {
  if (latest == null || previous == null) {
    return {
      label,
      detail: "Insufficient structured data to compare yet.",
      direction: "flat",
    };
  }

  if (latest === previous) {
    return {
      label,
      detail: `Steady at ${latest}/5 over the last two visits.`,
      direction: "flat",
    };
  }

  const delta = latest - previous;
  return {
    label,
    detail: `${delta > 0 ? "Improved" : "Declined"} from ${previous}/5 to ${latest}/5.`,
    direction: delta > 0 ? "up" : "down",
  };
}

function deriveConfidenceStatus(logs: VisitLog[], alerts: Alert[], incidents: Incident[]): ConfidenceStatus {
  const latest = logs[0];
  const highOpenAlert = alerts.some((alert) => alert.status !== "Resolved" && alert.severity === "High");
  const unresolvedIncident = incidents.some((incident) => !incident.acknowledged_by_family_at && incident.severity !== "Low");

  if (latest?.status === "Urgent" || highOpenAlert) {
    return "Action Needed";
  }
  if (latest?.status === "Needs Attention" || unresolvedIncident || alerts.some((alert) => alert.status !== "Resolved")) {
    return "Watch";
  }
  return "Stable";
}

function deriveConfidenceSummary(
  status: ConfidenceStatus,
  logs: VisitLog[],
  alerts: Alert[],
  incidents: Incident[],
) {
  switch (status) {
    case "Action Needed":
      return "High-severity risk detected. Family follow-up or escalation is needed now.";
    case "Watch":
      return `${alerts.filter((alert) => alert.status !== "Resolved").length} open alerts and ${incidents.filter((incident) => !incident.acknowledged_by_family_at).length} pending incident acknowledgments.`;
    default:
      return logs[0]
        ? "Recent visits are verified and no urgent escalation patterns are active."
        : "No visit history yet. Confidence will improve as verified updates arrive.";
  }
}

function toIsoString(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
