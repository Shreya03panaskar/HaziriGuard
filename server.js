/**
 * HaziriGuard - Server & REST API
 *
 * Express backend that exposes:
 * - Static file serving for /public
 * - Subject and attendance tracking
 * - Calculation dashboard with safety buffer & emergency reserve
 * - Catch-up tasks auto-generated on missed classes
 * - "What-If" attendance simulation
 * - Demo data loader & database reset
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { calculateAttendance, whatIf } = require('./src/logic');
const { readDb, writeDb, resetDb } = require('./src/store');

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Serve static frontend assets from /public
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Priority order for dashboard display:
 * 1. Danger  - Attendance below required threshold (action needed immediately)
 * 2. Careful - At or near reserve (no spare buffer left for emergencies)
 * 3. Safe    - Attendance is solid with buffer beyond emergency reserve
 * 4. NoData  - New subject with no classes conducted yet
 */
const STATUS_ORDER = {
  Danger: 1,
  Careful: 2,
  Safe: 3,
  NoData: 4
};

// ==========================================
// API ROUTES
// ==========================================

/**
 * GET /api/health
 * Simple healthcheck endpoint.
 */
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/dashboard
 * Aggregates all subjects, derives attendance numbers from class logs,
 * calculates safety status, and sorts them by risk (Danger first).
 */
