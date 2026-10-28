# HaziriGuard

> **Track:** Education & Student Life  
> **Hackathon:** PromptWars x KickToTech 2026  
> **Tagline:** Protect your attendance. Recover before it's too late.

---

## 1. Problem & Target Users

### The Problem
Most universities and colleges enforce strict attendance rules (commonly requiring students to maintain at least 75% or 80% attendance). Under existing systems, students usually check their attendance portal only when semester examinations approach—when it is mathematically impossible to recover from a shortfall. This leads to debarment from examinations, mandatory semester repetitions, and severe academic stress.

### Target Users
- College and university students navigating strict attendance criteria.
- Students balancing academics with sports, internships, illness, or extracurriculars who need to keep a reliable safety margin.

---

## 2. Core Philosophy: Attendance Protection (Never Skipping)

Existing attendance apps frequently present numbers as *"classes you can bunk"*, encouraging students to skip until they hit the bare minimum. **HaziriGuard reverses this harmful pattern:**

1. **Safety Buffer, Not Bunk Margins:** We treat margin as an emergency safety buffer rather than permission to skip.
2. **Withheld Emergency Reserve:** An editable emergency reserve (default: 3 classes) is withheld. Even if a student is ahead, only classes *beyond* this emergency reserve are shown as spare buffer.
3. **Danger-First Prioritization:** Subjects below threshold are always sorted to the top of the dashboard so students confront shortfalls immediately.
4. **Automated Catch-up Tasks:** Whenever a class is logged as missed, HaziriGuard automatically generates a catch-up task with a 48-hour due date, reinforcing that *missed classes also mean missed content*.

---

## 3. Features

- **Danger-First Subject Cards:** Subjects are displayed in order of urgency (`Danger` &rarr; `Careful` &rarr; `Safe` &rarr; `NoData`).
- **Progress Bars with Threshold Markers:** Visual indicator showing current attendance alongside a visible marker at the required percentage.
- **Triple-Attribute Status Badges:** Accessible status indicators that combine color, icon, and text (`⚠️ Danger`, `⚡ Careful`, `🛡️ Safe`, `ℹ️ No Data`) to comply with accessibility standards.
- **One-Click Attendance Logging:** Log classes as *Attended* or *Missed* with optional lecture notes.
- **Catch-up Planner:** Automatic task scheduler for missed classes with overdue indicators (`⚠️ Overdue`) and completion checkboxes.
- **Interactive What-If Simulator:** Test prospective future absences (0–10 classes) in real time to see projected drops and recovery requirements before making a decision.
- **Configurable Emergency Reserve:** Adjust how many reserve classes are held back (0–10).
- **Fictional Demo Data:** Pre-populated dataset showcasing all four safety states with realistic class distributions.
- **Full Database Reset:** One-click confirmation to clear records for fresh tracking.
- **Accessible & Offline-Ready:** Zero external CDNs, fonts, or tracking scripts. Built using semantic HTML, high-contrast colors (WCAG AA), and an ARIA live region for screen readers.

---

## 4. How the Numbers Work (Transparent Math)

HaziriGuard uses **pure integer cross-multiplication** to prevent floating-point inaccuracies (such as `0.1 + 0.2 !== 0.3`).

For a subject with:
- $a$ = attended classes
- $t$ = total classes held
- $r$ = required attendance percentage ($1 \le r \le 99$)
- $e$ = emergency reserve ($0 \le e \le 10$, default 3)

### Formulas

| Metric | Formula | Purpose |
| :--- | :--- | :--- |
| **Percentage** | $t = 0 \implies \text{null}$, else $\text{round}(100 \times a / t, \text{1 decimal})$ | Display only |
| **Below Limit** | $100 \times a < r \times t$ | Integer boundary decision |
| **Safe Misses** | $t = 0 \implies 0$, else $\max(0, \lfloor(100a - rt) / r\rfloor)$ | Classes that can be missed before falling below $r\%$ |
| **Spare Buffer** | $\max(0, \text{safeMisses} - e)$ | Classes that can be missed *beyond* the emergency reserve |
| **Recovery Needed** | $\text{belowLimit} \implies \lceil(rt - 100a) / (100 - r)\rceil$, else $0$ | Consecutive upcoming classes student must attend to reach $r\%$ |
| **Status** | $t = 0 \implies \text{"NoData"}$; $\text{belowLimit} \implies \text{"Danger"}$; $\text{safeMisses} \le e \implies \text{"Careful"}$; else $\text{"Safe"}$ | Risk classification |

