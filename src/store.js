/**
 * HaziriGuard - Data Store
 *
 * Handles reading and writing to `data/db.json`.
 *
 * Robustness guarantees:
 * - Auto-creates directory and db.json if missing.
 * - Handles empty or corrupted JSON gracefully by falling back to default schema.
 * - Writes safely via a temporary file before renaming (atomic write pattern).
 * - Exposes configurable path so automated tests can run against an isolated test DB.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
let activeDbPath = DEFAULT_DB_PATH;

/**
 * Returns a fresh default data structure.
 */
function getDefaultData() {
  return {
    settings: {
      reserve: 3
    },
    subjects: [],
    classes: [],
    tasks: []
  };
}

/**
 * Sets a custom path for the database file (used during tests).
 * @param {string} customPath
 */
function setDbPath(customPath) {
  activeDbPath = customPath;
}

/**
 * Resets the database path back to the default `data/db.json`.
 */
function resetDbPath() {
  activeDbPath = DEFAULT_DB_PATH;
}

/**
 * Gets the currently active database path.
 * @returns {string}
 */
function getDbPath() {
  return activeDbPath;
}

/**
 * Safely writes data to the database file.
 * Uses atomic file replacement (write to temp file then rename) to prevent corruption.
 *
 * @param {object} data - Complete database object
 */
function writeDb(data) {
  const dir = path.dirname(activeDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonString = JSON.stringify(data, null, 2);
  const tmpPath = `${activeDbPath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;

  try {
    fs.writeFileSync(tmpPath, jsonString, 'utf8');
    fs.renameSync(tmpPath, activeDbPath);
  } catch (err) {
    // Fallback if atomic rename is blocked (e.g., Windows file lock quirks)
    fs.writeFileSync(activeDbPath, jsonString, 'utf8');
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {
        // Ignore cleanup error
      }
    }
  }
}

/**
 * Reads and parses the database file.
 * Automatically recovers from missing, empty, or corrupted files.
 *
 * @returns {object} Database content conforming to schema
 */
function readDb() {
  const dir = path.dirname(activeDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(activeDbPath)) {
    const defaultData = getDefaultData();
    writeDb(defaultData);
    return defaultData;
  }

  try {
    const raw = fs.readFileSync(activeDbPath, 'utf8');
    if (!raw.trim()) {
      // Empty file: recover with default structure
      const defaultData = getDefaultData();
      writeDb(defaultData);
      return defaultData;
    }

    const parsed = JSON.parse(raw);

    // Validate and sanitize data shape to guarantee required keys exist
    const sanitized = {
      settings: parsed.settings && Number.isInteger(parsed.settings.reserve)
        ? { reserve: parsed.settings.reserve }
        : { reserve: 3 },
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
    };

    return sanitized;
  } catch (err) {
    // Corrupted file (e.g. invalid JSON syntax): recover gracefully
    const defaultData = getDefaultData();
    writeDb(defaultData);
    return defaultData;
  }
}

/**
 * Resets the active database to clean default state.
 * @returns {object} Clean default database object
 */
function resetDb() {
  const defaultData = getDefaultData();
  writeDb(defaultData);
  return defaultData;
}

module.exports = {
  getDefaultData,
  getDbPath,
  setDbPath,
  resetDbPath,
  readDb,
  writeDb,
  resetDb
};

