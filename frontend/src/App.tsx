import { FormEvent, useEffect, useState } from "react";
import {
  ConfidenceStatus,
  DashboardData,
  Role,
  Task,
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

export function App() {
  const [role, setRole] = useState<Role>("customer");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);

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
      setActiveTab("overview");
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

  if (!data.user) {
    return (
      <div className="shell auth-shell">
        <section className="hero">
          <p className="eyebrow">CapableCare Trust Engine</p>
          <h1>Family confidence, verified care, proactive coordination.</h1>
          <p className="lede">
            The MVP now combines verified visits, change detection, family collaboration, transportation coordination,
            and weekly care briefs on top of Supabase-managed auth and data.
          </p>
          <div className="demo-cards">
            <article>
              <span>Customer test account</span>
              <strong>family.capablecare@example.com</strong>
              <p>Use the configured customer demo password in your local environment.</p>
            </article>
            <article>
              <span>Caretaker test account</span>
              <strong>caretaker.capablecare@example.com</strong>
              <p>Use the configured caretaker demo password in your local environment.</p>
            </article>
          </div>
        </section>

        <section className="auth-card">
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
  const tabs = isCustomer
    ? ["overview", "coordination", "updates", "messages", "tasks", "plans", "support"]
    : ["overview", "client", "coordination", "updates", "messages", "tasks"];
  const latestUpdate = data.logs[0];
  const unreadCount = Math.max(data.messages.length - 1, 0);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CapableCare Portal</p>
          <h2>{isCustomer ? "Family confidence center" : "Verified caretaker workspace"}</h2>
        </div>
        <div className="topbar-actions">
          <div className="notification-pill">Unread {unreadCount}</div>
          <button className="secondary" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card highlight">
          <p>Care confidence</p>
          <strong>{data.confidenceStatus}</strong>
          <span>{data.confidenceSummary}</span>
        </article>
        <article className="summary-card">
          <p>Latest status</p>
          <strong>{latestUpdate?.status ?? "No updates"}</strong>
          <span>{latestUpdate ? formatDateTime(latestUpdate.created_at) : "Waiting for first visit log"}</span>
        </article>
        <article className="summary-card">
          <p>Upcoming visits</p>
          <strong>{data.user.upcoming_visits?.length ?? 0}</strong>
          <span>{isCustomer ? "Shared with family circle" : "Visible to the family circle"}</span>
        </article>
        <article className="summary-card">
          <p>Open risks</p>
          <strong>{data.alerts.filter((alert) => alert.status !== "Resolved").length}</strong>
          <span>{data.transportRequests.length} transportation requests in coordination</span>
        </article>
      </section>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
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

        {activeTab === "overview" && data.client ? (
          <>
            <section className="panel">
              <h3>Trust and verification</h3>
              <div className="detail-grid">
                <div>
                  <span>Client</span>
                  <strong>{data.client.full_name}</strong>
                  <p>{ageFromDate(data.client.dob)} years old • {formatDate(data.client.dob)}</p>
                </div>
                <div>
                  <span>Latest verified visit</span>
                  <strong>{latestUpdate?.verification.checklist_completed ? "Checklist complete" : "Checklist pending"}</strong>
                  <p>
                    {latestUpdate?.verification.checked_in_at
                      ? `${formatDateTime(latestUpdate.verification.checked_in_at)} to ${formatDateTime(latestUpdate.verification.checked_out_at ?? undefined)}`
                      : "No timestamped visit verification yet"}
                  </p>
                </div>
                <div>
                  <span>Trust profile</span>
                  <strong>{data.caretakerProfile?.name ?? "Caretaker unassigned"}</strong>
                  <p>
                    {data.caretakerMetrics
                      ? `${Math.round(data.caretakerMetrics.on_time_rate)}% on-time • ${Math.round(data.caretakerMetrics.verified_visit_rate)}% verified visits`
                      : "Caretaker metrics pending"}
                  </p>
                </div>
                <div>
                  <span>Family circle</span>
                  <strong>{data.familyMembers.length} active relatives</strong>
                  <p>{data.familyMembers.map((member) => member.relationship).join(", ") || "No shared access yet"}</p>
                </div>
              </div>
            </section>

            <section className="panel">
              <h3>What changed this week</h3>
              <div className="feed">
                {data.changeSummary.map((item) => (
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

            <section className="panel wide">
              <h3>Weekly family brief</h3>
              {data.weeklyBrief ? (
                <div className="detail-grid">
                  <div>
                    <span>Summary</span>
                    <strong>{data.weeklyBrief.summary}</strong>
                    <p>Generated {formatDateTime(data.weeklyBrief.generated_at)}</p>
                  </div>
                  <div>
                    <span>Concerns</span>
                    <ul className="plain-list compact">
                      {data.weeklyBrief.concerns.map((concern) => (
                        <li key={concern}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span>Next actions</span>
                    <ul className="plain-list compact">
                      {data.weeklyBrief.next_steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span>Open alerts</span>
                    <ul className="plain-list compact">
                      {data.alerts.map((alert) => (
                        <li key={alert.id}>{alert.severity} {alert.type}: {alert.summary}</li>
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

        {activeTab === "client" && data.client ? (
          <>
            <section className="panel wide">
              <h3>Care profile and plan</h3>
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

        {activeTab === "coordination" && data.client ? (
          <>
            <section className="panel">
              <h3>Family collaboration</h3>
              <div className="feed">
                {data.familyMembers.map((member) => (
                  <article className="feed-item" key={member.id}>
                    <div className="feed-header">
                      <strong>{member.name}</strong>
                      <span className="status-badge completed">{member.relationship}</span>
                    </div>
                    <p>{member.email}</p>
                    <p>{member.permissions.join(", ")}{member.ownership_label ? ` • ${member.ownership_label}` : ""}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <h3>Appointments and rides</h3>
              <div className="feed">
                {data.appointments.map((appointment) => (
                  <article className="feed-item" key={appointment.id}>
                    <div className="feed-header">
                      <strong>{appointment.title}</strong>
                      <span className={`status-badge ${appointment.status.toLowerCase().replaceAll(" ", "-")}`}>{appointment.status}</span>
                    </div>
                    <p>{appointment.provider}</p>
                    <p>{formatDateTime(appointment.scheduled_for)}{appointment.transport_needed ? " • transportation required" : ""}</p>
                  </article>
                ))}
                {data.transportRequests.map((request) => (
                  <article className="feed-item" key={request.id}>
                    <div className="feed-header">
                      <strong>Transportation coordination</strong>
                      <span className={`status-badge ${request.status.toLowerCase().replaceAll(" ", "-")}`}>{request.status}</span>
                    </div>
                    <p>{request.pickup_location} to {request.dropoff_location}</p>
                    <p>{formatDateTime(request.scheduled_for)}{request.coordination_notes ? ` • ${request.coordination_notes}` : ""}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel wide">
              <h3>Proactive alerts and incidents</h3>
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
                        {incident.acknowledged_by_family_at ? ` • acknowledged ${formatDateTime(incident.acknowledged_by_family_at)}` : " • awaiting family acknowledgment"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "updates" && data.client ? (
          <>
            {!isCustomer ? (
              <section className="panel">
                <h3>Submit verified visit</h3>
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
              <h3>Care updates feed</h3>
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
                    <p>{log.notes}</p>
                    <p>
                      Verified {log.verification.checklist_completed ? "checklist complete" : "checklist incomplete"} •
                      mood {log.assessment.mood_score ?? "?"} • mobility {log.assessment.mobility_score ?? "?"} • appetite {log.assessment.appetite_score ?? "?"}
                    </p>
                    <p>{log.verification.checklist_items.join(", ")}</p>
                    {log.photo_url ? <img alt="Care update attachment" className="feed-photo" src={log.photo_url} /> : null}
                    {log.incident_flag ? <p className="error">Incident was recorded for this visit.</p> : null}
                    {log.emergency_flag ? <p className="error">Emergency escalation sent to family and support.</p> : null}
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "messages" && data.thread ? (
          <>
            <section className="panel">
              <h3>Conversation</h3>
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
              <h3>Send message</h3>
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

        {activeTab === "tasks" && data.client ? (
          <>
            {isCustomer ? (
              <section className="panel">
                <h3>Submit coordinated request</h3>
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
              <h3>Shared task queue</h3>
              <div className="task-list">
                {data.tasks.map((task) => (
                  <article className="task-item" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                      <span>{task.task_type} • {task.priority} priority • Due {formatDate(task.due_date)}</span>
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

        {activeTab === "plans" && isCustomer ? (
          <section className="panel wide">
            <h3>Subscription plans</h3>
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
        ) : null}

        {activeTab === "support" && isCustomer ? (
          <>
            <section className="panel">
              <h3>Open support ticket</h3>
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
              <h3>Ticket status</h3>
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