---

### Worked Examples

#### Example 1: 36 Attended of 40 Held at 75% Required (Reserve = 3)
- **Percentage:** $100 \times 36 / 40 = 90.0\%$
- **Below Limit:** $100 \times 36 = 3600 \ge 75 \times 40 = 3000$ (False)
- **Safe Misses:** $\lfloor(3600 - 3000) / 75\rfloor = \lfloor 600 / 75 \rfloor = 8\text{ classes}$
- **Spare Buffer:** $\max(0, 8 - 3) = 5\text{ classes spare}$
- **Recovery Needed:** $0\text{ classes}$
- **Status:** **Safe** (Student has 5 spare classes beyond the 3 emergency reserve classes)

#### Example 2: 28 Attended of 40 Held at 75% Required (Reserve = 3)
- **Percentage:** $100 \times 28 / 40 = 70.0\%$
- **Below Limit:** $100 \times 28 = 2800 < 75 \times 40 = 3000$ (True &rarr; Below Threshold)
- **Safe Misses:** $\max(0, \lfloor(2800 - 3000) / 75\rfloor) = 0\text{ classes}$
- **Spare Buffer:** $0\text{ classes}$
- **Recovery Needed:** $\lceil(3000 - 2800) / (100 - 75)\rceil = \lceil 200 / 25 \rceil = 8\text{ consecutive classes}$
- **Status:** **Danger** (Action required: student must attend the next 8 consecutive classes without absence)

---

## 5. How to Run & Test

### Prerequisites
- Node.js (v18.0.0 or later, v24+ tested)
- npm

### Installation & Startup
```powershell
# 1. Install dependencies (single dependency: express)
npm install

# 2. Run automated test suite
npm test

# 3. Start the HaziriGuard server
npm start
```

Open your browser and navigate to:  
`http://localhost:3000`

---

## 6. Folder Structure & Component Responsibilities

```text
HaziriGuard/
├── .gitignore          # Excludes node_modules, logs, env files, and data/db.json
├── package.json        # Single dependency (express) and scripts ("start", "test")
├── server.js           # Express REST API, static asset serving, port fallback
├── src/
│   ├── logic.js        # Pure calculation functions (no network/file I/O, integer math)
│   └── store.js        # Atomic file persistence for data/db.json with auto-recovery
├── public/
│   ├── index.html      # Accessible semantic UI with inline SVG logo
│   ├── styles.css      # Deep ink & teal design, WCAG AA compliant contrast
│   └── app.js          # Pure vanilla JS frontend, zero-innerHTML DOM rendering
└── tests/
    ├── logic.test.js   # Unit tests for core attendance formulas & boundaries
    └── api.test.js     # Integration tests for all REST API endpoints
```

---

## 7. REST API Endpoints

| Method | Endpoint | Description | Sample Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck | `{ "ok": true }` |
| `GET` | `/api/dashboard` | Aggregated metrics & sorted cards | `{ "settings": { "reserve": 3 }, "subjects": [...] }` |
| `POST` | `/api/subjects` | Create subject (1–60 chars, 1–99%) | Body: `{ "name": "OS", "required": 75 }` |
| `POST` | `/api/classes` | Log class (attended/missed + note) | Body: `{ "subjectId": "...", "date": "2026-10-28", "status": "missed" }` |
| `GET` | `/api/whatif` | Simulate missing $N$ future classes | Query: `?subjectId=...&miss=3` |
| `GET` | `/api/tasks` | List catch-up tasks | Returns `[ { "id": "...", "note": "...", "due": "..." } ]` |
| `PATCH`| `/api/tasks/:id` | Mark task completed/pending | Body: `{ "done": true }` |
| `PUT` | `/api/settings` | Update emergency reserve (0–10) | Body: `{ "reserve": 4 }` |
| `POST` | `/api/demo/load` | Load fictional demo subjects/tasks | `{ "ok": true, "message": "Demo data loaded..." }` |
| `POST` | `/api/reset` | Clear all database records | `{ "ok": true, "message": "All data has been reset..." }` |

