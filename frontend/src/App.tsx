import { FormEvent, useEffect, useState } from "react";
import {
  Appointment,
  ConfidenceStatus,
  DashboardData,
  Role,
  ScheduledVisit,
  Task,
  TransportRequest,
  getSession,
  initialData,
  loadDashboard,
  signIn,
  signOut,
  signUp,
  submitMessage as sendPortalMessage,
  submitSupportTicket as createSupportTicket,
  submitTask as createTask,
  submitVisitLog as createVisitLog,
  switchPlan as updatePlan,
  updateTask as patchTask,
} from "./lib/portal";

type RecurringEvent = {
  id: string;
  title: string;
  weekday: number;
  time: string;
  details: string | null;
};

type CalendarEntry = {
  id: string;
  dayKey: string;
  timeLabel: string;
  title: string;
  detail: string;
  kind: "task" | "appointment" | "transport" | "visit" | "routine";
  fullDateLabel: string;
  source: "existing" | "custom" | "recurring";
};

type CustomCalendarEvent = {
  id: string;
  type: "visit" | "task" | "appointment";
  title: string;
  starts_at: string;
  details: string | null;
};

type ExampleCaregiver = {
  id: string;
  name: string;
  area: string;
  rating: number;
  experience: string;
  bio: string;
  verified: boolean;
  onTimeRate: number;
  completionRate: number;
  avatarUrl: string;
};

