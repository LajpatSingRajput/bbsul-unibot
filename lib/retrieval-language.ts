// Local, deterministic semantic vocabulary. These are concepts, never university facts.
// Applied at read time so older chunks need no migration or external embedding calls.
const stop = new Set(
  "a an the is are was were be been to of in on for and or i my me you your our do does did can could would should how what when where which please tell about it at with have has hai hain hey he ke ki ka ko liye kya mujhe mein se aur kab much many offer offers offered must submit provide applicants applicant university bbsul queries query pdf txt docx csv".split(
    " ",
  ),
);
const groups: Record<string, string[]> = {
  admission: ["admissions", "dakhla", "daakhla", "admit", "applying"],
  requirement: [
    "requirements",
    "required",
    "requires",
    "require",
    "need",
    "needs",
    "needed",
    "necessary",
    "chahiye",
    "documents",
    "document",
    "paperwork",
    "prerequisites",
    "eligibility",
    "eligible",
  ],
  fee: [
    "fees",
    "paisay",
    "paise",
    "paisa",
    "akhrajat",
    "tuition",
    "cost",
    "costs",
    "charges",
  ],
  amount: ["kitni", "kitna", "kitne", "price"],
  exam: [
    "exams",
    "examination",
    "examinations",
    "imtihan",
    "imtehan",
    "paper",
    "papers",
  ],
  schedule: ["timetable", "schedules", "timing", "timings", "timigs"],
  date: [
    "dates",
    "start",
    "starts",
    "begin",
    "begins",
    "commence",
    "commences",
  ],
  faculty: [
    "ustad",
    "ustaad",
    "teacher",
    "teachers",
    "professor",
    "professors",
  ],
  department: ["departments", "dept"],
  course: ["courses"],
  class: ["classes"],
  scholarship: ["scholarships"],
  enrollment: ["enrolment", "enroll", "enrol"],
  registration: ["register", "registering"],
  library: ["libary", "libarary"],
  hours: ["opening", "open", "opens"],
  password: ["passwords"],
  certificate: ["certificates"],
  photograph: ["photographs", "photos", "photo"],
  semester: ["semesters"],
};
const aliases = new Map(
  Object.entries(groups).flatMap(([term, words]) =>
    words.map((word) => [word, term] as const),
  ),
);
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function tokens(text: string): string[] {
  const words = normalize(text)
    .replace(/\b(?:wi fi|wifi)\b/g, "wi-fi")
    .replace(/\bclass (?:timing|timings|time|schedule)\b/g, "class schedule")
    .replace(
      /\b(?:computer science|computer sciences|cs)\b/g,
      "computerscience",
    )
    .replace(/\b(?:bachelor of science|b sc|bsc)\b/g, "bs")
    .replace(/\b(?:opening hours|office hours)\b/g, "hours")
    .split(/\s+/)
    .filter((x) => x && !stop.has(x))
    .map((x) => aliases.get(x) || x);
  // Operating hours and an academic timetable are distinct contexts. Preserve
  // subjects/qualifiers; only unify the timing vocabulary for campus facilities.
  const facility = words.some((x) =>
    ["library", "office", "cafeteria", "laboratory"].includes(x),
  );
  return facility && !words.some((x) => ["exam", "class", "course"].includes(x))
    ? words.map((x) => (["schedule", "time"].includes(x) ? "hours" : x))
    : words;
}
export function concepts(text: string, query = false): Set<string> {
  const result = new Set(tokens(text));
  const normalized = normalize(text);
  // Explicit clock ranges are timing evidence even if extraction misspells or
  // omits the heading. Plain number ranges (books, rooms, fees) do not qualify.
  const clock = String.raw`(?:[01]?\d|2[0-3]):[0-5]\d\s*(?:[ap]\.?m\.?)?`;
  const meridiem = String.raw`(?:0?[1-9]|1[0-2])\s*[ap]\.?m\.?`;
  if (
    new RegExp(
      String.raw`\b(?:${clock}|${meridiem})\s*(?:to|[-–—])\s*(?:${clock}|${meridiem})(?!\d)`,
      "i",
    ).test(text)
  ) {
    result.add("hours");
    result.add("schedule");
  }
  // Lists of application credentials imply documentary requirements.
  if (
    /\b(cnic|domicile|certificate|certificates|photographs?|transcripts?)\b/.test(
      normalized,
    )
  )
    result.add("requirement");
  if (/\b(applicants?|apply|application)\b/.test(normalized))
    result.add("admission");
  if (
    (/\b(pkr|rs|rupees)\b/.test(normalized) || result.has("fee")) &&
    /\d/.test(normalized)
  )
    result.add("amount");
  if (
    /\b\d{1,4}[-/]\d{1,2}(?:[-/]\d{1,4})?\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
      text,
    ) &&
    /\d/.test(text)
  )
    result.add("date");
  if (
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      normalized,
    ) &&
    /\d/.test(normalized)
  )
    result.add("schedule");
  if (query && /\b(when|kab)\b/.test(normalized) && !result.has("hours"))
    result.add("date");
  if (
    query &&
    result.has("fee") &&
    /\b(what|how much|kitna|kitni|kitne)\b/.test(normalized)
  )
    result.add("amount");
  return result;
}