---

## 8. AI Tools & Development Methodology

This project was built using **Google Antigravity** as an AI pair-programming assistant. The development process followed a rigorous, incremental methodology:

1. **Step 1 — Backend & Pure Logic First:** Prompted Antigravity to build pure mathematical functions and comprehensive automated unit tests first, verifying integer arithmetic and boundary conditions before touching any UI.
2. **Step 2 — Data Store & Resilient REST API:** Built an atomic JSON store with auto-recovery for missing or corrupted files, followed by integration tests for all REST endpoints.
3. **Step 3 — Accessible, Framework-Free Frontend:** Developed a vanilla HTML, CSS, and JavaScript interface adhering strictly to WCAG AA guidelines, offline readiness, and zero `innerHTML` usage.
4. **Step 4 — Automated End-to-End Headless Verification:** Ran real browser tests via Chrome DevTools Protocol (CDP) to confirm 0 console errors and test user interactions end-to-end.

*All generated code and test outputs were reviewed, verified, and run manually.*

---

## 9. Verification & Real Test Results

Ran via `npm test` using Node.js built-in test runner (`node --test`):

```text
▶ HaziriGuard - API & Storage Integration Tests
  ✔ GET /api/health -> returns 200 with { ok: true } (33.2ms)
  ✔ POST /api/reset -> clears database to initial empty state (5.0ms)
  ▶ Subject Management (/api/subjects)
    ✔ creates a new subject with valid name and required percentage (20.6ms)
    ✔ rejects duplicate subject names case-insensitively (10.7ms)
    ✔ rejects invalid names (empty or too long) (6.1ms)
    ✔ rejects invalid required percentages (0, 100, out of bounds) (3.9ms)
  ✔ Subject Management (/api/subjects) (42.8ms)
  ▶ Class Logging & Catch-up Tasks (/api/classes & /api/tasks)
    ✔ logs an attended class without creating a catch-up task (5.0ms)
    ✔ logs a missed class and automatically creates a catch-up task due 2 days later (6.2ms)
    ✔ rejects class with non-existent subjectId (404) (2.6ms)
    ✔ rejects class with invalid date format or invalid date (3.4ms)
    ✔ GET /api/tasks lists tasks and PATCH /api/tasks/:id toggles done status (3.8ms)
  ✔ Class Logging & Catch-up Tasks (/api/classes & /api/tasks) (29.7ms)
  ▶ Settings & What-If (/api/settings & /api/whatif)
    ✔ PUT /api/settings updates reserve within 0-10 and rejects outside (4.7ms)
    ✔ GET /api/whatif simulates impact of future missed classes (3.8ms)
  ✔ Settings & What-If (/api/settings & /api/whatif) (8.7ms)
  ▶ Demo Data & Dashboard Sorting (/api/demo/load & /api/dashboard)
    ✔ POST /api/demo/load populates fictional data demonstrating all 4 statuses (4.9ms)
    ✔ GET /api/dashboard returns subjects sorted Danger first, then Careful, Safe, NoData (2.5ms)
  ✔ Demo Data & Dashboard Sorting (/api/demo/load & /api/dashboard) (7.8ms)
  ▶ Database Resilience & Corruption Recovery
    ✔ handles empty db.json file gracefully by reinitializing default schema (0.9ms)
    ✔ handles corrupted JSON in db.json gracefully by reinitializing default schema (0.9ms)
  ✔ Database Resilience & Corruption Recovery (1.9ms)
✔ HaziriGuard - API & Storage Integration Tests (136.3ms)

▶ HaziriGuard - Core Logic Tests
  ▶ Prompt Required Test Cases
    ✔ Case 1: 36 attended of 40 at 75% => safeMisses 8, status Safe (reserve 3) (0.8ms)
    ✔ Case 2: 28 of 40 at 75% => Danger, recoveryNeeded 8 (0.2ms)
    ✔ Case 3: 30 of 40 at 75% => exactly on limit, not Danger, safeMisses 0, status Careful (0.1ms)
    ✔ Case 4: t = 0 must not crash (returns NoData) (0.1ms)
  ✔ Prompt Required Test Cases (2.2ms)
  ▶ Input Validation & Error Handling
    ✔ rejects attended > total with clear error (0.4ms)
    ✔ rejects negative numbers with clear error (0.3ms)
    ✔ rejects non-integers with clear error (0.3ms)
    ✔ rejects required attendance of 0 or 100 or outside 1-99 (0.3ms)
  ✔ Input Validation & Error Handling (1.6ms)
  ▶ Percentage Formatting & Precision
    ✔ rounds percentages to 1 decimal place without floating-point drift (0.7ms)
  ✔ Percentage Formatting & Precision (0.8ms)
  ▶ Emergency Reserve & Spare Buffer Logic
    ✔ correctly calculates spareBuffer when safeMisses > reserve (0.2ms)
    ✔ sets status Careful and spareBuffer 0 when safeMisses equals reserve (0.1ms)
    ✔ sets status Careful and spareBuffer 0 when safeMisses < reserve but not below limit (0.1ms)
  ✔ Emergency Reserve & Spare Buffer Logic (0.5ms)
  ▶ whatIf Simulation Function
    ✔ simulates missing 0 classes identically to current state (0.2ms)
    ✔ simulates missing 5 classes accurately (0.1ms)
    ✔ simulates missing classes that push into Danger (0.2ms)
    ✔ validates missN boundaries (0 to 60 integers only) (0.3ms)
  ✔ whatIf Simulation Function (1.0ms)
✔ HaziriGuard - Core Logic Tests (8.7ms)

--------------------------------------------------
Total Tests: 33 passed, 0 failed, 0 skipped
Test Suites: 12 passed, 0 failed
Duration: ~336 ms
--------------------------------------------------
```

