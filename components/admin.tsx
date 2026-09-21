"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Pencil,
  Users,
  MessageSquare,
  BookOpen,
  Check,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { categories, sourceLabels } from "@/lib/types";
import {
  Badge,
  Empty,
  Field,
  Modal,
  Confirm,
  SearchBox,
  Spinner,
  date,
} from "./ui";
export function FAQForm({ initial, onClose, onSaved, notify }: any) {
  const [form, setForm] = useState(
      initial || {
        question: "",
        answer: "",
        category: categories[0],
        keywords: [],
        targetAudience: ["all"],
        active: true,
      },
    ),
    [busy, setBusy] = useState(false);
  const set = (key: string, val: any) =>
    setForm((f: any) => ({ ...f, [key]: val }));
  return (
    <Modal
      title={initial?.id ? "Edit FAQ" : "Add a knowledge answer"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(
              initial?.id ? `faqs/${initial.id}` : "faqs",
              initial?.id ? "PUT" : "POST",
              {
                question: form.question,
                answer: form.answer,
                category: form.category,
                keywords: form.keywords.filter((k: string) => k.trim()),
                targetAudience: form.targetAudience,
                active: form.active,
              },
            );
            onSaved();
            onClose();
            notify("FAQ saved. It is now available to retrieval.");
          } catch (e: any) {
            notify(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Question"
          required
          minLength={5}
          maxLength={500}
          value={form.question}
          onChange={(e: any) => set("question", e.target.value)}
        />
        <Field label="Verified answer">
          <textarea
            required
            minLength={5}
            maxLength={12000}
            rows={5}
            value={form.answer}
            onChange={(e) => set("answer", e.target.value)}
          />
        </Field>
        <p className="hint">
          Use approved university information. Include dates and source context
          when relevant.
        </p>
        <div className="two-col">
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Audience">
            <select
              value={form.targetAudience[0]}
              onChange={(e) => set("targetAudience", [e.target.value])}
            >
              <option value="all">Everyone</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
            </select>
          </Field>
        </div>
        <Field
          label="Keywords (comma separated)"
          value={form.keywords.join(",")}
          onChange={(e: any) =>
            set(
              "keywords",
              e.target.value.split(",").map((s: string) => s.trim()),
            )
          }
        />
        <label className="check">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />{" "}
          Available to chatbot
        </label>
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy}>
            {busy ? "Saving…" : "Save FAQ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default function Admin({ page, notify }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [edit, setEdit] = useState<any>(null),
    [confirm, setConfirm] = useState<any>(null),
    [stats, setStats] = useState<any>(null),
    [settings, setSettings] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<any>(null);
  const endpoint = page === "conversations" ? "admin-conversations" : page;
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api(page === "dashboard" ? "analytics" : endpoint);
      if (page === "dashboard") setStats(r);
      else if (page === "settings") setSettings(r);
      else setRows(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setQuery("");
    setFilter("all");
    setRows([]);
    load();
  }, [page]);
  async function mutate(path: string, method: string, data?: any) {
    setBusy(true);
    try {
      await api(path, method, data);
      await load();
      notify("Changes saved.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = rows.filter(
    (r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || r.category === filter || r.role === filter),
  );
  if (loading && !stats && !rows.length && !settings) return <Spinner />;
  if (error)
    return (
      <div className="panel">
        <Empty title="This section is unavailable">{error}</Empty>
        <button className="btn secondary" onClick={load}>
          Try again
        </button>
      </div>
    );
  if (page === "dashboard" && stats) {
    const cards = [
      [
        "University members",
        stats.users,
        Users,
        `${stats.students} students · ${stats.faculty} faculty · ${stats.admins} admins`,
      ],
      [
        "Knowledge answers",
        stats.faqs,
        BookOpen,
        `${stats.documents} uploaded documents`,
      ],
      [
        "Conversations",
        stats.conversations,
        MessageSquare,
        `${stats.messages} messages exchanged`,
      ],
      [
        "Needs attention",
        stats.unresolved,
        FileText,
        "Questions without a verified match",
      ],
    ];
    const total = Object.values(stats.counts).reduce(
      (a: any, b: any) => a + b,
      0,
    ) as number;
    return (
      <>
        <div className="stats-grid">
          {cards.map(([label, val, Icon, sub]: any) => (
            <div className="stat" key={label}>
              <div className="stat-label">
                {label}
                <Icon size={19} />
              </div>
              <strong>{val}</strong>
              <span>{sub}</span>
            </div>
          ))}
        </div>
        <div className="admin-columns">
          <div className="panel">
            <div className="section-heading">
              <h2>Where answers come from</h2>
              <Badge>Source transparency</Badge>
            </div>
            <p className="muted">Based on saved assistant responses.</p>
            <div className="bar-chart">
              {Object.entries(stats.counts).map(([k, v]: any) => (
                <div key={k}>
                  <div className="inline spread">
                    <span>{sourceLabels[k as keyof typeof sourceLabels]}</span>
                    <strong>{v}</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      style={{ width: `${total ? (v / total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!total && (
              <p className="hint">
                Send a question to start building your analytics.
              </p>
            )}
          </div>
          <div className="panel">
            <h2>Knowledge that gets better</h2>
            <p className="muted">
              Turn unanswered questions into trusted answers for everyone.
            </p>
            <div className="feedback-count">
              <ThumbIcon positive />
              <strong>{stats.helpful}</strong>
              <span>Helpful responses</span>
            </div>
            <div className="feedback-count">
              <ThumbIcon />
              <strong>{stats.notHelpful}</strong>
              <span>Not helpful responses</span>
            </div>
            <a className="btn secondary full" href="/admin/unresolved">
              Review knowledge gaps <ArrowUpRight size={17} />
            </a>
          </div>
        </div>
        <div className="banner slim">
          <ShieldCheck />
          <div>
            <strong>Official knowledge stays in control.</strong>
            <p>FAQs and documents are checked before an AI or web fallback.</p>
          </div>
          <a href="/admin/faqs" className="btn light">
            Manage FAQs
          </a>
        </div>
      </>
    );
  }
  if (page === "settings" && settings)
    return (
      <div className="panel settings">
        <h2>Answering & privacy</h2>
        <p className="muted">
          Tune retrieval carefully. Relevance scores are not accuracy
          percentages.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const {
              faqThreshold,
              documentThreshold,
              geminiEnabled,
              webSearchEnabled,
              adminConversationAccess,
              displayName,
              welcomeMessage,
              maintenanceMode,
              maxUploadMB,
              allowedDocumentTypes,
            } = settings;
            mutate("settings", "PUT", {
              faqThreshold,
              documentThreshold,
              geminiEnabled,
              webSearchEnabled,
              adminConversationAccess,
              displayName,
              welcomeMessage,
              maintenanceMode,
              maxUploadMB,
              allowedDocumentTypes,
            });
          }}
        >
          <Field
            label="Assistant display name"
            value={settings.displayName}
            onChange={(e: any) =>
              setSettings({ ...settings, displayName: e.target.value })
            }
          />
          <Field
            label="Welcome message"
            value={settings.welcomeMessage}
            onChange={(e: any) =>
              setSettings({ ...settings, welcomeMessage: e.target.value })
            }
          />
          <Field
            label="Maximum upload size (MB, up to 3)"
            type="number"
            min="0.1"
            max="3"
            step="0.1"
            value={settings.maxUploadMB}
            onChange={(e: any) =>
              setSettings({ ...settings, maxUploadMB: Number(e.target.value) })
            }
          />
          <div className="inline">
            {["pdf", "docx", "txt", "csv"].map((ext) => (
              <label className="check" key={ext}>
                <input
                  type="checkbox"
                  checked={settings.allowedDocumentTypes.includes(ext)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      allowedDocumentTypes: e.target.checked
                        ? [...settings.allowedDocumentTypes, ext]
                        : settings.allowedDocumentTypes.filter(
                            (x: string) => x !== ext,
                          ),
                    })
                  }
                />
                {ext.toUpperCase()}
              </label>
            ))}
          </div>
          <div className="two-col">
            {["faqThreshold", "documentThreshold"].map((k) => (
              <Field
                key={k}
                label={
                  k === "faqThreshold"
                    ? "FAQ relevance threshold"
                    : "Document relevance threshold"
                }
                type="number"
                step="0.01"
                min="0.25"
                max="1"
                value={settings[k]}
                onChange={(e: any) =>
                  setSettings({ ...settings, [k]: Number(e.target.value) })
                }
              />
            ))}
          </div>
          {[
            [
              "maintenanceMode",
              "Maintenance mode",
              "Temporarily pause student and faculty chat while updating knowledge.",
            ],
            [
              "geminiEnabled",
              "Allow general AI fallback",
              "Only after university retrieval fails. Requires the server opt-in and API key.",
            ],
            [
              "webSearchEnabled",
              "Allow Google Search grounding",
              "For external, current questions. Requires server opt-in and can incur charges.",
            ],
            [
              "adminConversationAccess",
              "Enable administrator conversation review",
              "Private by default. Enable only with university approval and user notice.",
            ],
          ].map(([k, label, desc]) => (
            <label key={k} className="toggle-row">
              <div>
                <strong>{label}</strong>
                <p>{desc}</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={settings[k]}
                onChange={(e) =>
                  setSettings({ ...settings, [k]: e.target.checked })
                }
              />
            </label>
          ))}
          <div className="notice">
            <strong>Service configuration</strong>
            <p>
              Gemini model: {settings.model}
              <br />
              API key:{" "}
              {settings.geminiConfigured ? "Configured" : "Not configured"} · AI
              server opt-in: {settings.geminiAllowed ? "Enabled" : "Disabled"} ·
              Search server opt-in:{" "}
              {settings.searchAllowed ? "Enabled" : "Disabled"}
            </p>
            <p>
              Secrets are configured on the server, never in this panel.
              Uploads: PDF, DOCX, TXT, CSV; maximum 3 MB.
            </p>
          </div>
          <button className="btn" disabled={busy}>
            Save settings
          </button>
        </form>
      </div>
    );
  return (
    <>
      <div className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder={`Search ${page.replace("-", " ")}…`}
          />
          {["faqs", "documents", "users"].includes(page) && (
            <select
              aria-label="Filter records"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">
                All {page === "users" ? "roles" : "categories"}
              </option>
              {(page === "users"
                ? ["student", "faculty", "admin"]
                : categories
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          {page === "faqs" && (
            <>
              <label className="btn secondary small-btn">
                Import JSON
                <input
                  hidden
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 200000)
                        throw new Error("Import must be under 200 KB.");
                      await mutate(
                        "faqs/import",
                        "POST",
                        JSON.parse(await f.text()),
                      );
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                />
              </label>
              <button className="btn" onClick={() => setEdit({})}>
                <Plus size={17} /> Add FAQ
              </button>
            </>
          )}
          {page === "documents" && (
            <button className="btn" onClick={() => setEdit({ upload: true })}>
              <Upload size={17} /> Upload document
            </button>
          )}
        </div>
        {page === "documents" && (
          <div className="notice compact">
            Upload approved BBSUL information. Text-based PDF, DOCX, TXT and CSV
            · Up to 3 MB per file.
          </div>
        )}
        {!filtered.length ? (
          <Empty
            title={
              query
                ? "No matching results"
                : page === "documents"
                  ? "Your knowledge starts here"
                  : "No records yet"
            }
          >
            {page === "documents"
              ? "Upload an approved handbook, policy or campus guide to help UniBot answer with sources."
              : "New records will appear here as people use UniBot."}
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(page === "faqs"
                    ? [
                        "Question / Answer",
                        "Category",
                        "Audience",
                        "Status",
                        "Actions",
                      ]
                    : page === "users"
                      ? [
                          "Member",
                          "Department",
                          "Role",
                          "Status",
                          "Joined",
                          "Actions",
                        ]
                      : page === "documents"
                        ? [
                            "Document",
                            "Category",
                            "Processing",
                            "Added",
                            "Actions",
                          ]
                        : page === "unresolved"
                          ? ["Question", "Route", "Status", "Asked", "Actions"]
                          : page === "feedback"
                            ? ["Answer", "Source", "Rating", "Received"]
                            : page === "knowledge-base"
                              ? ["Document / Excerpt", "Category", "Chunk"]
                              : ["Conversation", "Role", "Updated", "Actions"]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    {page === "faqs" ? (
                      <>
                        <td>
                          <strong>{r.question}</strong>
                          <p className="excerpt">{r.answer}</p>
                        </td>
                        <td>{r.category}</td>
                        <td>{r.targetAudience?.join(", ")}</td>
                        <td>
                          <Badge tone={r.active ? "green" : "gray"}>
                            {r.active ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              aria-label="Edit FAQ"
                              onClick={() => setEdit(r)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label={
                                r.active ? "Disable FAQ" : "Enable FAQ"
                              }
                              onClick={() =>
                                mutate(`faqs/${r.id}`, "PUT", {
                                  ...r,
                                  active: !r.active,
                                })
                              }
                            >
                              <Check size={16} />
                            </button>
                            <button
                              aria-label="Delete FAQ"
                              onClick={() => setConfirm(r)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : page === "users" ? (
                      <>
                        <td>
                          <strong>{r.name}</strong>
                          <p>{r.email}</p>
                          {r.requestedRole === "faculty" &&
                            r.role === "student" && (
                              <Badge tone="blue">Faculty requested</Badge>
                            )}
                        </td>
                        <td>{r.department || "—"}</td>
                        <td>
                          <Badge>{r.role}</Badge>
                        </td>
                        <td>{r.status}</td>
                        <td>{date(r.createdAt)}</td>
                        <td>
                          <button
                            className="btn secondary small-btn"
                            onClick={() => setEdit(r)}
                          >
                            Manage
                          </button>
                        </td>
                      </>
                    ) : page === "documents" ? (
                      <>
                        <td>
                          <div className="inline">
                            <FileText size={23} />
                            <div>
                              <strong>{r.name}</strong>
                              <p>
                                {Math.ceil(r.size / 1024)} KB ·{" "}
                                {r.chunkCount || 0} searchable chunks
                              </p>
                              {r.error && (
                                <p className="error-text">{r.error}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{r.category}</td>
                        <td>
                          <Badge
                            tone={
                              r.status === "failed"
                                ? "red"
                                : r.active
                                  ? "green"
                                  : "gray"
                            }
                          >
                            {r.status === "ready"
                              ? r.active
                                ? "Ready"
                                : "Disabled"
                              : r.status}
                          </Badge>
                        </td>
                        <td>{date(r.createdAt)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              aria-label="Reprocess document"
                              disabled={busy}
                              onClick={() =>
                                mutate(
                                  `documents/${r.id}/reprocess`,
                                  "POST",
                                  {},
                                )
                              }
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              aria-label={
                                r.active
                                  ? "Disable document"
                                  : "Enable document"
                              }
                              disabled={r.status !== "ready"}
                              onClick={() =>
                                mutate(`documents/${r.id}`, "PATCH", {
                                  active: !r.active,
                                })
                              }
                            >
                              <Check size={16} />
                            </button>
                            <button
                              aria-label="Delete document"
                              onClick={() => setConfirm(r)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : page === "unresolved" ? (
                      <>
                        <td>
                          <strong>{r.query}</strong>
                          <p>{r.userRole}</p>
                        </td>
                        <td>
                          {r.webSearchUsed
                            ? "Web Search"
                            : r.fallbackUsed
                              ? "AI attempted"
                              : "Knowledge gap"}
                        </td>
                        <td>
                          <Badge tone={r.resolved ? "green" : "gray"}>
                            {r.resolved ? "Resolved" : "Open"}
                          </Badge>
                        </td>
                        <td>{date(r.timestamp)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                setEdit({
                                  question: r.query,
                                  answer: "",
                                  category: categories[0],
                                  keywords: [],
                                  targetAudience: ["all"],
                                  active: true,
                                })
                              }
                            >
                              Create FAQ
                            </button>
                            <button
                              aria-label="Mark resolved"
                              onClick={() =>
                                mutate(`unresolved/${r.id}`, "PATCH", {
                                  resolved: !r.resolved,
                                })
                              }
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : page === "feedback" ? (
                      <>
                        <td>
                          <p className="excerpt">{r.answer}</p>
                        </td>
                        <td>{r.sourceType || "No verified answer"}</td>
                        <td>
                          <Badge
                            tone={r.rating === "helpful" ? "green" : "red"}
                          >
                            {r.rating}
                          </Badge>
                        </td>
                        <td>{date(r.createdAt)}</td>
                      </>
                    ) : page === "knowledge-base" ? (
                      <>
                        <td>
                          <strong>{r.documentName}</strong>
                          <p className="excerpt">{r.content}</p>
                          <button
                            className="text-button"
                            onClick={() => setDetail(r)}
                          >
                            Read excerpt
                          </button>
                        </td>
                        <td>{r.category}</td>
                        <td>{r.chunkIndex + 1}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <strong>{r.title}</strong>
                          <p className="excerpt">{r.lastMessage}</p>
                        </td>
                        <td>{r.userRole}</td>
                        <td>{date(r.updatedAt)}</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              api(`admin-conversations/${r.id}`)
                                .then(setDetail)
                                .catch((e) => notify(e.message))
                            }
                          >
                            Review
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
      {edit && (page === "faqs" || page === "unresolved") && (
        <FAQForm
          initial={Object.keys(edit).length ? edit : undefined}
          onClose={() => setEdit(null)}
          onSaved={load}
          notify={notify}
        />
      )}
      {edit && page === "users" && (
        <Modal title="Manage member" onClose={() => setEdit(null)}>
          <p>
            {edit.name} · {edit.email}
          </p>
          <Field label="Role">
            <select
              value={edit.role}
              onChange={(e) => setEdit({ ...edit, role: e.target.value })}
            >
              {["student", "faculty", "admin"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Account status">
            <select
              value={edit.status}
              onChange={(e) => setEdit({ ...edit, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              await mutate(`users/${edit.id}`, "PATCH", {
                role: edit.role,
                status: edit.status,
              });
              setEdit(null);
            }}
          >
            Save changes
          </button>
        </Modal>
      )}
      {edit && page === "documents" && (
        <Modal title="Upload university document" onClose={() => setEdit(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api("documents", "POST", form);
                setEdit(null);
                await load();
                notify("Document processed and indexed.");
              } catch (e: any) {
                notify(e.message);
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="upload-zone">
              <Upload size={30} />
              <strong>Add a source UniBot can trust</strong>
              <p>PDF, DOCX, TXT or CSV · maximum 3 MB</p>
              <input
                name="file"
                aria-label="Select university document"
                type="file"
                accept=".pdf,.docx,.txt,.csv"
                required
              />
            </div>
            <Field label="Category">
              <select name="category">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Audience">
              <select name="audience">
                <option value="all">Everyone</option>
                <option value="student">Students only</option>
                <option value="faculty">Faculty only</option>
              </select>
            </Field>
            <button className="btn full" disabled={busy}>
              {busy ? "Extracting and indexing…" : "Upload & process"}
            </button>
          </form>
        </Modal>
      )}
      {confirm && (
        <Confirm
          title={`Delete ${page === "faqs" ? "this FAQ" : confirm.name}?`}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await mutate(`${page}/${confirm.id}`, "DELETE");
            setConfirm(null);
          }}
        />
      )}
      {detail && (
        <Modal
          title={detail.documentName || detail.title || "Details"}
          onClose={() => setDetail(null)}
        >
          <div className="detail-text">
            {detail.content ||
              detail.messages?.map((m: any) => (
                <div key={m.id}>
                  <strong>{m.sender}</strong>
                  <p>{m.text}</p>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
function ThumbIcon({ positive }: any) {
  return (
    <span className={`feedback-icon ${positive ? "" : "negative"}`}>
      {positive ? "＋" : "−"}
    </span>
  );
}