export function App() {
  const [role, setRole] = useState<Role>("customer");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [error, setError] = useState<string | null>(null);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [customCalendarEvents, setCustomCalendarEvents] = useState<CustomCalendarEvent[]>([]);
  const [calendarWeekOffset, setCalendarWeekOffset] = useState(0);
  const [selectedCalendarEntry, setSelectedCalendarEntry] = useState<CalendarEntry | null>(null);
  const [careComposerMode, setCareComposerMode] = useState<"event" | "task">("event");
  const [careComposerRecurring, setCareComposerRecurring] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [visitChecklist, setVisitChecklist] = useState({
    medication: false,
    hydration: false,
    mobility: false,
    notesShared: false,
  });
  const [visitWrapNote, setVisitWrapNote] = useState("");
  const [visitCompletionMessage, setVisitCompletionMessage] = useState<string | null>(null);
  const [profileModalCaregiver, setProfileModalCaregiver] = useState<ExampleCaregiver | null>(null);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  async function refreshDashboard() {
    setLoading(true);
    setError(null);
    try {
      const session = await getSession();
      if (!session) {
        setData(initialData);
        return;
      }
      setData(await loadDashboard());
    } catch (dashboardError) {
      setError(dashboardError instanceof Error ? dashboardError.message : null);
      setData(initialData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (!data.user) return;
    setActiveTab("home");
  }, [data.user?.role]);

  useEffect(() => {
    if (!data.client || typeof window === "undefined") {
      setRecurringEvents([]);
      setCustomCalendarEvents([]);
      setCalendarWeekOffset(0);
      setSelectedCalendarEntry(null);
      return;
    }
    const stored = window.localStorage.getItem(recurringEventsKey(data.client.id));
    if (!stored) {
      setRecurringEvents([]);
    } else {
      try {
        setRecurringEvents(JSON.parse(stored) as RecurringEvent[]);
      } catch {
        setRecurringEvents([]);
      }
    }
    const storedCustomEvents = window.localStorage.getItem(customCalendarEventsKey(data.client.id));
    if (!storedCustomEvents) {
      setCustomCalendarEvents([]);
    } else {
      try {
        setCustomCalendarEvents(JSON.parse(storedCustomEvents) as CustomCalendarEvent[]);
      } catch {
        setCustomCalendarEvents([]);
      }
    }
    setCalendarWeekOffset(0);
    setSelectedCalendarEntry(null);
  }, [data.client?.id]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (authMode === "signup") {
        await signUp({ email, password, role, name, phone });
      } else {
        await signIn(email, password);
      }
      setActiveTab("home");
      await refreshDashboard();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to authenticate");
      setLoading(false);
    }
  }

  async function handleLogout() {
    await signOut();
    setData(initialData);
  }

  async function submitVisitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.client) return;
    const form = new FormData(event.currentTarget);
    await createVisitLog(data.client.id, {
      visit_type: formValue(form, "visit_type"),
      status: formValue(form, "status") as "Good" | "Needs Attention" | "Urgent",
      notes: formValue(form, "notes"),
      photo_url: optionalFormValue(form, "photo_url"),
      emergency_flag: form.get("emergency_flag") === "on",
      incident_flag: form.get("incident_flag") === "on",
      checked_in_at: formValue(form, "checked_in_at"),
      checked_out_at: formValue(form, "checked_out_at"),
      checklist_completed: form.get("checklist_completed") === "on",
      checklist_items: commaList(formValue(form, "checklist_items")),
      mood_score: numberOrNull(formValue(form, "mood_score")),
      mobility_score: numberOrNull(formValue(form, "mobility_score")),
      appetite_score: numberOrNull(formValue(form, "appetite_score")),
      engagement_score: numberOrNull(formValue(form, "engagement_score")),
      medication_adherence: optionalFormValue(form, "medication_adherence"),
      home_safety_flag: form.get("home_safety_flag") === "on",
      incident_summary: optionalFormValue(form, "incident_summary"),
      incident_severity: optionalFormValue(form, "incident_severity"),
      incident_actions: optionalFormValue(form, "incident_actions"),
    });
    event.currentTarget.reset();
    await refreshDashboard();
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.thread) return;
    const form = new FormData(event.currentTarget);
    await sendPortalMessage(data.thread.id, {
      content: formValue(form, "content"),
      attachment_url: optionalFormValue(form, "attachment_url"),
    });
    event.currentTarget.reset();
    await refreshDashboard();
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.client) return;
    const form = new FormData(event.currentTarget);
    await createTask(data.client.id, {
      title: formValue(form, "title"),
      description: formValue(form, "description"),
      priority: formValue(form, "priority"),
      due_date: formValue(form, "due_date"),
      task_type: formValue(form, "task_type"),
      assigned_to: optionalFormValue(form, "assigned_to"),
    });
    event.currentTarget.reset();
    await refreshDashboard();
  }

  async function updateTask(taskId: string, status: Task["status"]) {
    await patchTask(taskId, status);
    await refreshDashboard();
  }

  async function submitSupportTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await createSupportTicket({
      category: formValue(form, "category"),
      description: formValue(form, "description"),
      attachment_url: optionalFormValue(form, "attachment_url"),
    });
    event.currentTarget.reset();
    await refreshDashboard();
  }

  async function switchPlan(planId: string) {
    await updatePlan(planId);
    await refreshDashboard();
  }

  function removeRecurringEvent(eventId: string) {
    if (!data.client || typeof window === "undefined") return;
    const nextEvents = recurringEvents.filter((event) => event.id !== eventId);
    setRecurringEvents(nextEvents);
    window.localStorage.setItem(recurringEventsKey(data.client.id), JSON.stringify(nextEvents));
  }

  function submitQuickCalendarEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.client || typeof window === "undefined") return;
    const form = new FormData(event.currentTarget);
    const nextEvent: CustomCalendarEvent = {
      id: `calendar-${Date.now()}`,
      type: formValue(form, "event_type") as CustomCalendarEvent["type"],
      title: formValue(form, "title"),
      starts_at: formValue(form, "starts_at"),
      details: optionalFormValue(form, "details"),
    };
    const nextEvents = [...customCalendarEvents, nextEvent];
    setCustomCalendarEvents(nextEvents);
    window.localStorage.setItem(customCalendarEventsKey(data.client.id), JSON.stringify(nextEvents));
    event.currentTarget.reset();
  }

  async function submitCareComposer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.client) return;
    const form = new FormData(event.currentTarget);

    if (careComposerMode === "task") {
      await createTask(data.client.id, {
        title: formValue(form, "title"),
        description: formValue(form, "description"),
        priority: formValue(form, "priority"),
        due_date: formValue(form, "due_date"),
        task_type: formValue(form, "task_type"),
        assigned_to: optionalFormValue(form, "assigned_to"),
      });
      event.currentTarget.reset();
      await refreshDashboard();
      return;
    }

    if (careComposerRecurring) {
      if (typeof window === "undefined") return;
      const nextEvent: RecurringEvent = {
        id: `recurring-${Date.now()}`,
        title: formValue(form, "title"),
        weekday: Number(formValue(form, "weekday")),
        time: formValue(form, "time"),
        details: optionalFormValue(form, "details"),
      };
      const nextEvents = [...recurringEvents, nextEvent];
      setRecurringEvents(nextEvents);
      window.localStorage.setItem(recurringEventsKey(data.client.id), JSON.stringify(nextEvents));
      event.currentTarget.reset();
      return;
    }

    submitQuickCalendarEvent(event);
  }

  function startVisit(visitId?: string) {
    setActiveVisitId(visitId ?? "ad-hoc-visit");
    setVisitChecklist({
      medication: false,
      hydration: false,
      mobility: false,
      notesShared: false,
    });
    setVisitWrapNote("");
    setVisitCompletionMessage(null);
  }

  function endVisit() {
    setVisitCompletionMessage(
      visitWrapNote
        ? `Visit ended. Summary saved locally: ${summarizeText(visitWrapNote, 96)}`
        : "Visit ended. Add visit notes in Communication when ready.",
    );
    setActiveVisitId(null);
    setVisitWrapNote("");
  }

  if (!data.user) {
    return (
      <div className="shell auth-shell">
        <section className="hero">
          <div className="hero-badge">Trusted remote care for families</div>
          <p className="eyebrow">CapableCare Family Portal</p>
          <h1>Stay close to your loved one&apos;s care, even when you&apos;re far away.</h1>
          <p className="lede">
            A calm, shared place for families and caregivers to review visits, track changes, coordinate tasks, and
            keep care decisions organized with confidence.
          </p>
          <div className="hero-points">
            <article>
              <strong>Verified visit updates</strong>
              <p>Check-ins, care notes, and status changes are organized in one simple timeline.</p>
            </article>
            <article>
              <strong>Family coordination</strong>
              <p>Everyone can stay aligned on appointments, support requests, and next steps.</p>
            </article>
            <article>
              <strong>Clear weekly summaries</strong>
              <p>See what changed, what needs attention, and what is going smoothly.</p>
            </article>
          </div>
          <div className="demo-cards">
            <article>
              <span>Family demo account</span>
              <strong>family.capablecare@example.com</strong>
              <p>Use the configured family demo password from your local environment.</p>
            </article>
            <article>
              <span>Caregiver demo account</span>
              <strong>caretaker.capablecare@example.com</strong>
              <p>Use the configured caregiver demo password from your local environment.</p>
            </article>
          </div>
        </section>

        <section className="auth-card">
          <div className="section-heading">
            <p className="section-kicker">Secure access</p>
            <h3>{authMode === "login" ? "Sign in to your care dashboard" : "Create your CapableCare account"}</h3>
            <p className="supporting-copy">Choose the experience that matches how you support care.</p>
          </div>
          <div className="segmented">
            {(["login", "signup"] as const).map((mode) => (
              <button
                key={mode}
                className={authMode === mode ? "active" : ""}
                onClick={() => setAuthMode(mode)}
                type="button"
              >
                {mode === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <div className="segmented">
            {(["customer", "caretaker"] as Role[]).map((nextRole) => (
              <button
                key={nextRole}
                className={role === nextRole ? "active" : ""}
                onClick={() => setRole(nextRole)}
                type="button"
              >
                {nextRole === "customer" ? "Family portal" : "Caretaker portal"}
              </button>
            ))}
          </div>
          <form className="stack" onSubmit={handleAuth}>
            {authMode === "signup" ? (
              <>
                <label>
                  Full name
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                </label>
                <label>
                  Phone
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
                </label>
              </>
            ) : null}
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button className="primary" disabled={loading} type="submit">
              {loading ? "Connecting..." : authMode === "login" ? "Enter portal" : "Create account"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  const isCustomer = data.user.role === "customer";
  const tabs = [
    { id: "home", label: "Home" },
    { id: "care", label: "Care" },
    { id: "communication", label: "Communication" },
    { id: "account", label: "Account" },
  ];
  const latestUpdate = data.logs[0];
  const currentPlan = data.plans.find((plan) => plan.id === data.user?.subscription_plan_id);
  const showSummaryGrid = isCustomer && activeTab === "home";
  const visibleLogs =
    isCustomer && activeTab === "home"
      ? data.logs.slice(0, 3)
      : data.logs;
  const weekStart = startOfWeek(new Date(), calendarWeekOffset);
  const calendarDays = buildCalendarDays(weekStart);
  const sharedCalendarEntries = data.client
    ? buildSharedCalendarEntries({
        tasks: data.tasks,
        appointments: data.appointments,
        transportRequests: data.transportRequests,
        upcomingVisits: data.user.upcoming_visits,
        recurringEvents,
        customCalendarEvents,
        weekStart,
      })
    : [];
  const selectedWeekLabel = formatWeekRange(calendarDays);
  const selectedDayEntries = selectedCalendarEntry
    ? sharedCalendarEntries.filter((entry) => entry.dayKey === selectedCalendarEntry.dayKey)
    : [];
  const openAlertCount = data.alerts.filter((alert) => alert.status !== "Resolved").length;
  const completedVisitsThisWeek = data.logs.filter((log) => isDateInWeek(new Date(log.created_at), weekStart)).length;
  const completedTasksThisWeek = data.tasks.filter(
    (task) => task.status === "Completed" && task.due_date && isDateInWeek(new Date(task.due_date), weekStart),
  ).length;
  const caregiverRating = data.caretakerMetrics
    ? deriveCaregiverRating(data.caretakerMetrics.on_time_rate, data.caretakerMetrics.completion_rate)
    : 4.8;
  const overallStatus = peaceOfMindStatus(data.confidenceStatus);
  const todayStart = startOfDay(new Date());
  const tasksToday = data.tasks.filter((task) => task.due_date && isSameDay(new Date(task.due_date), todayStart));
  const nextVisit = data.user.upcoming_visits?.[0];
  const recentCompletedTasks = data.tasks.filter((task) => task.status === "Completed").slice(0, 3);
  const recentVisitNotes = data.logs.slice(0, 3);
  const notifications = [
    ...data.alerts
      .filter((alert) => alert.status !== "Resolved")
      .map((alert) => ({
        id: `alert-${alert.id}`,
        title: `${alert.severity} alert`,
        detail: alert.summary,
        time: "",
      })),
    ...data.messages
      .filter((message) => message.sender_id !== data.user?.id)
      .slice(-3)
      .reverse()
      .map((message) => ({
        id: `message-${message.id}`,
        title: "New message",
        detail: summarizeText(message.content, 72),
        time: formatDateTime(message.created_at),
      })),
    ...data.logs.slice(0, 2).map((log) => ({
      id: `log-${log.id}`,
      title: `${log.status} update`,
      detail: summarizeText(log.notes, 72),
      time: formatDateTime(log.created_at),
    })),
  ];
  const unreadCount = notifications.length;
  const exampleCaregivers: ExampleCaregiver[] = [
    {
      id: "cg-1",
      name: "Maria Thompson",
      area: "Richmond area",
      rating: 4.9,
      experience: "2 years experience",
      bio: "Local caregiver focused on routine support, meal prep, and companionship.",
      verified: true,
      onTimeRate: 97,
      completionRate: 96,
      avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    },
    {
      id: "cg-2",
      name: "Denise Walker",
      area: "Short Pump area",
      rating: 4.8,
      experience: "3 years experience",
      bio: "Experienced with mobility support, medication reminders, and family communication.",
      verified: true,
      onTimeRate: 95,
      completionRate: 94,
      avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg",
    },
    {
      id: "cg-3",
      name: "Angela Brooks",
      area: "Henrico area",
      rating: 4.7,
      experience: "18 months experience",
      bio: "Strong fit for weekly check-ins, transportation coordination, and household errands.",
      verified: true,
      onTimeRate: 93,
      completionRate: 95,
      avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg",
    },
  ];
  const selectedExampleCaregiver = exampleCaregivers.find((caregiver) => caregiver.id === selectedCaregiverId) ?? null;
  const currentCaregiver: ExampleCaregiver = selectedExampleCaregiver ?? {
    id: data.caretakerProfile?.id ?? "current-caregiver",
    name: data.caretakerProfile?.name ?? "Caregiver assignment pending",
    area: "Local care team",
    rating: caregiverRating,
    experience: "2 years experience",
    bio: "Verified local caregiver coordinating visits, updates, and day-to-day follow-through.",
    verified: Boolean(data.caretakerProfile?.verified),
    onTimeRate: Math.round(data.caretakerMetrics?.on_time_rate ?? 0),
    completionRate: Math.round(data.caretakerMetrics?.completion_rate ?? 0),
    avatarUrl: "https://randomuser.me/api/portraits/women/32.jpg",
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <p className="eyebrow">CapableCare Portal</p>
          <h2>{isCustomer ? "Family care dashboard" : "Caregiver visit dashboard"}</h2>
          <p className="supporting-copy">
            {isCustomer
              ? "Follow care updates, coordinate support, and stay informed without constant check-in calls."
              : "Record visits clearly, surface changes early, and keep the family looped in."}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="notification-pill" onClick={() => setNotificationsOpen((current) => !current)} type="button">
            Notifications {unreadCount}
          </button>
          <button className="secondary" onClick={handleLogout} type="button">
            Log out
          </button>
          {notificationsOpen ? (
            <section className="notification-panel">
              <div className="feed-header">
                <strong>Notifications</strong>
                <button className="secondary" onClick={() => setNotificationsOpen(false)} type="button">Close</button>
              </div>
              <div className="feed compact-feed">
                {notifications.map((notification) => (
                  <article className="feed-item" key={notification.id}>
                    <strong>{notification.title}</strong>
                    <p>{notification.detail}</p>
                    <span>{notification.time || "Just now"}</span>
                  </article>
                ))}
                {notifications.length === 0 ? <p className="supporting-copy">No new notifications right now.</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </header>

      {!isCustomer && activeTab === "home" ? (
        <section className="peace-grid">
          <article className={`summary-card highlight status-card ${overallStatus.tone}`}>
            <p>Status</p>
            <strong>{overallStatus.label}</strong>
            <span>{data.confidenceSummary}</span>
          </article>
          <article className="summary-card status-card">
            <p>Next Visit</p>
            <strong>{nextVisit ? formatDateTime(nextVisit.starts_at) : "Not scheduled"}</strong>
            <span>{nextVisit ? nextVisit.type : "No upcoming visit is assigned right now."}</span>
          </article>
          <article className="summary-card status-card">
            <p>Tasks Today</p>
            <strong>{tasksToday.length}</strong>
            <span>{tasksToday.length > 0 ? "Assigned actions ready to complete." : "No tasks due today."}</span>
          </article>
          {openAlertCount > 0 ? (
            <article className="summary-card status-card alert-card">
              <p>Alerts</p>
              <strong>{openAlertCount} active</strong>
              <span>{summarizeText(data.alerts.find((alert) => alert.status !== "Resolved")?.summary ?? "", 72)}</span>
            </article>
          ) : null}
        </section>
      ) : isCustomer && activeTab === "home" ? (
        <section className="peace-grid">
          <article className={`summary-card highlight status-card ${overallStatus.tone}`}>
            <p>Overall Status</p>
            <strong>{overallStatus.label}</strong>
            <span>{data.confidenceSummary}</span>
          </article>
          <article className="summary-card status-card">
            <p>Last Check-in</p>
            <strong>{latestUpdate ? formatDateTime(latestUpdate.created_at) : "No check-in yet"}</strong>
            <span>{latestUpdate ? summarizeText(latestUpdate.notes, 72) : "Waiting for the first visit update."}</span>
          </article>
          <article className="summary-card status-card">
            <p>Next Visit</p>
            <strong>{data.user.upcoming_visits?.[0] ? formatDateTime(data.user.upcoming_visits[0].starts_at) : "Not scheduled"}</strong>
            <span>{data.user.upcoming_visits?.[0] ? "Next care visit on the shared schedule." : "No upcoming visit is currently booked."}</span>
          </article>
          {openAlertCount > 0 ? (
            <article className="summary-card status-card alert-card">
              <p>Alerts</p>
              <strong>{openAlertCount} active</strong>
              <span>{summarizeText(data.alerts.find((alert) => alert.status !== "Resolved")?.summary ?? "", 72)}</span>
            </article>
          ) : null}
        </section>
      ) : showSummaryGrid ? (
        <section className="summary-grid">
          <article className="summary-card highlight">
            <p>Care confidence</p>
            <strong>{confidenceLabel(data.confidenceStatus)}</strong>
            <span>{data.confidenceSummary}</span>
          </article>
          <article className="summary-card">
            <p>Most recent update</p>
            <strong>{latestUpdate?.status ?? "No updates"}</strong>
            <span>{latestUpdate ? formatDateTime(latestUpdate.created_at) : "Waiting for first visit log"}</span>
          </article>
          <article className="summary-card">
            <p>Upcoming visits</p>
            <strong>{data.user.upcoming_visits?.length ?? 0}</strong>
            <span>{isCustomer ? "Shared with your family circle" : "Visible to the family circle"}</span>
          </article>
          <article className="summary-card">
            <p>Items needing attention</p>
            <strong>{data.alerts.filter((alert) => alert.status !== "Resolved").length}</strong>
            <span>{data.transportRequests.length} ride or transport requests in progress</span>
          </article>
        </section>
      ) : null}

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content-grid">
        {!data.client ? (
          <section className="panel wide">
            <h3>Care linkage pending</h3>
            <p className="supporting-copy">
              Authentication is working, but this user is not linked to a client profile yet. Seed demo data or assign
              the user to a real care plan in Supabase.
            </p>
          </section>
        ) : null}

        {switchModalOpen && isCustomer ? (
          <div className="modal-backdrop switch-layer" onClick={() => setSwitchModalOpen(false)} role="presentation">
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="feed-header">
                <div>
                  <p className="section-kicker">Switch Caregiver</p>
                  <h3>Example caregivers in your area</h3>
                </div>
                <button className="secondary" onClick={() => setSwitchModalOpen(false)} type="button">Close</button>
              </div>
              <div className="feed">
                {exampleCaregivers.map((caregiver) => (
                  <article className="feed-item" key={caregiver.id}>
                    <div className="caregiver-card">
                      <img alt={caregiver.name} className="caregiver-photo" src={caregiver.avatarUrl} />
                      <div className="caregiver-meta">
                      <div className="caregiver-row">
                        <strong>{caregiver.name}</strong>
                        {caregiver.verified ? <span className="verification-badge">Verified</span> : null}
                      </div>
                        <p>{caregiver.area} | {caregiver.experience}</p>
                        <span>{caregiver.bio}</span>
                      </div>
                    </div>
                    <div className="detail-grid">
                      <div>
                        <span>Rating</span>
                        <strong>{caregiver.rating.toFixed(1)} stars</strong>
                        <p>Family satisfaction score</p>
                      </div>
                      <div>
                        <span>Reliability</span>
                        <strong>{caregiver.onTimeRate}% on-time</strong>
                        <p>{caregiver.completionRate}% completed visits</p>
                      </div>
                    </div>
                    <div className="button-row">
                      <button className="secondary" onClick={() => setProfileModalCaregiver(caregiver)} type="button">View Profile</button>
                      <button
                        className="primary"
                        onClick={() => {
                          setSelectedCaregiverId(caregiver.id);
                          setSwitchModalOpen(false);
                        }}
                        type="button"
                      >
                        Switch Caregiver
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {profileModalCaregiver && isCustomer ? (
          <div className="modal-backdrop profile-layer" onClick={() => setProfileModalCaregiver(null)} role="presentation">
            <section className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="feed-header">
                <div>
                  <p className="section-kicker">Caregiver Profile</p>
                  <h3>{profileModalCaregiver.name}</h3>
                </div>
                <button className="secondary" onClick={() => setProfileModalCaregiver(null)} type="button">Close</button>
              </div>
              <div className="caregiver-card">
                <img alt={profileModalCaregiver.name} className="caregiver-photo" src={profileModalCaregiver.avatarUrl} />
                <div className="caregiver-meta">
                  <div className="caregiver-row">
                    <strong>{profileModalCaregiver.name}</strong>
                    {profileModalCaregiver.verified ? <span className="verification-badge">Verified</span> : null}
                  </div>
                  <p>{starRatingLabel(profileModalCaregiver.rating)}</p>
                  <span>{profileModalCaregiver.area} | {profileModalCaregiver.experience}</span>
                </div>
              </div>
              <div className="detail-grid">
                <div>
                  <span>About</span>
                  <strong>Reliable family-facing caregiver</strong>
                  <p>{profileModalCaregiver.bio}</p>
                </div>
                <div>
                  <span>Reliability stats</span>
                  <strong>{profileModalCaregiver.onTimeRate}% on-time</strong>
                  <p>{profileModalCaregiver.completionRate}% completed visits</p>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {!isCustomer && activeTab === "home" && data.client ? (
          <>
            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Today&apos;s Tasks</p>
                <h3>Focus on what needs action now</h3>
              </div>
              <div className="task-list">
                {tasksToday.map((task) => (
                  <article className="task-item checklist-item" key={task.id}>
                    <label className="checklist-row">
                      <input
                        checked={task.status === "Completed"}
                        onChange={() => updateTask(task.id, task.status === "Completed" ? "In Progress" : "Completed")}
                        type="checkbox"
                      />
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.description}</p>
                        <span>{task.task_type} | {task.priority} priority | Due {formatDate(task.due_date)}</span>
                      </div>
                    </label>
                    <span className={`status-badge ${task.status.toLowerCase().replaceAll(" ", "-")}`}>{task.status}</span>
                  </article>
                ))}
                {tasksToday.length === 0 ? <p className="supporting-copy">No assigned tasks are due today.</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Next Visit</p>
                <h3>{nextVisit ? nextVisit.type : "No visit assigned"}</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Time</span>
                  <strong>{nextVisit ? formatDateTime(nextVisit.starts_at) : "Waiting for schedule"}</strong>
                  <p>{data.client.full_name}</p>
                </div>
                <div>
                  <span>Action</span>
                  <strong>{activeVisitId ? "Visit in progress" : "Ready to begin"}</strong>
                  <p>Open the visit workflow when you arrive.</p>
                </div>
              </div>
              <div className="button-row">
                <button className="primary" onClick={() => startVisit(nextVisit?.id)} type="button">
                  Start Visit
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Client Snapshot</p>
                <h3>{data.client.full_name}</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Age</span>
                  <strong>{ageFromDate(data.client.dob)}</strong>
                  <p>{formatDate(data.client.dob)}</p>
                </div>
                <div>
                  <span>Mobility and notes</span>
                  <strong>{data.carePlan?.routines[0] ?? "Routine details pending"}</strong>
                  <p>{data.carePlan?.restrictions[0] ?? latestUpdate?.notes ?? "No recent notes yet."}</p>
                </div>
              </div>
            </section>

            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Visit Workflow</p>
                <h3>{activeVisitId ? "Visit in progress" : "Start the next visit when ready"}</h3>
              </div>
              {activeVisitId ? (
                <div className="stack">
                  <div className="visit-checklist">
                    <label className="checkbox-row">
                      <input
                        checked={visitChecklist.medication}
                        onChange={(event) => setVisitChecklist((current) => ({ ...current, medication: event.target.checked }))}
                        type="checkbox"
                      />
                      Medication reviewed
                    </label>
                    <label className="checkbox-row">
                      <input
                        checked={visitChecklist.hydration}
                        onChange={(event) => setVisitChecklist((current) => ({ ...current, hydration: event.target.checked }))}
                        type="checkbox"
                      />
                      Hydration checked
                    </label>
                    <label className="checkbox-row">
                      <input
                        checked={visitChecklist.mobility}
                        onChange={(event) => setVisitChecklist((current) => ({ ...current, mobility: event.target.checked }))}
                        type="checkbox"
                      />
                      Mobility support completed
                    </label>
                    <label className="checkbox-row">
                      <input
                        checked={visitChecklist.notesShared}
                        onChange={(event) => setVisitChecklist((current) => ({ ...current, notesShared: event.target.checked }))}
                        type="checkbox"
                      />
                      Notes ready to share
                    </label>
                  </div>
                  <label>
                    Summary notes
                    <textarea
                      onChange={(event) => setVisitWrapNote(event.target.value)}
                      placeholder="Write a short visit summary for the family."
                      value={visitWrapNote}
                    />
                  </label>
                  <div className="button-row">
                    <button className="secondary" onClick={() => setActiveVisitId(null)} type="button">
                      Pause
                    </button>
                    <button className="primary" onClick={endVisit} type="button">
                      End Visit
                    </button>
                  </div>
                </div>
              ) : (
                <p className="supporting-copy">Use Start Visit to begin the checklist and wrap-up flow.</p>
              )}
              {visitCompletionMessage ? <p className="supporting-copy">{visitCompletionMessage}</p> : null}
            </section>

            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Recent Activity</p>
                <h3>Latest completed work and notes</h3>
              </div>
              <div className="feed">
                {recentCompletedTasks.map((task) => (
                  <article className="feed-item" key={`done-${task.id}`}>
                    <div className="feed-header">
                      <strong>{task.title}</strong>
                      <span className="status-badge completed">Completed</span>
                    </div>
                    <p>{task.description}</p>
                  </article>
                ))}
                {recentVisitNotes.map((log) => (
                  <article className="feed-item" key={`log-${log.id}`}>
                    <div className="feed-header">
                      <strong>{formatDateTime(log.created_at)}</strong>
                      <span className={`status-badge ${log.status.toLowerCase().replaceAll(" ", "-")}`}>{log.status}</span>
                    </div>
                    <p>{summarizeText(log.notes, 120)}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!isCustomer && activeTab === "care" && data.client ? (
          <>
            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Calendar</p>
                <h3>Shared care schedule</h3>
              </div>
              <div className="calendar-toolbar">
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedCalendarEntry(null);
                    setCalendarWeekOffset((current) => current - 1);
                  }}
                  type="button"
                >
                  ← Previous week
                </button>
                <strong>{selectedWeekLabel}</strong>
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedCalendarEntry(null);
                    setCalendarWeekOffset((current) => current + 1);
                  }}
                  type="button"
                >
                  Next week →
                </button>
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const entries = sharedCalendarEntries.filter((entry) => entry.dayKey === day.dayKey);
                  return (
                    <article className="calendar-day" key={day.dayKey}>
                      <div className="calendar-day-header">
                        <span>{day.label}</span>
                        <strong>{day.dateLabel}</strong>
                      </div>
                      <div className="calendar-items">
                        {entries.map((entry) => (
                          <button
                            className={`calendar-item ${entry.kind} ${selectedCalendarEntry?.id === entry.id ? "selected" : ""}`}
                            key={entry.id}
                            onClick={() => setSelectedCalendarEntry(entry)}
                            type="button"
                          >
                            <p>{entry.timeLabel}</p>
                            <strong>{entry.title}</strong>
                            <span>{entry.detail}</span>
                          </button>
                        ))}
                        {entries.length === 0 ? <p className="calendar-empty">No items planned.</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Event Details</p>
                <h3>{selectedCalendarEntry ? selectedCalendarEntry.title : "Choose an event"}</h3>
              </div>
              {selectedCalendarEntry ? (
                <div className="stack">
                  <div className="detail-grid">
                    <div>
                      <span>When</span>
                      <strong>{selectedCalendarEntry.fullDateLabel}</strong>
                      <p>{selectedCalendarEntry.timeLabel}</p>
                    </div>
                    <div>
                      <span>Details</span>
                      <strong>{selectedCalendarEntry.detail}</strong>
                      <p>{selectedCalendarEntry.kind}</p>
                    </div>
                  </div>
                  <div className="button-row">
                    {selectedCalendarEntry.kind === "task" && selectedCalendarEntry.source === "existing" ? (
                      <button
                        className="primary"
                        onClick={() => updateTask(selectedCalendarEntry.id.replace(/^task-/, ""), "Completed")}
                        type="button"
                      >
                        Mark Task Complete
                      </button>
                    ) : null}
                    {selectedCalendarEntry.kind === "visit" ? (
                      <button className="primary" onClick={() => startVisit(selectedCalendarEntry.id)} type="button">
                        Start Visit
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="supporting-copy">Tap any event to view details and quick actions.</p>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Client Snapshot</p>
                <h3>{data.client.full_name}</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Age</span>
                  <strong>{ageFromDate(data.client.dob)}</strong>
                  <p>{formatDate(data.client.dob)}</p>
                </div>
                <div>
                  <span>Key notes</span>
                  <strong>{data.carePlan?.goals[0] ?? "Care goals pending"}</strong>
                  <p>{data.carePlan?.restrictions[0] ?? latestUpdate?.notes ?? "No recent update summary."}</p>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {!isCustomer && activeTab === "communication" && data.client ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Visit Update</p>
                <h3>Submit verified visit</h3>
              </div>
              <form className="stack" onSubmit={submitVisitLog}>
                <label>
                  Visit type
                  <select name="visit_type" defaultValue="in-person">
                    <option value="in-person">In-person</option>
                    <option value="virtual">Virtual</option>
                    <option value="errand run">Errand run</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status" defaultValue="Good">
                    <option value="Good">Good</option>
                    <option value="Needs Attention">Needs Attention</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </label>
                <div className="detail-grid">
                  <label>
                    Check-in
                    <input name="checked_in_at" type="datetime-local" required />
                  </label>
                  <label>
                    Check-out
                    <input name="checked_out_at" type="datetime-local" required />
                  </label>
                </div>
                <label>
                  Visit checklist
                  <input name="checklist_items" placeholder="Medication check, hydration, mobility walk" required />
                </label>
                <label className="checkbox-row">
                  <input name="checklist_completed" type="checkbox" />
                  Checklist completed
                </label>
                <label>
                  Notes
                  <textarea name="notes" placeholder="What changed during the visit?" required />
                </label>
                <button className="primary" type="submit">
                  Publish verified update
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Messages</p>
                <h3>Conversation</h3>
              </div>
              <div className="messages">
                {data.messages.map((message) => (
                  <article className={`message ${message.sender_id === data.user?.id ? "mine" : ""}`} key={message.id}>
                    <p>{message.content}</p>
                    <span>{formatDateTime(message.created_at)}</span>
                  </article>
                ))}
              </div>
              <form className="stack" onSubmit={submitMessage}>
                <label>
                  Message
                  <textarea name="content" placeholder="Share an update or request." required />
                </label>
                <button className="primary" type="submit">
                  Send
                </button>
              </form>
            </section>

            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Recent Updates</p>
                <h3>Care activity feed</h3>
              </div>
              <div className="feed">
                {data.logs.map((log) => (
                  <article className="feed-item" key={log.id}>
                    <div className="feed-header">
                      <div>
                        <strong>{formatDateTime(log.created_at)}</strong>
                        <p>{log.visit_type}</p>
                      </div>
                      <span className={`status-badge ${log.status.toLowerCase().replaceAll(" ", "-")}`}>{log.status}</span>
                    </div>
                    <p>{summarizeText(log.notes, 120)}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!isCustomer && activeTab === "account" ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Account</p>
                <h3>Caregiver profile</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Name</span>
                  <strong>{data.user.name}</strong>
                  <p>{data.user.phone ?? "Phone not added yet"}</p>
                </div>
                <div>
                  <span>Verification</span>
                  <strong>{data.caretakerProfile?.verified ? "Verified" : "Pending verification"}</strong>
                  <p>{Math.round(data.caretakerMetrics?.on_time_rate ?? 0)}% on-time arrival rate</p>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Client Snapshot</p>
                <h3>{data.client?.full_name ?? "No linked client"}</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Care plan</span>
                  <strong>{data.carePlan?.goals[0] ?? "Goal not set"}</strong>
                  <p>{data.carePlan?.routines[0] ?? "Routine not set"}</p>
                </div>
                <div>
                  <span>Last update</span>
                  <strong>{latestUpdate?.status ?? "No updates yet"}</strong>
                  <p>{latestUpdate ? summarizeText(latestUpdate.notes, 90) : "No recent visit summary."}</p>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {((!isCustomer && activeTab === "overview") || (isCustomer && activeTab === "home")) && data.client ? (
          <>
            <section className="panel wide welcome-panel">
              <div className="section-heading">
                <p className="section-kicker">Today</p>
                <h3>{isCustomer ? "Today's summery" : `Visit readiness for ${data.client.full_name}`}</h3>
                <p className="supporting-copy">
                  {isCustomer
                    ? "A quick snapshot of how things are going today."
                    : "This view keeps the care plan, verification details, and recent changes easy to review before the next visit."}
                </p>
              </div>
              <div className="detail-grid">
                <div>
                  <span>For</span>
                  <strong>{data.client.full_name}</strong>
                  <p>{ageFromDate(data.client.dob)} years old | {formatDate(data.client.dob)}</p>
                </div>
                <div>
                  <span>Latest note</span>
                  <strong>{latestUpdate?.status ?? "No updates yet"}</strong>
                  <p>{latestUpdate ? summarizeText(latestUpdate.notes, 96) : "The family will see the next caregiver update here."}</p>
                </div>
              </div>
            </section>

            {isCustomer ? (
              <>
                <section className="panel caregiver-panel">
                  <div className="section-heading">
                    <p className="section-kicker">Your Caregiver</p>
                    <h3>{currentCaregiver.name}</h3>
                    <p className="supporting-copy">
                      {currentCaregiver.bio}
                    </p>
                  </div>
                  <div className="caregiver-card">
                    <img alt={currentCaregiver.name} className="caregiver-photo" src={currentCaregiver.avatarUrl} />
                    <div className="caregiver-meta">
                      <div className="caregiver-row">
                        <strong>{currentCaregiver.name}</strong>
                        {currentCaregiver.verified ? <span className="verification-badge">Verified</span> : null}
                      </div>
                      <p>{starRatingLabel(currentCaregiver.rating)}</p>
                      <span>
                        {`${currentCaregiver.onTimeRate}% on-time | ${currentCaregiver.completionRate}% completed visits`}
                      </span>
                    </div>
                  </div>
                  <div className="detail-grid">
                    <div>
                      <span>Reliability</span>
                      <strong>{currentCaregiver.onTimeRate}%</strong>
                      <p>On-time arrival rate</p>
                    </div>
                    <div>
                      <span>Completed visits</span>
                      <strong>{currentCaregiver.completionRate}%</strong>
                      <p>Visit completion performance</p>
                    </div>
                  </div>
                  <div className="button-row">
                    <button className="secondary" onClick={() => setProfileModalCaregiver(currentCaregiver)} type="button">View Profile</button>
                    <button className="primary" onClick={() => setSwitchModalOpen(true)} type="button">Switch Caregiver</button>
                  </div>
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Weekly Summary</p>
                    <h3>This week</h3>
                  </div>
                  <div className="weekly-checklist">
                    <p>Visits completed: {completedVisitsThisWeek}</p>
                    <p>Tasks completed: {completedTasksThisWeek}</p>
                    <p>{openAlertCount === 0 ? "Issues reported: none" : `Alerts to review: ${openAlertCount}`}</p>
                  </div>
                  <div className="feed compact-feed">
                    {data.changeSummary.slice(0, 3).map((item) => (
                      <article className="feed-item" key={item.label}>
                        <div className="feed-header">
                          <strong>{item.label}</strong>
                          <span className={`status-badge ${item.direction === "up" ? "good" : item.direction === "down" ? "urgent" : "completed"}`}>
                            {item.direction}
                          </span>
                        </div>
                        <p>{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="section-heading">
                    <p className="section-kicker">Family Circle</p>
                    <h3>Shared care contacts</h3>
                  </div>
                  <div className="feed compact-feed">
                    {data.familyMembers.map((member) => (
                      <article className="feed-item" key={member.id}>
                        <div className="feed-header">
                          <strong>{member.name}</strong>
                          <span className="status-badge completed">{member.relationship}</span>
                        </div>
                        <p>{member.email}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Weekly brief</p>
                <h3>{data.weeklyBrief ? data.weeklyBrief.summary : "Weekly family brief"}</h3>
              </div>
              {data.weeklyBrief ? (
                <div className="detail-grid">
                  <div>
                    <span>Generated</span>
                    <strong>{formatDateTime(data.weeklyBrief.generated_at)}</strong>
                    <p>{summarizeText(data.weeklyBrief.summary, 120)}</p>
                  </div>
                  <div>
                    <span>Next steps</span>
                    <ul className="plain-list compact">
                      {data.weeklyBrief.next_steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="supporting-copy">No weekly brief has been generated yet.</p>
              )}
            </section>
          </>
        ) : null}

        {isCustomer && activeTab === "care" && data.client ? (
          <>
            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Scheduling</p>
                <h3>Shared calendar</h3>
                <p className="supporting-copy">
                  Review upcoming appointments, rides, visits, tasks, and recurring weekly routines in one place.
                </p>
              </div>
              <div className="calendar-toolbar">
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedCalendarEntry(null);
                    setCalendarWeekOffset((current) => current - 1);
                  }}
                  type="button"
                >
                  ← Previous week
                </button>
                <strong>{selectedWeekLabel}</strong>
                <button
                  className="secondary"
                  onClick={() => {
                    setSelectedCalendarEntry(null);
                    setCalendarWeekOffset((current) => current + 1);
                  }}
                  type="button"
                >
                  Next week →
                </button>
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => {
                  const entries = sharedCalendarEntries.filter((entry) => entry.dayKey === day.dayKey);
                  return (
                    <article className="calendar-day" key={day.dayKey}>
                      <div className="calendar-day-header">
                        <span>{day.label}</span>
                        <strong>{day.dateLabel}</strong>
                      </div>
                      <div className="calendar-items">
                        {entries.map((entry) => (
                          <button
                            className={`calendar-item ${entry.kind} ${selectedCalendarEntry?.id === entry.id ? "selected" : ""}`}
                            key={entry.id}
                            onClick={() => setSelectedCalendarEntry(entry)}
                            type="button"
                          >
                            <p>{entry.timeLabel}</p>
                            <strong>{entry.title}</strong>
                            <span>{entry.detail}</span>
                          </button>
                        ))}
                        {entries.length === 0 ? <p className="calendar-empty">No items planned.</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Event details</p>
                <h3>{selectedCalendarEntry ? selectedCalendarEntry.title : "Choose a calendar item"}</h3>
              </div>
              {selectedCalendarEntry ? (
                <div className="detail-grid">
                  <div>
                    <span>When</span>
                    <strong>{selectedCalendarEntry.fullDateLabel}</strong>
                    <p>{selectedCalendarEntry.timeLabel}</p>
                  </div>
                  <div>
                    <span>Details</span>
                    <strong>{selectedCalendarEntry.detail}</strong>
                    <p>{selectedDayEntries.length > 1 ? `${selectedDayEntries.length} items on this day` : "Single event on the schedule"}</p>
                  </div>
                </div>
              ) : (
                <p className="supporting-copy">Select an event from the calendar to view its details here.</p>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Quick add</p>
                <h3>Add to the care calendar</h3>
              </div>
              <div className="composer-toggle" role="tablist" aria-label="Care composer mode">
                <button
                  className={careComposerMode === "event" ? "active" : ""}
                  onClick={() => setCareComposerMode("event")}
                  type="button"
                >
                  Event
                </button>
                <button
                  className={careComposerMode === "task" ? "active" : ""}
                  onClick={() => setCareComposerMode("task")}
                  type="button"
                >
                  Task
                </button>
              </div>
              <form className="stack" onSubmit={submitCareComposer}>
                {careComposerMode === "event" ? (
                  <>
                    <label>
                      Event type
                      <select name="event_type" defaultValue="appointment">
                        <option value="appointment">Appointment</option>
                        <option value="visit">Visit</option>
                      </select>
                    </label>
                    <label className="checkbox-row">
                      <input
                        checked={careComposerRecurring}
                        onChange={(nextEvent) => setCareComposerRecurring(nextEvent.target.checked)}
                        type="checkbox"
                      />
                      Is recurring weekly event
                    </label>
                    <label>
                      Title
                      <input name="title" placeholder={careComposerRecurring ? "Tuesday medication reminder" : "Doctor visit"} required />
                    </label>
                    {careComposerRecurring ? (
                      <div className="detail-grid">
                        <label>
                          Day of week
                          <select name="weekday" defaultValue="1">
                            <option value="0">Sunday</option>
                            <option value="1">Monday</option>
                            <option value="2">Tuesday</option>
                            <option value="3">Wednesday</option>
                            <option value="4">Thursday</option>
                            <option value="5">Friday</option>
                            <option value="6">Saturday</option>
                          </select>
                        </label>
                        <label>
                          Time
                          <input name="time" type="time" required />
                        </label>
                      </div>
                    ) : (
                      <label>
                        Date and time
                        <input name="starts_at" type="datetime-local" required />
                      </label>
                    )}
                    <label>
                      Notes
                      <textarea name="details" placeholder="Add a short note for the calendar." />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Request type
                      <select name="task_type" defaultValue="errand">
                        <option value="errand">Errand</option>
                        <option value="transport">Transportation</option>
                        <option value="appointment">Appointment</option>
                        <option value="family_follow_up">Family follow-up</option>
                      </select>
                    </label>
                    <label>
                      Title
                      <input name="title" placeholder="Pick up medication" required />
                    </label>
                    <label>
                      Description
                      <textarea name="description" placeholder="Include provider, store, location, or care notes." required />
                    </label>
                    <div className="detail-grid">
                      <label>
                        Priority
                        <select name="priority" defaultValue="Medium">
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </label>
                      <label>
                        Preferred completion date
                        <input name="due_date" type="date" required />
                      </label>
                    </div>
                    <label>
                      Assignee
                      <input name="assigned_to" placeholder="Optional owner: caretaker, daughter, son" />
                    </label>
                  </>
                )}
                <button className="primary" type="submit">
                  {careComposerMode === "task"
                    ? "Send request"
                    : careComposerRecurring
                      ? "Add weekly event"
                      : "Add event"}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Shared work</p>
                <h3>Task queue</h3>
              </div>
              <div className="task-list">
                {data.tasks.map((task) => (
                  <article className="task-item" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                      <span>{task.task_type} | {task.priority} priority | Due {formatDate(task.due_date)}</span>
                    </div>
                    <div className="task-actions">
                      <span className={`status-badge ${task.status.toLowerCase().replaceAll(" ", "-")}`}>{task.status}</span>
                    </div>
                  </article>
                ))}
                {data.tasks.length === 0 ? <p className="supporting-copy">No shared tasks have been added yet.</p> : null}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Saved routines</p>
                <h3>Recurring weekly events</h3>
              </div>
              <div className="feed">
                {recurringEvents.map((event) => (
                  <article className="feed-item" key={event.id}>
                    <div className="feed-header">
                      <strong>{event.title}</strong>
                      <button className="secondary" onClick={() => removeRecurringEvent(event.id)} type="button">
                        Remove
                      </button>
                    </div>
                    <p>{weekdayLabel(event.weekday)} at {formatTimeValue(event.time)}</p>
                    <p>{event.details ?? "No extra notes added."}</p>
                  </article>
                ))}
                {recurringEvents.length === 0 ? <p className="supporting-copy">No recurring weekly events have been added yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {((!isCustomer && activeTab === "client") || (isCustomer && activeTab === "care")) && data.client ? (
          <>
            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Care plan</p>
                <h3>Care profile and daily plan</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Emergency contact</span>
                  <strong>{data.client.emergency_contacts[0]?.name ?? "Not set"}</strong>
                  <p>{data.client.emergency_contacts[0]?.phone ?? "No emergency contact available"}</p>
                </div>
                <div>
                  <span>Subscription tier</span>
                  <strong>{humanizePlan(data.client.subscription_tier_id ?? "unassigned")}</strong>
                </div>
                <div>
                  <span>Transportation needs</span>
                  <strong>{data.client.transportation_flag ? "Required" : "Not required"}</strong>
                </div>
                <div>
                  <span>Accessibility</span>
                  <strong>{data.carePlan?.large_text_mode ? "Large text enabled" : "Standard text"}</strong>
                  <p>{data.carePlan?.high_contrast_mode ? "High contrast enabled" : "High contrast disabled"}</p>
                </div>
              </div>
              {data.carePlan ? (
                <div className="detail-grid">
                  <div>
                    <span>Goals</span>
                    <ul className="plain-list compact">{data.carePlan.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
                  </div>
                  <div>
                    <span>Routines</span>
                    <ul className="plain-list compact">{data.carePlan.routines.map((routine) => <li key={routine}>{routine}</li>)}</ul>
                  </div>
                  <div>
                    <span>Restrictions</span>
                    <ul className="plain-list compact">{data.carePlan.restrictions.map((restriction) => <li key={restriction}>{restriction}</li>)}</ul>
                  </div>
                  <div>
                    <span>Medication schedule</span>
                    <ul className="plain-list compact">{data.carePlan.medication_schedule.map((entry) => <li key={entry}>{entry}</li>)}</ul>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {((!isCustomer && activeTab === "coordination") || (isCustomer && activeTab === "care")) && data.client ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Shared access</p>
                <h3>Family collaboration</h3>
              </div>
              <div className="feed">
                {data.familyMembers.map((member) => (
                  <article className="feed-item" key={member.id}>
                    <div className="feed-header">
                      <strong>{member.name}</strong>
                      <span className="status-badge completed">{member.relationship}</span>
                    </div>
                    <p>{member.email}</p>
                    <p>{member.permissions.join(", ")}{member.ownership_label ? ` | ${member.ownership_label}` : ""}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Scheduling</p>
                <h3>Appointments and rides</h3>
              </div>
              <div className="feed">
                {data.appointments.map((appointment) => (
                  <article className="feed-item" key={appointment.id}>
                    <div className="feed-header">
                      <strong>{appointment.title}</strong>
                      <span className={`status-badge ${appointment.status.toLowerCase().replaceAll(" ", "-")}`}>{appointment.status}</span>
                    </div>
                    <p>{appointment.provider}</p>
                    <p>{formatDateTime(appointment.scheduled_for)}{appointment.transport_needed ? " | transportation required" : ""}</p>
                  </article>
                ))}
                {data.transportRequests.map((request) => (
                  <article className="feed-item" key={request.id}>
                    <div className="feed-header">
                      <strong>Transportation coordination</strong>
                      <span className={`status-badge ${request.status.toLowerCase().replaceAll(" ", "-")}`}>{request.status}</span>
                    </div>
                    <p>{request.pickup_location} to {request.dropoff_location}</p>
                    <p>{formatDateTime(request.scheduled_for)}{request.coordination_notes ? ` | ${request.coordination_notes}` : ""}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel wide">
              <div className="section-heading">
                <p className="section-kicker">Safety watch</p>
                <h3>Proactive alerts and incidents</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Risk alerts</span>
                  <ul className="plain-list compact">
                    {data.alerts.map((alert) => (
                      <li key={alert.id}>{alert.severity} {alert.type}: {alert.summary}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span>Incident trail</span>
                  <ul className="plain-list compact">
                    {data.incidents.map((incident) => (
                      <li key={incident.id}>
                        {incident.severity}: {incident.summary}
                        {incident.acknowledged_by_family_at ? ` | acknowledged ${formatDateTime(incident.acknowledged_by_family_at)}` : " | awaiting family acknowledgment"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {((!isCustomer && activeTab === "updates") || (isCustomer && (activeTab === "home" || activeTab === "communication"))) && data.client ? (
          <>
            {!isCustomer ? (
              <section className="panel">
                <div className="section-heading">
                  <p className="section-kicker">Visit reporting</p>
                  <h3>Submit verified visit</h3>
                </div>
                <form className="stack" onSubmit={submitVisitLog}>
                  <label>
                    Visit type
                    <select name="visit_type" defaultValue="in-person">
                      <option value="in-person">In-person</option>
                      <option value="virtual">Virtual</option>
                      <option value="errand run">Errand run</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select name="status" defaultValue="Good">
                      <option value="Good">Good</option>
                      <option value="Needs Attention">Needs Attention</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </label>
                  <div className="detail-grid">
                    <label>
                      Check-in
                      <input name="checked_in_at" type="datetime-local" required />
                    </label>
                    <label>
                      Check-out
                      <input name="checked_out_at" type="datetime-local" required />
                    </label>
                  </div>
                  <label>
                    Visit checklist
                    <input name="checklist_items" placeholder="Medication check, hydration, mobility walk" required />
                  </label>
                  <label className="checkbox-row">
                    <input name="checklist_completed" type="checkbox" />
                    Checklist completed
                  </label>
                  <div className="detail-grid">
                    <label>
                      Mood
                      <input name="mood_score" type="number" min="1" max="5" defaultValue="4" />
                    </label>
                    <label>
                      Mobility
                      <input name="mobility_score" type="number" min="1" max="5" defaultValue="4" />
                    </label>
                    <label>
                      Appetite
                      <input name="appetite_score" type="number" min="1" max="5" defaultValue="4" />
                    </label>
                    <label>
                      Engagement
                      <input name="engagement_score" type="number" min="1" max="5" defaultValue="4" />
                    </label>
                  </div>
                  <label>
                    Medication adherence
                    <select name="medication_adherence" defaultValue="On Track">
                      <option value="On Track">On Track</option>
                      <option value="Needs Reminder">Needs Reminder</option>
                      <option value="Missed Dose">Missed Dose</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input name="home_safety_flag" type="checkbox" />
                    Home safety issue observed
                  </label>
                  <label>
                    Notes
                    <textarea name="notes" placeholder="What changed during the visit?" required />
                  </label>
                  <label>
                    Photo URL
                    <input name="photo_url" placeholder="Optional proof-of-care image link" />
                  </label>
                  <label className="checkbox-row">
                    <input name="incident_flag" type="checkbox" />
                    Incident report needed
                  </label>
                  <label className="checkbox-row">
                    <input name="emergency_flag" type="checkbox" />
                    Emergency escalation
                  </label>
                  <label>
                    Incident severity
                    <select name="incident_severity" defaultValue="Medium">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  <label>
                    Incident summary
                    <textarea name="incident_summary" placeholder="Describe what happened if an incident needs to be logged." />
                  </label>
                  <label>
                    Actions taken
                    <textarea name="incident_actions" placeholder="List follow-up actions, notifications, or next steps." />
                  </label>
                  <button className="primary" type="submit">
                    Publish verified update
                  </button>
                </form>
              </section>
            ) : null}

            <section className={`panel ${isCustomer ? "wide" : ""}`}>
              <div className="section-heading">
                <p className="section-kicker">{isCustomer && activeTab === "home" ? "Recent updates" : "Update stream"}</p>
                <h3>{isCustomer && activeTab === "home" ? "Recent care updates" : "Care updates feed"}</h3>
              </div>
              <div className="feed">
                {visibleLogs.map((log) => (
                  <article className="feed-item" key={log.id}>
                    <div className="feed-header">
                      <div>
                        <strong>{formatDateTime(log.created_at)}</strong>
                        <p>{log.visit_type}</p>
                      </div>
                      <span className={`status-badge ${log.status.toLowerCase().replaceAll(" ", "-")}`}>{log.status}</span>
                    </div>
                    <p>{log.notes}</p>
                    <p>
                      Verified {log.verification.checklist_completed ? "checklist complete" : "checklist incomplete"} |
                      mood {log.assessment.mood_score ?? "?"} | mobility {log.assessment.mobility_score ?? "?"} | appetite {log.assessment.appetite_score ?? "?"}
                    </p>
                    <p>{log.verification.checklist_items.join(", ")}</p>
                    {log.photo_url ? <img alt="Care update attachment" className="feed-photo" src={log.photo_url} /> : null}
                    {log.incident_flag ? <p className="error">Incident was recorded for this visit.</p> : null}
                    {log.emergency_flag ? <p className="error">Emergency escalation sent to family and support.</p> : null}
                  </article>
                ))}
                {visibleLogs.length === 0 ? <p className="supporting-copy">No visit updates have been shared yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {((!isCustomer && activeTab === "messages") || (isCustomer && activeTab === "communication")) && data.thread ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Communication</p>
                <h3>Conversation</h3>
              </div>
              <div className="messages">
                {data.messages.map((message) => (
                  <article className={`message ${message.sender_id === data.user?.id ? "mine" : ""}`} key={message.id}>
                    <p>{message.content}</p>
                    <span>{formatDateTime(message.created_at)}</span>
                  </article>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">New message</p>
                <h3>Send message</h3>
              </div>
              <form className="stack" onSubmit={submitMessage}>
                <label>
                  Message
                  <textarea name="content" placeholder="Share an update or request." required />
                </label>
                <label>
                  Attachment URL
                  <input name="attachment_url" placeholder="Optional file link" />
                </label>
                <button className="primary" type="submit">
                  Send
                </button>
              </form>
            </section>
          </>
        ) : null}

        {(!isCustomer && activeTab === "tasks") && data.client ? (
          <>
            {isCustomer ? (
              <section className="panel">
                <div className="section-heading">
                  <p className="section-kicker">Request support</p>
                  <h3>Submit coordinated request</h3>
                </div>
                <form className="stack" onSubmit={submitTask}>
                  <label>
                    Request type
                    <select name="task_type" defaultValue="errand">
                      <option value="errand">Errand</option>
                      <option value="transport">Transportation</option>
                      <option value="appointment">Appointment</option>
                      <option value="family_follow_up">Family follow-up</option>
                    </select>
                  </label>
                  <label>
                    Title
                    <input name="title" placeholder="Pick up medication" required />
                  </label>
                  <label>
                    Description
                    <textarea name="description" placeholder="Include provider, store, location, or care notes." required />
                  </label>
                  <div className="detail-grid">
                    <label>
                      Priority
                      <select name="priority" defaultValue="Medium">
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </label>
                    <label>
                      Preferred completion date
                      <input name="due_date" type="date" required />
                    </label>
                  </div>
                  <label>
                    Assignee
                    <input name="assigned_to" placeholder="Optional owner: caretaker, daughter, son" />
                  </label>
                  <button className="primary" type="submit">
                    Send request
                  </button>
                </form>
              </section>
            ) : null}

            <section className={`panel ${!isCustomer ? "wide" : ""}`}>
              <div className="section-heading">
                <p className="section-kicker">Shared work</p>
                <h3>Shared task queue</h3>
              </div>
              <div className="task-list">
                {data.tasks.map((task) => (
                  <article className="task-item" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                      <span>{task.task_type} | {task.priority} priority | Due {formatDate(task.due_date)}</span>
                    </div>
                    <div className="task-actions">
                      <span className={`status-badge ${task.status.toLowerCase().replaceAll(" ", "-")}`}>{task.status}</span>
                      {!isCustomer ? (
                        <>
                          <button className="secondary" onClick={() => updateTask(task.id, "In Progress")} type="button">
                            In progress
                          </button>
                          <button className="primary" onClick={() => updateTask(task.id, "Completed")} type="button">
                            Complete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {isCustomer && activeTab === "account" ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Settings</p>
                <h3>Family account settings</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Account owner</span>
                  <strong>{data.user.name}</strong>
                  <p>{data.user.phone ?? "Phone not added yet"}</p>
                </div>
                <div>
                  <span>Linked care recipient</span>
                  <strong>{data.client?.full_name ?? "Not linked yet"}</strong>
                  <p>{data.client ? `Emergency contact: ${data.client.emergency_contacts[0]?.name ?? "Not set"}` : "No linked profile"}</p>
                </div>
                <div>
                  <span>Reading preferences</span>
                  <strong>{data.carePlan?.large_text_mode ? "Large text enabled" : "Standard text"}</strong>
                  <p>{data.carePlan?.high_contrast_mode ? "High contrast enabled" : "High contrast disabled"}</p>
                </div>
                <div>
                  <span>Support posture</span>
                  <strong>{data.tickets.filter((ticket) => ticket.status !== "Resolved").length} open requests</strong>
                  <p>{unreadCount} unread conversation updates</p>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Billing</p>
                <h3>Plan and billing summary</h3>
              </div>
              <div className="detail-grid">
                <div>
                  <span>Current plan</span>
                  <strong>{currentPlan?.name ?? humanizePlan(data.client?.subscription_tier_id ?? "unassigned")}</strong>
                  <p>{currentPlan ? `$${currentPlan.price_monthly}/month` : "No active plan selected"}</p>
                </div>
                <div>
                  <span>Coverage rhythm</span>
                  <strong>{currentPlan?.visit_frequency ?? "Customized care schedule"}</strong>
                  <p>{currentPlan?.update_frequency ?? "Updates shared as care is completed"}</p>
                </div>
              </div>
            </section>

          <section className="panel wide">
            <div className="section-heading">
              <p className="section-kicker">Billing options</p>
              <h3>Manage subscription plans</h3>
            </div>
            <div className="plan-grid">
              {data.plans.map((plan) => (
                <article className={`plan-card ${data.user?.subscription_plan_id === plan.id ? "selected" : ""}`} key={plan.id}>
                  <p>{plan.name}</p>
                  <strong>${plan.price_monthly}/mo</strong>
                  <span>{plan.visit_frequency}</span>
                  <span>{plan.update_frequency}</span>
                  <ul className="plain-list compact">
                    {Object.entries(plan.features).map(([key, enabled]) => (
                      <li key={key}>{enabled ? "Included" : "Not included"}: {key.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                  <button
                    className={data.user?.subscription_plan_id === plan.id ? "secondary" : "primary"}
                    onClick={() => switchPlan(plan.id)}
                    type="button"
                  >
                    {data.user?.subscription_plan_id === plan.id ? "Current plan" : "Switch plan"}
                  </button>
                </article>
              ))}
            </div>
          </section>
          </>
        ) : null}

        {isCustomer && activeTab === "account" ? (
          <>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Help desk</p>
                <h3>Open support ticket</h3>
              </div>
              <form className="stack" onSubmit={submitSupportTicket}>
                <label>
                  Category
                  <select name="category" defaultValue="Billing">
                    <option value="Billing">Billing</option>
                    <option value="Caretaker Concern">Caretaker Concern</option>
                    <option value="Technical">Technical</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label>
                  Description
                  <textarea name="description" placeholder="Describe the issue for the CapableCare team." required />
                </label>
                <label>
                  Attachment URL
                  <input name="attachment_url" placeholder="Optional file link" />
                </label>
                <button className="primary" type="submit">
                  Submit ticket
                </button>
              </form>
            </section>
            <section className="panel">
              <div className="section-heading">
                <p className="section-kicker">Support history</p>
                <h3>Ticket status</h3>
              </div>
              <div className="feed">
                {data.tickets.map((ticket) => (
                  <article className="feed-item" key={ticket.id}>
                    <div className="feed-header">
                      <div>
                        <strong>{ticket.category}</strong>
                        <p>{formatDateTime(ticket.created_at)}</p>
                      </div>
                      <span className={`status-badge ${ticket.status.toLowerCase().replaceAll(" ", "-")}`}>{ticket.status}</span>
                    </div>
                    <p>{ticket.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function formatDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "N/A";
}

function formatDateTime(value?: string) {
  return value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "N/A";
}

function ageFromDate(value: string) {
  const birth = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
}

function humanizePlan(planId: string) {
  return planId.replace("plan-", "").replace(/^\w/, (match) => match.toUpperCase());
}

function confidenceLabel(status: ConfidenceStatus) {
  switch (status) {
    case "Stable":
      return "Strong and steady";
    case "Watch":
      return "Worth a closer look";
    case "Action Needed":
      return "Follow-up recommended";
    default:
      return status;
  }
}

function recurringEventsKey(clientId: string) {
  return `capablecare-recurring-events-${clientId}`;
}

function customCalendarEventsKey(clientId: string) {
  return `capablecare-calendar-events-${clientId}`;
}

function buildCalendarDays(weekStart: Date) {
  const start = startOfDay(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      dayKey: isoDayKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      dateLabel: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });
}

function buildSharedCalendarEntries(input: {
  tasks: DashboardData["tasks"];
  appointments: Appointment[];
  transportRequests: TransportRequest[];
  upcomingVisits: ScheduledVisit[];
  recurringEvents: RecurringEvent[];
  customCalendarEvents: CustomCalendarEvent[];
  weekStart: Date;
}): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const days = buildCalendarDays(input.weekStart);
  const validDayKeys = new Set(days.map((day) => day.dayKey));
  const start = startOfDay(input.weekStart);

  for (const task of input.tasks) {
    if (!task.due_date) continue;
    const date = new Date(task.due_date);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `task-${task.id}`,
      dayKey,
      timeLabel: "Any time",
      title: task.title,
      detail: `${task.priority} priority task`,
      kind: "task",
      fullDateLabel: formatCalendarDate(date),
      source: "existing",
    });
  }

  for (const appointment of input.appointments) {
    const date = new Date(appointment.scheduled_for);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `appointment-${appointment.id}`,
      dayKey,
      timeLabel: formatCalendarTime(date),
      title: appointment.title,
      detail: `${appointment.provider}${appointment.transport_needed ? " | transportation needed" : ""}`,
      kind: "appointment",
      fullDateLabel: formatCalendarDate(date),
      source: "existing",
    });
  }

  for (const request of input.transportRequests) {
    const date = new Date(request.scheduled_for);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `transport-${request.id}`,
      dayKey,
      timeLabel: formatCalendarTime(date),
      title: "Transportation",
      detail: `${request.pickup_location} to ${request.dropoff_location}`,
      kind: "transport",
      fullDateLabel: formatCalendarDate(date),
      source: "existing",
    });
  }

  for (const visit of input.upcomingVisits) {
    const date = new Date(visit.starts_at);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `visit-${visit.id}`,
      dayKey,
      timeLabel: formatCalendarTime(date),
      title: visit.type,
      detail: "Scheduled care visit",
      kind: "visit",
      fullDateLabel: formatCalendarDate(date),
      source: "existing",
    });
  }

  for (const event of input.recurringEvents) {
    const date = nextDateForWeekday(start, event.weekday);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `routine-${event.id}-${dayKey}`,
      dayKey,
      timeLabel: formatTimeValue(event.time),
      title: event.title,
      detail: event.details ?? "Weekly recurring routine",
      kind: "routine",
      fullDateLabel: formatCalendarDate(date),
      source: "recurring",
    });
  }

  for (const event of input.customCalendarEvents) {
    const date = new Date(event.starts_at);
    const dayKey = isoDayKey(date);
    if (!validDayKeys.has(dayKey)) continue;
    entries.push({
      id: `custom-${event.id}`,
      dayKey,
      timeLabel: formatCalendarTime(date),
      title: event.title,
      detail: event.details ?? `${capitalize(event.type)} added from the family calendar`,
      kind: event.type,
      fullDateLabel: formatCalendarDate(date),
      source: "custom",
    });
  }

  return entries.sort((left, right) => {
    if (left.dayKey !== right.dayKey) return left.dayKey.localeCompare(right.dayKey);
    return left.timeLabel.localeCompare(right.timeLabel);
  });
}

function weekdayLabel(weekday: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ?? "Unknown";
}

function formatTimeValue(value: string) {
  if (!value) return "Any time";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatCalendarTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatCalendarDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date, weekOffset = 0) {
  const next = startOfDay(date);
  const dayOffset = next.getDay();
  next.setDate(next.getDate() - dayOffset + weekOffset * 7);
  return next;
}

function isoDayKey(date: Date) {
  const next = startOfDay(date);
  return next.toISOString().slice(0, 10);
}

function nextDateForWeekday(from: Date, weekday: number) {
  const next = startOfDay(from);
  const offset = (weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + offset);
  return next;
}

function formatWeekRange(days: Array<{ dateLabel: string }>) {
  if (days.length === 0) return "";
  return `${days[0].dateLabel} - ${days[days.length - 1].dateLabel}`;
}

function isDateInWeek(date: Date, weekStart: Date) {
  const start = startOfDay(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function isSameDay(left: Date, right: Date) {
  return isoDayKey(left) === isoDayKey(right);
}

function deriveCaregiverRating(onTimeRate: number, completionRate: number) {
  const blended = (onTimeRate + completionRate) / 2;
  return Math.max(3.5, Math.min(5, Number((3 + blended / 50).toFixed(1))));
}

function starRatingLabel(rating: number) {
  return `${rating.toFixed(1)} star family rating`;
}

function peaceOfMindStatus(status: ConfidenceStatus) {
  switch (status) {
    case "Stable":
      return { label: "All Good", tone: "tone-good" };
    case "Watch":
      return { label: "Needs Attention", tone: "tone-watch" };
    case "Action Needed":
      return { label: "Action Needed", tone: "tone-alert" };
    default:
      return { label: status, tone: "tone-good" };
  }
}

function summarizeText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function capitalize(value: string) {
  return value.replace(/^\w/, (match) => match.toUpperCase());
}

function formValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function optionalFormValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function numberOrNull(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