---

## 10. Responsible Design & Data Safety

- **Fictional Data Only:** Demo courses (*Operating Systems, Data Structures & Algorithms, Computer Networks, Quantum Computing Lab*) and class logs are completely fictional.
- **Zero Personal Data Collection:** HaziriGuard requires no user accounts, passwords, email addresses, student IDs, or analytics tracking.
- **Local Data Storage:** All information remains on the user's local machine inside `data/db.json`.
- **Zero Secrets & Zero Cloud APIs:** No external database connection strings, third-party authentication tokens, or AI API keys are used.

---

## 11. Known Limitations

1. **Institutional Variation:** Attendance regulations vary across colleges (some weight laboratory practicals separately or permit sanctioned medical duty leaves).
2. **Single-User Scope:** The app currently has no multi-user authentication; it is designed for a single student on a local machine.
3. **Local File Persistence:** Relies on a local JSON file (`data/db.json`), which is suitable for lightweight personal tracking but not multi-tenant concurrent writes.
4. **Manual Class Entry:** Does not connect directly to proprietary university ERP systems or scrape institutional portals.
5. **In-App Notifications Only:** Task deadlines and overdue badges are visual within the web interface (no push notifications or SMS alerts).
6. **Not an Official Record:** HaziriGuard is an advisory tool to help students stay safe; official attendance remains determined by the student's college records.

---

## 12. Future Improvements

- **Timetable & Calendar Sync:** Import class schedules via `.ics` or CSV files.
- **Progressive Web App (PWA):** Enable installation on mobile devices with local service worker notifications.
- **Exportable PDF Reports:** Generate shareable summaries for academic advisors or mentors.
- **Medical Leave Calculator:** Add specific rules for medical certificates and college duty exemptions.

---

## 13. Originality Declaration

> *"This project was built by me during PromptWars x KickToTech 2026 using AI tools openly."*

