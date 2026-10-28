/**
 * Tests for HaziriGuard REST API (server.js & src/store.js)
 * Uses Node's built-in test runner (`node:test`) and fetch.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const app = require('../server');
const { setDbPath, resetDbPath, readDb, writeDb } = require('../src/store');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'db.test.json');

describe('HaziriGuard - API & Storage Integration Tests', () => {
  let server;
  let baseUrl;

  before((t, done) => {
    // Direct store to isolated test file
    setDbPath(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Listen on dynamic available port
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((t, done) => {
    server.close(() => {
      // Clean up test DB file and reset store path
      resetDbPath();
      if (fs.existsSync(TEST_DB_PATH)) {
        try {
          fs.unlinkSync(TEST_DB_PATH);
        } catch (_) {}
      }
      done();
    });
  });

  it('GET /api/health -> returns 200 with { ok: true }', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true });
  });

  it('POST /api/reset -> clears database to initial empty state', async () => {
    const res = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);

    const db = readDb();
    assert.equal(db.subjects.length, 0);
    assert.equal(db.classes.length, 0);
    assert.equal(db.tasks.length, 0);
    assert.equal(db.settings.reserve, 3);
  });

  describe('Subject Management (/api/subjects)', () => {
    it('creates a new subject with valid name and required percentage', async () => {
      const res = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '  Algorithms  ', required: 75 })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.id);
      assert.equal(body.name, 'Algorithms'); // Trimmed
      assert.equal(body.required, 75);
    });

    it('rejects duplicate subject names case-insensitively', async () => {
      const res = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'algorithms', required: 75 })
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.error, /already exists/i);
    });

    it('rejects invalid names (empty or too long)', async () => {
      const resEmpty = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ', required: 75 })
      });
      assert.equal(resEmpty.status, 400);

      const longName = 'A'.repeat(61);
      const resLong = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName, required: 75 })
      });
      assert.equal(resLong.status, 400);
    });

    it('rejects invalid required percentages (0, 100, out of bounds)', async () => {
      const resZero = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Physics', required: 0 })
      });
      assert.equal(resZero.status, 400);

      const resHundred = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Chemistry', required: 100 })
      });
      assert.equal(resHundred.status, 400);
    });
  });

  describe('Class Logging & Catch-up Tasks (/api/classes & /api/tasks)', () => {
    let subjectId;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Operating Systems', required: 75 })
      });
      const data = await res.json();
      subjectId = data.id;
    });

    it('logs an attended class without creating a catch-up task', async () => {
      const res = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          date: '2026-10-01',
          status: 'attended',
          note: 'Process Scheduling'
        })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.classItem.status, 'attended');
      assert.equal(body.task, null);
    });

    it('logs a missed class and automatically creates a catch-up task due 2 days later', async () => {
      const res = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          date: '2026-10-05',
          status: 'missed',
          note: 'Deadlocks'
        })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.classItem.status, 'missed');
      assert.ok(body.task);
      assert.equal(body.task.due, '2026-10-07'); // Exactly 2 days later
      assert.equal(body.task.done, false);
      assert.match(body.task.note, /Deadlocks/);
    });

    it('rejects class with non-existent subjectId (404)', async () => {
      const res = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: 'non-existent-id',
          date: '2026-10-05',
          status: 'attended'
        })
      });
      assert.equal(res.status, 404);
    });

    it('rejects class with invalid date format or invalid date', async () => {
      const resFormat = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          date: '05-10-2026',
          status: 'attended'
        })
      });
      assert.equal(resFormat.status, 400);

      const resInvalid = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId,
          date: '2026-02-30', // Feb 30th does not exist
          status: 'attended'
        })
      });
      assert.equal(resInvalid.status, 400);
    });

    it('GET /api/tasks lists tasks and PATCH /api/tasks/:id toggles done status', async () => {
      const listRes = await fetch(`${baseUrl}/api/tasks`);
      assert.equal(listRes.status, 200);
      const tasks = await listRes.json();
      assert.ok(tasks.length >= 1);
      const task = tasks[0];

      // Toggle done to true
      const patchRes = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true })
      });
      assert.equal(patchRes.status, 200);
      const updated = await patchRes.json();
      assert.equal(updated.done, true);

      // Verify validation: done must be boolean
      const invalidPatch = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: 'yes' })
      });
      assert.equal(invalidPatch.status, 400);
    });
  });

  describe('Settings & What-If (/api/settings & /api/whatif)', () => {
    it('PUT /api/settings updates reserve within 0-10 and rejects outside', async () => {
      const res = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserve: 4 })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.reserve, 4);

      // Rejects out of bounds
      const resInvalid = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserve: 15 })
      });
      assert.equal(resInvalid.status, 400);
    });

    it('GET /api/whatif simulates impact of future missed classes', async () => {
      const db = readDb();
      const subject = db.subjects[0];

      const res = await fetch(`${baseUrl}/api/whatif?subjectId=${subject.id}&miss=2`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.subjectId, subject.id);
      assert.equal(data.simulatedMisses, 2);
      assert.ok('safeMisses' in data);
      assert.ok('status' in data);
    });
  });

  describe('Demo Data & Dashboard Sorting (/api/demo/load & /api/dashboard)', () => {
    it('POST /api/demo/load populates fictional data demonstrating all 4 statuses', async () => {
      const res = await fetch(`${baseUrl}/api/demo/load`, { method: 'POST' });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);

      const db = readDb();
      assert.equal(db.subjects.length, 4);
      assert.equal(db.classes.length, 120); // 40 * 3
      assert.ok(db.tasks.length > 0);
    });

    it('GET /api/dashboard returns subjects sorted Danger first, then Careful, Safe, NoData', async () => {
      const res = await fetch(`${baseUrl}/api/dashboard`);
      assert.equal(res.status, 200);
      const body = await res.json();

      assert.ok(body.settings);
      assert.equal(body.subjects.length, 4);

      const statuses = body.subjects.map(s => s.status);
      assert.deepEqual(statuses, ['Danger', 'Careful', 'Safe', 'NoData']);

      // Danger card checks (Operating Systems: 28/40 at 75%)
      const dangerCard = body.subjects[0];
      assert.equal(dangerCard.name, 'Operating Systems');
      assert.equal(dangerCard.attended, 28);
      assert.equal(dangerCard.total, 40);
      assert.equal(dangerCard.percentage, 70.0);
      assert.equal(dangerCard.recoveryNeeded, 8);
      assert.ok(dangerCard.pendingCatchUps > 0);

      // Careful card checks (Computer Networks: 30/40 at 75%)
      const carefulCard = body.subjects[1];
      assert.equal(carefulCard.name, 'Computer Networks');
      assert.equal(carefulCard.attended, 30);
      assert.equal(carefulCard.total, 40);
      assert.equal(carefulCard.safeMisses, 0);
      assert.equal(carefulCard.spareBuffer, 0);

      // Safe card checks (Data Structures & Algorithms: 36/40 at 75%)
      const safeCard = body.subjects[2];
      assert.equal(safeCard.name, 'Data Structures & Algorithms');
      assert.equal(safeCard.attended, 36);
      assert.equal(safeCard.total, 40);
      assert.equal(safeCard.safeMisses, 8);
      assert.equal(safeCard.spareBuffer, 5);

      // NoData card checks (Quantum Computing Lab: 0/0)
      const noDataCard = body.subjects[3];
      assert.equal(noDataCard.name, 'Quantum Computing Lab');
      assert.equal(noDataCard.attended, 0);
      assert.equal(noDataCard.total, 0);
      assert.equal(noDataCard.percentage, null);
      assert.equal(noDataCard.status, 'NoData');
    });
  });

  describe('Database Resilience & Corruption Recovery', () => {
    it('handles empty db.json file gracefully by reinitializing default schema', () => {
      fs.writeFileSync(TEST_DB_PATH, '', 'utf8');
      const data = readDb();
      assert.equal(data.settings.reserve, 3);
      assert.deepEqual(data.subjects, []);
      assert.deepEqual(data.classes, []);
      assert.deepEqual(data.tasks, []);
    });

    it('handles corrupted JSON in db.json gracefully by reinitializing default schema', () => {
      fs.writeFileSync(TEST_DB_PATH, '{"corrupted": true, incomplete...', 'utf8');
      const data = readDb();
      assert.equal(data.settings.reserve, 3);
      assert.deepEqual(data.subjects, []);
      assert.deepEqual(data.classes, []);
      assert.deepEqual(data.tasks, []);
    });
  });
});

