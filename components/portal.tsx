"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import {
  LayoutDashboard,
  MessageSquare,
  History,
  UserRound,
  BookOpen,
  FileText,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Clock3,
  Menu,
  X,
  Plus,
  Search,
  Trash2,
  ThumbsUp,
  Library,
  CheckCircle2,
} from "lucide-react";
import { clientAuth } from "@/lib/firebase-client";
import { api } from "@/lib/api-client";
import Chat, { topics } from "./chat";
import Admin from "./admin";
import { Badge, Empty, Field, SearchBox, Spinner, Confirm, date } from "./ui";
const titles: Record<string, [string, string]> = {
  dashboard: [
    "Your campus, a little closer.",
    "One place for the answers you need.",
  ],
  chat: ["Ask UniBot", "Your university assistant, with sources you can see."],
  history: ["Chat history", "Pick up right where you left off."],
  profile: ["My profile", "Your university identity and account details."],
  users: [
    "University members",
    "Manage access for students, faculty and administrators.",
  ],
  faqs: [
    "Frequently asked questions",
    "Turn common questions into trusted university answers.",
  ],
  documents: [
    "University documents",
    "The source material behind better answers.",
  ],
  "knowledge-base": [
    "Knowledge base",
    "Explore the excerpts available for retrieval.",
  ],
  conversations: [
    "Conversation review",
    "Authorized review of university assistant conversations.",
  ],
  feedback: [
    "Response feedback",
    "Listen, review and improve the knowledge base.",
  ],
  unresolved: [
    "Knowledge gaps",
    "Questions that need a verified university answer.",
  ],
  settings: [
    "System settings",
    "Manage how UniBot answers and handles information.",
  ],
};
function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <img src="/logo.jpg" alt="BBSUL Logo" style={{height: 36, width: 36, objectFit: "contain", borderRadius: 4}} />
      </span>
      <span>
        BBSUL <b>UniBot</b>
        <small>SMART CAMPUS ASSISTANT</small>
      </span>
    </Link>
  );
}
export default function Portal() {
  const path = usePathname(),
    router = useRouter();
  const [config, setConfig] = useState<any>(null),
    [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [cid, setCid] = useState<string | undefined>();
  const segments = path.split("/").filter(Boolean),
    role = segments[0],
    page = segments[1] || "dashboard";
  const publicPage =
    !segments.length || ["login", "register", "forgot-password"].includes(role);
  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 5500);
  }
  async function refresh() {
    try {
      const u = await api("profile");
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    let unsub = () => {};
    api("config")
      .then((c) => {
        setConfig(c);
        if (c.demo || !c.configured) refresh();
        else {
          try {
            unsub = onAuthStateChanged(clientAuth(), () => refresh());
          } catch {
            setReady(true);
          }
        }
      })
      .catch((e) => {
        notify(e.message);
        setReady(true);
      });
    return () => unsub();
  }, []);
  useEffect(() => {
    setMenu(false);
    if (path.endsWith("/chat"))
      setCid(
        new URLSearchParams(window.location.search).get("id") || undefined,
      );
  }, [path]);
  useEffect(() => {
    if (ready && !publicPage && !user) router.replace("/login");
    else if (ready && user && !publicPage && role !== user.role)
      router.replace(`/${user.role}/dashboard`);
  }, [ready, user, path]);
  async function logout() {
    if (!config?.demo)
      try {
        await signOut(clientAuth());
      } catch {}
    await api("logout", "POST", {});
    setUser(null);
    router.push("/login");
  }
  const toastView = toast && (
    <div className="toast" role="status">
      {toast}
      <button aria-label="Dismiss notification" onClick={() => setToast("")}>
        <X size={15} />
      </button>
    </div>
  );
  if (publicPage)
    return (
      <>
        {!segments.length ? (
          <Landing demo={config?.demo} />
        ) : (
          <AuthPage
            mode={role}
            config={config}
            notify={notify}
            onLogin={async () => {
              const u = await refresh();
              if (u) router.push(`/${u.role}/dashboard`);
            }}
          />
        )}
        {toastView}
      </>
    );
  if (!ready || !user || role !== user.role) return <Spinner />;
  if (!user.verified && !user.demo)
    return (
      <div className="verification">
        <Brand />
        <h1>Check your email</h1>
        <p>
          Verify your email address before opening your university workspace.
        </p>
        <button
          className="btn"
          onClick={async () => {
            const u = clientAuth().currentUser;
            if (u) {
              await u.reload();
              await u.getIdToken(true);
              await refresh();
            }
          }}
        >
          I have verified my email
        </button>
        <button
          className="btn secondary"
          onClick={() => {
            const u = clientAuth().currentUser;
            if (u)
              sendEmailVerification(u)
                .then(() => notify("Verification email sent."))
                .catch(() =>
                  notify("Please wait before requesting another email."),
                );
          }}
        >
          Resend verification
        </button>
        <button className="text-button" onClick={logout}>
          Sign out
        </button>
        {toastView}
      </div>
    );
  const admin = user.role === "admin";
  const nav = admin
    ? [
        ["dashboard", "Overview", LayoutDashboard],
        ["users", "University members", Users],
        ["faqs", "FAQs", BookOpen],
        ["documents", "Documents", FileText],
        ["knowledge-base", "Knowledge base", Library],
        ["conversations", "Conversations", MessageSquare],
        ["feedback", "Feedback", ThumbsUp],
        ["unresolved", "Knowledge gaps", HelpCircle],
        ["settings", "Settings", Settings],
      ]
    : [
        ["dashboard", "Overview", LayoutDashboard],
        ["chat", "Ask UniBot", MessageSquare],
        ["history", "Chat history", History],
        ["profile", "My profile", UserRound],
      ];
  const title =
    admin && page === "dashboard"
      ? [
          "Knowledge, working for everyone.",
          "Your university assistant at a glance.",
        ]
      : titles[page] || [
          "Page not found",
          "Choose a section from the navigation.",
        ];
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          {admin
            ? "ADMINISTRATION"
            : user.role === "faculty"
              ? "FACULTY WORKSPACE"
              : "STUDENT WORKSPACE"}
        </div>
        <nav>
          {nav.map(([key, label, Icon]: any) => (
            <Link
              key={key}
              href={`/${user.role}/${key}`}
              className={page === key ? "active" : ""}
            >
              <Icon size={19} />
              {label}
              {key === "chat" && <span className="nav-new">AI</span>}
            </Link>
          ))}
        </nav>
        {!admin && (
          <div className="sidebar-help">
            <div className="inline">
              <ShieldCheck size={19} />
              <strong>Knowledge you can trust</strong>
            </div>
            <p>
              University sources first.
              <br />
              Clear labels. Better answers.
            </p>
            <Link href={`/${role}/chat`}>
              Meet your assistant <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="user-card">
            <span className="avatar">
              {user.name
                ?.split(" ")
                .map((x: string) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role} account</small>
            </div>
            <button aria-label="Sign out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
          <span className="sidebar-footer">
            Benazir Bhutto Shaheed University Lyari
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="inline">
            <button
              className="icon-btn mobile"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              {admin
                ? "Admin"
                : user.role === "faculty"
                  ? "Faculty"
                  : "Student"}{" "}
              workspace <span>/</span>{" "}
              <strong>
                {(nav.find((n) => n[0] === page)?.[1] as string) || page}
              </strong>
            </span>
          </div>
          <div className="inline">
            <Badge tone={user.demo ? "amber" : "green"}>
              {user.demo ? "Demo workspace" : "University portal"}
            </Badge>
            <span className="top-avatar">{user.name?.[0]}</span>
          </div>
        </header>
        {user.demo && (
          <div className="demo-strip">
            DEMO DATA · Your isolated session resets when the server restarts.
            No live Firebase or Gemini connection.
            <Link href="/login">Switch role</Link>
          </div>
        )}
        <main className={`main ${page === "chat" ? "chat-main" : ""}`}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">BBSUL UNIBOT</span>
              <h1>{title[0]}</h1>
              <p>{title[1]}</p>
            </div>
            {page === "dashboard" && !admin && (
              <Link className="btn" href={`/${role}/chat`}>
                <Plus size={17} /> Start a conversation
              </Link>
            )}
          </div>
          {admin ? (
            <Admin key={page} page={page} notify={notify} />
          ) : page === "dashboard" ? (
            <Dashboard user={user} />
          ) : page === "chat" ? (
            <Chat
              conversationId={cid}
              onConversation={setCid}
              notify={notify}
              faculty={role === "faculty"}
              initialQuestion={
                typeof window !== "undefined"
                  ? new URLSearchParams(window.location.search).get("q")
                  : null
              }
            />
          ) : page === "history" ? (
            <HistoryPage role={role} notify={notify} />
          ) : page === "profile" ? (
            <ProfilePage user={user} notify={notify} refresh={refresh} />
          ) : (
            <Empty title="Page not found">
              Choose a section from the sidebar.
            </Empty>
          )}
          <footer className="workspace-footer">
            BBSUL UniBot <span>Built for a more connected campus.</span>
          </footer>
        </main>
      </div>
      {toastView}
    </div>
  );
}
function Landing({ demo }: any) {
  return (
    <div className="landing">
      <header className="public-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <a href="#support">Campus support</a>
          <Link href="/login">Log in</Link>
          <Link href="/register" className="btn small-btn">
            Join your campus <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow light-eyebrow">
              BENAZIR BHUTTO SHAHEED UNIVERSITY LYARI
            </span>
            <h1>
              A whole campus.
              <br />
              One conversation.
            </h1>
            <p>
              Meet UniBot, your smart campus assistant. Find your way through
              university life with answers grounded in university knowledge.
            </p>
            <div className="inline hero-actions">
              <Link href="/login" className="btn light">
                Ask UniBot <ArrowRight size={18} />
              </Link>
              <Link href="/register" className="hero-link">
                Create an account <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-trust">
              <span>
                <Clock3 size={17} /> Designed for 24/7 access
              </span>
              <span>
                <ShieldCheck size={17} /> Sources with every answer
              </span>
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-top">
              <div className="inline">
                <div className="bot-mark small">
                  <Sparkles size={22} />
                </div>
                <div>
                  <strong>UniBot</strong>
                  <small>Smart Campus Assistant</small>
                </div>
              </div>
              <Badge>Here to help</Badge>
            </div>
            <div className="preview-chat">
              <p className="preview-question">Where should I start?</p>
              <div className="preview-answer">
                <Sparkles size={20} />
                <div>
                  Start with a question. I check university FAQs and documents
                  first, and show you where the answer comes from.
                  <div>
                    <Badge>University knowledge first</Badge>
                  </div>
                </div>
              </div>
              <div className="preview-chips">
                <span>Admissions</span>
                <span>Examinations</span>
                <span>Campus life</span>
              </div>
            </div>
            <Link href="/login" className="preview-input">
              Ask a campus question…
              <span>
                <ArrowRight size={19} />
              </span>
            </Link>
            <div className="preview-note">
              Illustration of the answering experience
            </div>
          </div>
        </section>
        <section className="support-section" id="support">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LESS SEARCHING. MORE LEARNING.</span>
              <h2>Support for every part of campus life.</h2>
            </div>
            <p>
              For students and faculty.
              <br />
              Managed by your university.
            </p>
          </div>
          <div className="benefits">
            {[
              [
                BookOpen,
                "Academic guidance",
                "Courses, enrollment, examinations and academic resources.",
              ],
              [
                BookOpen,
                "Administrative answers",
                "Admissions, fees, scholarships and university procedures.",
              ],
              [
                Library,
                "Campus connections",
                "Library services, department information and technical support.",
              ],
            ].map(([Icon, title, desc]: any) => (
              <article key={title}>
                <Icon size={27} />
                <h3>{title}</h3>
                <p>{desc}</p>
                <Link href="/login">
                  Explore with UniBot <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="how-section" id="how">
          <span className="eyebrow">CLEAR ANSWERS. VISIBLE SOURCES.</span>
          <h2>Built around university knowledge.</h2>
          <div className="steps">
            {[
              [
                "01",
                "Ask naturally",
                "Sign in and ask your question in plain English.",
              ],
              [
                "02",
                "Knowledge comes first",
                "UniBot checks managed FAQs and uploaded university documents.",
              ],
              [
                "03",
                "Know the source",
                "See a source label, with AI or web results clearly identified when enabled.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Brand />
        <p>
          University FYP · Karachi, Pakistan
          <br />
          Verified information depends on approved knowledge sources.
        </p>
        <Link href="/login">
          {demo ? "Explore the demo" : "Open your workspace"}{" "}
          <ArrowRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
function AuthPage({ mode, config, notify, onLogin }: any) {
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  const register = mode === "register",
    forgot = mode === "forgot-password";
  async function submit(e: any) {
    e.preventDefault();
    if (config?.demo) {
      notify(
        "Use a demo role below. Real registration requires Firebase configuration.",
      );
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const auth = clientAuth(),
        email = String(f.get("email")),
        password = String(f.get("password"));
      if (forgot) {
        await sendPasswordResetEmail(auth, email);
        setSent(true);
      } else if (register) {
        await createUserWithEmailAndPassword(auth, email, password);
        await api("profile", "POST", {
          name: f.get("name"),
          department: f.get("department"),
          requestedRole: f.get("requestedRole"),
        });
        await sendEmailVerification(auth.currentUser!);
        await onLogin();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        await onLogin();
      }
    } catch (e: any) {
      const code = e.code || "";
      notify(
        code.includes("invalid-credential")
          ? "Email or password is incorrect."
          : code.includes("email-already-in-use")
            ? "An account already exists for this email."
            : code.includes("too-many")
              ? "Please wait and try again."
              : code.includes("weak-password")
                ? "Use a stronger password with at least 8 characters."
                : e.message || "Sign-in failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow light-eyebrow">
            WELCOME TO YOUR CONNECTED CAMPUS
          </span>
          <h1>
            Good questions.
            <br />
            Better campus days.
          </h1>
          <p>
            A little guidance makes a big difference. Your university assistant
            is ready when you are.
          </p>
          <div className="auth-promise">
            <ShieldCheck />
            <span>
              University knowledge first.
              <br />
              Your conversations, protected.
            </span>
          </div>
        </div>
        <small>Benazir Bhutto Shaheed University Lyari · Karachi</small>
      </section>
      <section className="auth-form">
        <Link href="/" className="back-link">
          ← Back to UniBot
        </Link>
        <div className="auth-form-inner">
          <span className="eyebrow">BBSUL UNIBOT</span>
          <h1>
            {forgot
              ? "Forgot your password?"
              : register
                ? "Join your campus."
                : "Welcome back."}
          </h1>
          <p className="muted">
            {forgot
              ? "We’ll email you a link to reset it."
              : register
                ? "Create your account to start a conversation."
                : "Sign in to your university workspace."}
          </p>
          {sent ? (
            <div className="notice">
              If an account exists for that email, a reset link has been sent.
            </div>
          ) : (
            <form onSubmit={submit}>
              {register && (
                <>
                  <Field
                    label="Full name"
                    name="name"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                  <Field label="Department" name="department" required />
                  <Field label="I am a">
                    <select name="requestedRole">
                      <option value="student">Student</option>
                      <option value="faculty">
                        Faculty (administrator approval required)
                      </option>
                    </select>
                  </Field>
                </>
              )}
              <Field
                label="Email address"
                name="email"
                type="email"
                placeholder="you@example.edu.pk"
                required
                autoComplete="email"
              />
              {!forgot && (
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  minLength={register ? 8 : 1}
                  required
                  autoComplete={register ? "new-password" : "current-password"}
                />
              )}
              <button className="btn full" disabled={busy || !config}>
                {busy
                  ? "Please wait…"
                  : forgot
                    ? "Send reset link"
                    : register
                      ? "Create account"
                      : "Sign in"}
                <ArrowRight size={17} />
              </button>
              {!register && !forgot && (
                <Link className="forgot" href="/forgot-password">
                  Forgot password?
                </Link>
              )}
            </form>
          )}
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to UniBot?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {config?.demo && (
            <div className="demo-access">
              <div className="inline spread">
                <strong>Explore the project</strong>
                <Badge tone="amber">DEMO</Badge>
              </div>
              <p>Try each workspace with sample data. No password needed.</p>
              <div className="demo-roles">
                {["student", "faculty", "admin"].map((role) => (
                  <button
                    key={role}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api("demo", "POST", { role });
                        await onLogin();
                      } catch (e: any) {
                        notify(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {role}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <p>
              Chats are saved to your account. Authorized admins may review
              conversations when enabled. Unanswered questions and feedback help
              improve answers. Optional AI fallback sends your current question
              to Google; do not include sensitive personal information.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
function Dashboard({ user }: any) {
  const [chats, setChats] = useState<any[]>([]),
    [resources, setResources] = useState<any[]>([]);
  useEffect(() => {
    api("conversations")
      .then(setChats)
      .catch(() => {});
    api("resources")
      .then(setResources)
      .catch(() => {});
  }, []);
  const faculty = user.role === "faculty";
  return (
    <>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow light-eyebrow">
            YOUR SMART CAMPUS ASSISTANT
          </span>
          <h2>
            Hello, {user.name.split(" ")[0]}.<br />
            What’s on your mind today?
          </h2>
          <p>
            {faculty
              ? "Academic questions, department resources and university information."
              : "From your first semester to your next big step, start here."}
          </p>
          <Link className="btn light" href={`/${user.role}/chat`}>
            Let’s talk <ArrowRight size={18} />
          </Link>
        </div>
        <div className="welcome-aside">
          <Sparkles size={43} />
          <strong>
            Less searching.
            <br />
            More clarity.
          </strong>
          <span>Powered by university knowledge</span>
        </div>
      </section>
      <div className="dashboard-columns">
        <div>
          <div className="section-heading">
            <h2>
              {faculty
                ? "Academic & department support"
                : "What can we help with?"}
            </h2>
            <span className="muted tiny">Explore a topic</span>
          </div>
          <div className="topics-grid">
            {topics.map(([label, q, Icon]) => (
              <Link
                key={label}
                href={`/${user.role}/chat?q=${encodeURIComponent(q)}`}
                className="topic-card"
              >
                <span className="topic-icon">
                  <Icon size={22} />
                </span>
                <strong>{label}</strong>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          </div>
          <div className="section-heading recent-heading">
            <h2>Recent conversations</h2>
            <Link href={`/${user.role}/history`}>
              View all <ArrowRight size={15} />
            </Link>
          </div>
          <div className="panel recent-list">
            {chats.length ? (
              chats.slice(0, 3).map((c) => (
                <Link href={`/${user.role}/chat?id=${c.id}`} key={c.id}>
                  <MessageSquare size={20} />
                  <div>
                    <strong>{c.title}</strong>
                    <p>{date(c.updatedAt)}</p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))
            ) : (
              <Empty
                icon={MessageSquare}
                title="Your next question starts here"
              >
                Conversations you start will appear here.
              </Empty>
            )}
          </div>
        </div>
        <aside className="dashboard-aside">
          <div className="panel">
            <span className="mini-label">A GOOD PLACE TO START</span>
            <h3>Curiosity welcome.</h3>
            {[
              "What can UniBot help me with?",
              "How can I verify an answer?",
              "How do I report an incorrect answer?",
            ].map((q) => (
              <Link
                className="question-link"
                href={`/${user.role}/chat?q=${encodeURIComponent(q)}`}
                key={q}
              >
                {q}
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          <div className="knowledge-note">
            <ShieldCheck size={24} />
            <h3>Know where your answer comes from.</h3>
            <p>
              Look for the source badge. University facts need an approved
              source, and missing information is clearly stated.
            </p>
            <Badge>University knowledge first</Badge>
          </div>
          {faculty && (
            <div className="panel">
              <h3>Department resources</h3>
              {resources.length ? (
                resources.map((r) => (
                  <p key={r.id}>
                    <FileText size={15} /> {r.name}
                  </p>
                ))
              ) : (
                <p className="muted">
                  Approved faculty documents will appear here after an
                  administrator uploads them.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
function HistoryPage({ role, notify }: any) {
  const [rows, setRows] = useState<any[]>([]),
    [q, setQ] = useState(""),
    [loading, setLoading] = useState(true),
    [remove, setRemove] = useState<any>(null);
  const load = () =>
    api("conversations")
      .then(setRows)
      .catch((e) => notify(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="panel">
      <div className="table-toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search your conversations…"
        />
        <Link className="btn" href={`/${role}/chat`}>
          <Plus size={17} /> New chat
        </Link>
      </div>
      {loading ? (
        <Spinner />
      ) : !rows.length ? (
        <Empty title="A fresh start">
          Your conversations will be saved here.
        </Empty>
      ) : (
        <div className="history-list">
          {rows
            .filter((r) =>
              `${r.title} ${r.lastMessage}`
                .toLowerCase()
                .includes(q.toLowerCase()),
            )
            .map((r) => (
              <div key={r.id}>
                <MessageSquare />
                <Link href={`/${role}/chat?id=${r.id}`}>
                  <strong>{r.title}</strong>
                  <p>{r.lastMessage}</p>
                  <small>{date(r.updatedAt)}</small>
                </Link>
                <button
                  className="icon-btn"
                  aria-label="Delete conversation"
                  onClick={() => setRemove(r)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
        </div>
      )}
      {remove && (
        <Confirm
          title="Delete this conversation?"
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            try {
              await api(`conversations/${remove.id}`, "DELETE");
              setRemove(null);
              load();
              notify("Conversation deleted.");
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
    </div>
  );
}
function ProfilePage({ user, notify, refresh }: any) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel profile-panel">
      <div className="profile-heading">
        <span className="avatar large">{user.name[0]}</span>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <Badge>{user.role}</Badge>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("profile", "PATCH", Object.fromEntries(f.entries()));
            await refresh();
            notify("Profile updated.");
          } catch (e: any) {
            notify(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Full name"
          name="name"
          defaultValue={user.name}
          required
        />
        <Field
          label="Department"
          name="department"
          defaultValue={user.department}
        />
        <Field
          label={user.role === "faculty" ? "Employee ID" : "Student ID"}
          name={user.role === "faculty" ? "employeeId" : "studentId"}
          defaultValue={user.employeeId || user.studentId || ""}
        />
        <p className="hint">
          Account roles and status are managed by an administrator.
        </p>
        <button className="btn" disabled={busy}>
          Save profile
        </button>
      </form>
    </div>
  );
}