> **Track:** Education & Student Life  
> **Hackathon:** PromptWars x KickToTech 2026  
> **Tagline:** Protect your attendance. Recover before it's too late.

---

## 1. Problem & Target Users

### The Problem
Most universities and colleges enforce strict attendance rules (commonly requiring students to maintain at least 75% or 80% attendance). Under existing systems, students usually check their attendance portal only when semester examinations approach—when it is mathematically impossible to recover from a shortfall. This leads to debarment from examinations, mandatory semester repetitions, and severe academic stress.

### Target Users
- College and university students navigating strict attendance criteria.
- Students balancing academics with sports, internships, illness, or extracurriculars who need to keep a reliable safety margin.

---

## 2. Core Philosophy: Attendance Protection (Never Skipping)

Existing attendance apps frequently present numbers as *"classes you can bunk"*, encouraging students to skip until they hit the bare minimum. **HaziriGuard reverses this harmful pattern:**

1. **Safety Buffer, Not Bunk Margins:** We treat margin as an emergency safety buffer rather than permission to skip.
2. **Withheld Emergency Reserve:** An editable emergency reserve (default: 3 classes) is withheld. Even if a student is ahead, only classes *beyond* this emergency reserve are shown as spare buffer.
3. **Danger-First Prioritization:** Subjects below threshold are always sorted to the top of the dashboard so students confront shortfalls immediately.
4. **Automated Catch-up Tasks:** Whenever a class is logged as missed, HaziriGuard automatically generates a catch-up task with a 48-hour due date, reinforcing that *missed classes also mean missed content*.

---

## 3. Features

- **Danger-First Subject Cards:** Subjects are displayed in order of urgency (`Danger` &rarr; `Careful` &rarr; `Safe` &rarr; `NoData`).
- **Progress Bars with Threshold Markers:** Visual indicator showing current attendance alongside a visible marker at the required percentage.
- **Triple-Attribute Status Badges:** Accessible status indicators that combine color, icon, and text (`⚠️ Danger`, `⚡ Careful`, `🛡️ Safe`, `ℹ️ No Data`) to comply with accessibility standards.
- **One-Click Attendance Logging:** Log classes as *Attended* or *Missed* with optional lecture notes.
- **Catch-up Planner:** Automatic task scheduler for missed classes with overdue indicators (`⚠️ Overdue`) and completion checkboxes.
- **Interactive What-If Simulator:** Test prospective future absences (0–10 classes) in real time to see projected drops and recovery requirements before making a decision.
- **Configurable Emergency Reserve:** Adjust how many reserve classes are held back (0–10).
- **Fictional Demo Data:** Pre-populated dataset showcasing all four safety states with realistic class distributions.
- **Full Database Reset:** One-click confirmation to clear records for fresh tracking.
- **Accessible & Offline-Ready:** Zero external CDNs, fonts, or tracking scripts. Built using semantic HTML, high-contrast colors (WCAG AA), and an ARIA live region for screen readers.

---

## 4. How the Numbers Work (Transparent Math)

HaziriGuard uses **pure integer cross-multiplication** to prevent floating-point inaccuracies (such as `0.1 + 0.2 !== 0.3`).

For a subject with:
- $a$ = attended classes
- $t$ = total classes held
- $r$ = required attendance percentage ($1 \le r \le 99$)
- $e$ = emergency reserve ($0 \le e \le 10$, default 3)

### Formulas

| Metric | Formula | Purpose |
| :--- | :--- | :--- |
| **Percentage** | $t = 0 \implies \text{null}$, else $\text{round}(100 \times a / t, \text{1 decimal})$ | Display only |
| **Below Limit** | $100 \times a < r \times t$ | Integer boundary decision |
| **Safe Misses** | $t = 0 \implies 0$, else $\max(0, \lfloor(100a - rt) / r\rfloor)$ | Classes that can be missed before falling below $r\%$ |
| **Spare Buffer** | $\max(0, \text{safeMisses} - e)$ | Classes that can be missed *beyond* the emergency reserve |
| **Recovery Needed** | $\text{belowLimit} \implies \lceil(rt - 100a) / (100 - r)\rceil$, else $0$ | Consecutive upcoming classes student must attend to reach $r\%$ |
| **Status** | $t = 0 \implies \text{"NoData"}$; $\text{belowLimit} \implies \text{"Danger"}$; $\text{safeMisses} \le e \implies \text{"Careful"}$; else $\text{"Safe"}$ | Risk classification |