app.get('/api/dashboard', (req, res) => {
  try {
    const db = readDb();
    const reserve = db.settings.reserve;

    const subjectCards = db.subjects.map(subject => {
      // Derive attendance metrics by counting class records
      const subjectClasses = db.classes.filter(c => c.subjectId === subject.id);
      const total = subjectClasses.length;
      const attended = subjectClasses.filter(c => c.status === 'attended').length;

      // Count uncompleted catch-up tasks
      const pendingCatchUps = db.tasks.filter(
        t => t.subjectId === subject.id && !t.done
      ).length;

      // Calculate pure metrics
      const metrics = calculateAttendance(attended, total, subject.required, reserve);

      return {
        id: subject.id,
        name: subject.name,
        required: subject.required,
        attended,
        total,
        percentage: metrics.percentage,
        safeMisses: metrics.safeMisses,
        spareBuffer: metrics.spareBuffer,
        recoveryNeeded: metrics.recoveryNeeded,
        status: metrics.status,
        pendingCatchUps
      };
    });

    // Sort by risk priority: Danger -> Careful -> Safe -> NoData
    subjectCards.sort((a, b) => {
      const orderA = STATUS_ORDER[a.status] || 99;
      const orderB = STATUS_ORDER[b.status] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({
      settings: db.settings,
      subjects: subjectCards
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve dashboard data.' });
  }
});

/**
 * POST /api/subjects
 * Adds a new subject to track.
 * Body: { name: string, required: number (1-99) }
 */
app.post('/api/subjects', (req, res) => {
  try {
    const { name, required } = req.body;

    if (typeof name !== 'string') {
      return res.status(400).json({ error: 'Subject name must be a string.' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      return res.status(400).json({ error: 'Subject name must be between 1 and 60 characters.' });
    }

    const reqNum = Number(required);
    if (!Number.isInteger(reqNum) || reqNum < 1 || reqNum > 99) {
      return res.status(400).json({ error: 'Required attendance must be a whole number between 1 and 99.' });
    }

    const db = readDb();

    // Check unique name (case-insensitive)
    const duplicate = db.subjects.some(
      s => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({ error: 'A subject with this name already exists.' });
    }

    const newSubject = {
      id: crypto.randomUUID(),
      name: trimmedName,
      required: reqNum
    };

    db.subjects.push(newSubject);
    writeDb(db);

    res.status(201).json(newSubject);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create subject.' });
  }
});

/**
 * POST /api/classes
 * Logs a class attendance record.
 * Body: { subjectId: string, date: "YYYY-MM-DD", status: "attended"|"missed", note?: string }
 * If status is "missed", automatically generates a catch-up task due 2 days later.
 */
app.post('/api/classes', (req, res) => {
  try {
    const { subjectId, date, status, note } = req.body;

    const db = readDb();
    const subject = db.subjects.find(s => s.id === subjectId);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    // Validate date format YYYY-MM-DD
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD.' });
    }

    // Validate that it represents an actual calendar date
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      return res.status(400).json({ error: 'Invalid calendar date.' });
    }

    if (status !== 'attended' && status !== 'missed') {
      return res.status(400).json({ error: 'Status must be either "attended" or "missed".' });
    }

    const cleanNote = typeof note === 'string' ? note.trim() : '';

    const newClass = {
      id: crypto.randomUUID(),
      subjectId,
      date,
      status,
      note: cleanNote
    };
    db.classes.push(newClass);

    let newTask = null;
    // Auto-create catch-up task when a class is missed
    if (status === 'missed') {
      const dueDate = new Date(Date.UTC(year, month - 1, day + 2)).toISOString().slice(0, 10);
      newTask = {
        id: crypto.randomUUID(),
        subjectId,
        classId: newClass.id,
        note: cleanNote ? `Catch up: ${cleanNote}` : `Catch up on missed ${subject.name} class`,
        due: dueDate,
        done: false
      };
      db.tasks.push(newTask);
    }

    writeDb(db);

    res.status(201).json({
      classItem: newClass,
      task: newTask
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record class.' });
  }
});

/**
 * GET /api/whatif?subjectId=..&miss=N
 * Simulates the effect of missing N future classes on attendance.
 */
app.get('/api/whatif', (req, res) => {
  try {
    const { subjectId, miss } = req.query;

    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId parameter is required.' });
    }

    const db = readDb();
    const subject = db.subjects.find(s => s.id === subjectId);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    if (miss === undefined || miss === '') {
      return res.status(400).json({ error: 'miss parameter is required.' });
    }

    const missN = Number(miss);
    if (!Number.isInteger(missN) || missN < 0 || missN > 60) {
      return res.status(400).json({ error: 'Missed classes must be an integer between 0 and 60.' });
    }

    const subjectClasses = db.classes.filter(c => c.subjectId === subject.id);
    const total = subjectClasses.length;
    const attended = subjectClasses.filter(c => c.status === 'attended').length;

    const simulation = whatIf(attended, total, subject.required, db.settings.reserve, missN);

    res.json({
      subjectId: subject.id,
      subjectName: subject.name,
      ...simulation
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate what-if scenario.' });
  }
});

/**
 * GET /api/tasks
 * Returns all catch-up tasks.
 */
app.get('/api/tasks', (req, res) => {
  try {
    const db = readDb();
    res.json(db.tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tasks.' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Marks a catch-up task as done or undone.
 * Body: { done: boolean }
 */
app.patch('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { done } = req.body;

    if (typeof done !== 'boolean') {
      return res.status(400).json({ error: "'done' must be a boolean (true or false)." });
    }

    const db = readDb();
    const task = db.tasks.find(t => t.id === id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    task.done = done;
    writeDb(db);

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

/**
 * PUT /api/settings
 * Updates editable settings (e.g. emergency reserve classes).
 * Body: { reserve: number (0-10) }
 */
app.put('/api/settings', (req, res) => {
  try {
    const { reserve } = req.body;

    if (!Number.isInteger(reserve) || reserve < 0 || reserve > 10) {
      return res.status(400).json({ error: 'Reserve must be an integer between 0 and 10.' });
    }

    const db = readDb();
    db.settings.reserve = reserve;
    writeDb(db);

    res.json(db.settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

/**
 * POST /api/demo/load
 * Clears current database and populates carefully crafted FICTIONAL demo data
 * demonstrating all 4 states: Danger, Careful, Safe, NoData.
 */
app.post('/api/demo/load', (req, res) => {
  try {
    const demoSubjects = [
      { id: 'subj-dsa', name: 'Data Structures & Algorithms', required: 75 },
      { id: 'subj-os', name: 'Operating Systems', required: 75 },
      { id: 'subj-cn', name: 'Computer Networks', required: 75 },
      { id: 'subj-qc', name: 'Quantum Computing Lab', required: 80 }
    ];

    const demoClasses = [];
    const demoTasks = [];

    // Helper to generate dates in YYYY-MM-DD
    const makeDate = (dayOffset) => {
      const d = new Date(Date.UTC(2026, 8, 1 + dayOffset)); // Sept 1st, 2026 onwards
      return d.toISOString().slice(0, 10);
    };

    // 1. Data Structures & Algorithms: 40 classes, 36 attended, 4 missed => 90% (Safe, safeMisses: 8, spareBuffer: 5)
    for (let i = 0; i < 40; i++) {
      const status = (i === 10 || i === 20 || i === 30 || i === 35) ? 'missed' : 'attended';
      const classId = `class-dsa-${i + 1}`;
      const classDate = makeDate(i);
      demoClasses.push({
        id: classId,
        subjectId: 'subj-dsa',
        date: classDate,
        status,
        note: status === 'missed' ? `Missed lecture #${i + 1}` : ''
      });
      if (status === 'missed') {
        const dueDate = makeDate(i + 2);
        demoTasks.push({
          id: `task-dsa-${i + 1}`,
          subjectId: 'subj-dsa',
          classId,
          note: `Catch up: Lecture #${i + 1} notes`,
          due: dueDate,
          done: true // Student already caught up
        });
      }
    }

    // 2. Operating Systems: 40 classes, 28 attended, 12 missed => 70% (Danger, recoveryNeeded: 8)
    for (let i = 0; i < 40; i++) {
      const status = (i % 3 === 0 && demoClasses.filter(c => c.subjectId === 'subj-os' && c.status === 'missed').length < 12)
        ? 'missed'
        : 'attended';
      const classId = `class-os-${i + 1}`;
      const classDate = makeDate(i);
      demoClasses.push({
        id: classId,
        subjectId: 'subj-os',
        date: classDate,
        status,
        note: status === 'missed' ? `Missed OS Module ${Math.floor(i / 4) + 1}` : ''
      });
      if (status === 'missed') {
        const dueDate = makeDate(i + 2);
        demoTasks.push({
          id: `task-os-${i + 1}`,
          subjectId: 'subj-os',
          classId,
          note: `Catch up: OS Module ${Math.floor(i / 4) + 1}`,
          due: dueDate,
          done: false // Pending catch-up
        });
      }
    }

    // 3. Computer Networks: 40 classes, 30 attended, 10 missed => 75% (Careful, safeMisses: 0, spareBuffer: 0)
    for (let i = 0; i < 40; i++) {
      const status = (i % 4 === 0 && demoClasses.filter(c => c.subjectId === 'subj-cn' && c.status === 'missed').length < 10)
        ? 'missed'
        : 'attended';
      const classId = `class-cn-${i + 1}`;
      const classDate = makeDate(i);
      demoClasses.push({
        id: classId,
        subjectId: 'subj-cn',
        date: classDate,
        status,
        note: status === 'missed' ? `Missed CN Lab ${Math.floor(i / 4) + 1}` : ''
      });
      if (status === 'missed') {
        const dueDate = makeDate(i + 2);
        demoTasks.push({
          id: `task-cn-${i + 1}`,
          subjectId: 'subj-cn',
          classId,
          note: `Catch up: CN Lab ${Math.floor(i / 4) + 1}`,
          due: dueDate,
          done: true
        });
      }
    }

    // 4. Quantum Computing Lab: 0 classes conducted => NoData

    const demoData = {
      settings: { reserve: 3 },
      subjects: demoSubjects,
      classes: demoClasses,
      tasks: demoTasks
    };

    writeDb(demoData);

    res.json({
      ok: true,
      message: 'Demo data loaded successfully with 4 sample subjects demonstrating all safety states.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load demo data.' });
  }
});

/**
 * POST /api/reset
 * Resets database to clean initial empty state.
 */
app.post('/api/reset', (req, res) => {
  try {
    resetDb();
    res.json({
      ok: true,
      message: 'All data has been reset to empty initial state.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset database.' });
  }
});

// Start listener only when run directly (not when imported in tests)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`HaziriGuard server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