---

### Worked Examples

#### Example 1: 36 Attended of 40 Held at 75% Required (Reserve = 3)
- **Percentage:** $100 \times 36 / 40 = 90.0\%$
- **Below Limit:** $100 \times 36 = 3600 \ge 75 \times 40 = 3000$ (False)
- **Safe Misses:** $\lfloor(3600 - 3000) / 75\rfloor = \lfloor 600 / 75 \rfloor = 8\text{ classes}$
- **Spare Buffer:** $\max(0, 8 - 3) = 5\text{ classes spare}$
- **Recovery Needed:** $0\text{ classes}$
- **Status:** **Safe** (Student has 5 spare classes beyond the 3 emergency reserve classes)

#### Example 2: 28 Attended of 40 Held at 75% Required (Reserve = 3)
- **Percentage:** $100 \times 28 / 40 = 70.0\%$
- **Below Limit:** $100 \times 28 = 2800 < 75 \times 40 = 3000$ (True &rarr; Below Threshold)
- **Safe Misses:** $\max(0, \lfloor(2800 - 3000) / 75\rfloor) = 0\text{ classes}$
- **Spare Buffer:** $0\text{ classes}$
- **Recovery Needed:** $\lceil(3000 - 2800) / (100 - 75)\rceil = \lceil 200 / 25 \rceil = 8\text{ consecutive classes}$
- **Status:** **Danger** (Action required: student must attend the next 8 consecutive classes without absence)

---

## 5. How to Run & Test

### Prerequisites
- Node.js (v18.0.0 or later, v24+ tested)
- npm

### Installation & Startup
```powershell
# 1. Install dependencies (single dependency: express)
npm install

# 2. Run automated test suite
npm test

# 3. Start the HaziriGuard server
npm start
```

Open your browser and navigate to:  
`http://localhost:3000`

---

## 6. Folder Structure & Component Responsibilities

```text
HaziriGuard/
├── .gitignore          # Excludes node_modules, logs, env files, and data/db.json
├── package.json        # Single dependency (express) and scripts ("start", "test")
├── server.js           # Express REST API, static asset serving, port fallback
├── src/
│   ├── logic.js        # Pure calculation functions (no network/file I/O, integer math)
│   └── store.js        # Atomic file persistence for data/db.json with auto-recovery
├── public/
│   ├── index.html      # Accessible semantic UI with inline SVG logo
│   ├── styles.css      # Deep ink & teal design, WCAG AA compliant contrast
│   └── app.js          # Pure vanilla JS frontend, zero-innerHTML DOM rendering
└── tests/
    ├── logic.test.js   # Unit tests for core attendance formulas & boundaries
    └── api.test.js     # Integration tests for all REST API endpoints
```

---

## 7. REST API Endpoints

| Method | Endpoint | Description | Sample Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck | `{ "ok": true }` |
| `GET` | `/api/dashboard` | Aggregated metrics & sorted cards | `{ "settings": { "reserve": 3 }, "subjects": [...] }` |
| `POST` | `/api/subjects` | Create subject (1–60 chars, 1–99%) | Body: `{ "name": "OS", "required": 75 }` |
| `POST` | `/api/classes` | Log class (attended/missed + note) | Body: `{ "subjectId": "...", "date": "2026-10-28", "status": "missed" }` |
| `GET` | `/api/whatif` | Simulate missing $N$ future classes | Query: `?subjectId=...&miss=3` |
| `GET` | `/api/tasks` | List catch-up tasks | Returns `[ { "id": "...", "note": "...", "due": "..." } ]` |
| `PATCH`| `/api/tasks/:id` | Mark task completed/pending | Body: `{ "done": true }` |
| `PUT` | `/api/settings` | Update emergency reserve (0–10) | Body: `{ "reserve": 4 }` |
| `POST` | `/api/demo/load` | Load fictional demo subjects/tasks | `{ "ok": true, "message": "Demo data loaded..." }` |
| `POST` | `/api/reset` | Clear all database records | `{ "ok": true, "message": "All data has been reset..." }` |

---

## 8. AI Tools & Development Methodology

This project was built using **Google Antigravity** as an AI pair-programming assistant. The development process followed a rigorous, incremental methodology:

1. **Step 1 — Backend & Pure Logic First:** Prompted Antigravity to build pure mathematical functions and comprehensive automated unit tests first, verifying integer arithmetic and boundary conditions before touching any UI.
2. **Step 2 — Data Store & Resilient REST API:** Built an atomic JSON store with auto-recovery for missing or corrupted files, followed by integration tests for all REST endpoints.
3. **Step 3 — Accessible, Framework-Free Frontend:** Developed a vanilla HTML, CSS, and JavaScript interface adhering strictly to WCAG AA guidelines, offline readiness, and zero `innerHTML` usage.
4. **Step 4 — Automated End-to-End Headless Verification:** Ran real browser tests via Chrome DevTools Protocol (CDP) to confirm 0 console errors and test user interactions end-to-end.

*All generated code and test outputs were reviewed, verified, and run manually.*

---

## 9. Verification & Real Test Results

Ran via `npm test` using Node.js built-in test runner (`node --test`):

```text
▶ HaziriGuard - API & Storage Integration Tests
  ✔ GET /api/health -> returns 200 with { ok: true } (33.2ms)
  ✔ POST /api/reset -> clears database to initial empty state (5.0ms)
  ▶ Subject Management (/api/subjects)
    ✔ creates a new subject with valid name and required percentage (20.6ms)
    ✔ rejects duplicate subject names case-insensitively (10.7ms)
    ✔ rejects invalid names (empty or too long) (6.1ms)
    ✔ rejects invalid required percentages (0, 100, out of bounds) (3.9ms)
  ✔ Subject Management (/api/subjects) (42.8ms)
  ▶ Class Logging & Catch-up Tasks (/api/classes & /api/tasks)
    ✔ logs an attended class without creating a catch-up task (5.0ms)
    ✔ logs a missed class and automatically creates a catch-up task due 2 days later (6.2ms)
    ✔ rejects class with non-existent subjectId (404) (2.6ms)
    ✔ rejects class with invalid date format or invalid date (3.4ms)
    ✔ GET /api/tasks lists tasks and PATCH /api/tasks/:id toggles done status (3.8ms)
  ✔ Class Logging & Catch-up Tasks (/api/classes & /api/tasks) (29.7ms)
  ▶ Settings & What-If (/api/settings & /api/whatif)
    ✔ PUT /api/settings updates reserve within 0-10 and rejects outside (4.7ms)
    ✔ GET /api/whatif simulates impact of future missed classes (3.8ms)
  ✔ Settings & What-If (/api/settings & /api/whatif) (8.7ms)
  ▶ Demo Data & Dashboard Sorting (/api/demo/load & /api/dashboard)
    ✔ POST /api/demo/load populates fictional data demonstrating all 4 statuses (4.9ms)
    ✔ GET /api/dashboard returns subjects sorted Danger first, then Careful, Safe, NoData (2.5ms)
  ✔ Demo Data & Dashboard Sorting (/api/demo/load & /api/dashboard) (7.8ms)
  ▶ Database Resilience & Corruption Recovery
    ✔ handles empty db.json file gracefully by reinitializing default schema (0.9ms)
    ✔ handles corrupted JSON in db.json gracefully by reinitializing default schema (0.9ms)
  ✔ Database Resilience & Corruption Recovery (1.9ms)
✔ HaziriGuard - API & Storage Integration Tests (136.3ms)

▶ HaziriGuard - Core Logic Tests
  ▶ Prompt Required Test Cases
    ✔ Case 1: 36 attended of 40 at 75% => safeMisses 8, status Safe (reserve 3) (0.8ms)
    ✔ Case 2: 28 of 40 at 75% => Danger, recoveryNeeded 8 (0.2ms)
    ✔ Case 3: 30 of 40 at 75% => exactly on limit, not Danger, safeMisses 0, status Careful (0.1ms)
    ✔ Case 4: t = 0 must not crash (returns NoData) (0.1ms)
  ✔ Prompt Required Test Cases (2.2ms)
  ▶ Input Validation & Error Handling
    ✔ rejects attended > total with clear error (0.4ms)
    ✔ rejects negative numbers with clear error (0.3ms)
    ✔ rejects non-integers with clear error (0.3ms)
    ✔ rejects required attendance of 0 or 100 or outside 1-99 (0.3ms)
  ✔ Input Validation & Error Handling (1.6ms)
  ▶ Percentage Formatting & Precision
    ✔ rounds percentages to 1 decimal place without floating-point drift (0.7ms)
  ✔ Percentage Formatting & Precision (0.8ms)
  ▶ Emergency Reserve & Spare Buffer Logic
    ✔ correctly calculates spareBuffer when safeMisses > reserve (0.2ms)
    ✔ sets status Careful and spareBuffer 0 when safeMisses equals reserve (0.1ms)
    ✔ sets status Careful and spareBuffer 0 when safeMisses < reserve but not below limit (0.1ms)
  ✔ Emergency Reserve & Spare Buffer Logic (0.5ms)
  ▶ whatIf Simulation Function
    ✔ simulates missing 0 classes identically to current state (0.2ms)
    ✔ simulates missing 5 classes accurately (0.1ms)
    ✔ simulates missing classes that push into Danger (0.2ms)
    ✔ validates missN boundaries (0 to 60 integers only) (0.3ms)
  ✔ whatIf Simulation Function (1.0ms)
✔ HaziriGuard - Core Logic Tests (8.7ms)

--------------------------------------------------
Total Tests: 33 passed, 0 failed, 0 skipped
Test Suites: 12 passed, 0 failed
Duration: ~336 ms
--------------------------------------------------
```

---

## 10. Responsible Design & Data Safety

- **Fictional Data Only:** Demo courses (*Operating Systems, Data Structures & Algorithms, Computer Networks, Quantum Computing Lab*) and class logs are completely fictional.
- **Zero Personal Data Collection:** HaziriGuard requires no user accounts, passwords, email addresses, student IDs, or analytics tracking.
- **Local Data Storage:** All information remains on the user's local machine inside `data/db.json`.
- **Zero Secrets & Zero Cloud APIs:** No external database connection strings, third-party authentication tokens, or AI API keys are used.

---

## 11. Known Limitations

1. **Institutional Variation:** Attendance regulations vary across colleges (some weight laboratory practicals separately or permit sanctioned medical duty leaves).
2. **Single-User Scope:** The app currently has no multi-user authentication; it is designed for a single student on a local machine.
3. **Local File Persistence:** Relies on a local JSON file (`data/db.json`), which is suitable for lightweight personal tracking but not multi-tenant concurrent writes.
4. **Manual Class Entry:** Does not connect directly to proprietary university ERP systems or scrape institutional portals.
5. **In-App Notifications Only:** Task deadlines and overdue badges are visual within the web interface (no push notifications or SMS alerts).
6. **Not an Official Record:** HaziriGuard is an advisory tool to help students stay safe; official attendance remains determined by the student's college records.

---

## 12. Future Improvements

- **Timetable & Calendar Sync:** Import class schedules via `.ics` or CSV files.
- **Progressive Web App (PWA):** Enable installation on mobile devices with local service worker notifications.
- **Exportable PDF Reports:** Generate shareable summaries for academic advisors or mentors.
- **Medical Leave Calculator:** Add specific rules for medical certificates and college duty exemptions.

---

## 13. Originality Declaration

> *"This project was built by me during PromptWars x KickToTech 2026 using AI tools openly."*
# HaziriGuard
