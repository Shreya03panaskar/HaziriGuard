/**
 * HaziriGuard - Core Attendance Logic
 *
 * PURE FUNCTIONS ONLY:
 * - No file system operations
 * - No network requests
 * - No external dependencies
 *
 * Core Principles:
 * 1. INTEGER MATH ONLY for decisions:
 *    Floating-point numbers in computers can have subtle rounding issues
 *    (e.g., 0.1 + 0.2 === 0.30000000000000004). By multiplying percentages by 100
 *    and using cross-multiplication (100 * a < r * t), we avoid any boundary miscalculations.
 *
 * 2. EMERGENCY RESERVE PROTECTION:
 *    We never encourage students to cut classes. Even if a student has 8 "safe misses",
 *    we withhold an emergency reserve (e.g. 3 classes for sudden illness or emergencies).
 *    Only the margin beyond the reserve is shown as "spare buffer".
 */

/**
 * Validates the inputs for attendance calculations.
 * Throws a descriptive Error if any input is invalid.
 *
 * @param {number} a - Attended classes (must be non-negative integer)
 * @param {number} t - Total classes held (must be non-negative integer, >= a)
 * @param {number} r - Required percentage threshold (whole integer 1 to 99)
 * @param {number} e - Emergency reserve held back (non-negative integer)
 */
function validateInputs(a, t, r, e) {
  // Check that all inputs are valid integers
  if (!Number.isInteger(a) || !Number.isInteger(t) || !Number.isInteger(r) || !Number.isInteger(e)) {
    throw new Error('Attended classes, total classes, required percentage, and reserve must all be whole integers.');
  }

  // Check for negative numbers
  if (a < 0 || t < 0 || e < 0) {
    throw new Error('Values cannot be negative.');
  }

  // Attendance cannot exceed total classes conducted
  if (a > t) {
    throw new Error('Attended classes cannot exceed total classes.');
  }

  // College attendance requirements must be strictly between 1% and 99%
  if (r < 1 || r > 99) {
    throw new Error('Required attendance percentage must be a whole number between 1 and 99.');
  }
}

/**
 * Calculates attendance metrics and safety status.
 *
 * Formulas:
 * - percentage: round(100 * a / t, 1 decimal) or null if total is 0
 * - belowLimit: 100 * a < r * t
 * - safeMisses: max(0, floor((100 * a - r * t) / r))
 * - spareBuffer: max(0, safeMisses - e)
 * - recoveryNeeded: belowLimit ? ceil((r * t - 100 * a) / (100 - r)) : 0
 * - status: "NoData" | "Danger" | "Careful" | "Safe"
 *
 * @param {number} a - Attended classes
 * @param {number} t - Total classes
 * @param {number} r - Required percentage (1-99)
 * @param {number} [e=3] - Emergency reserve (default 3)
 * @returns {object} Calculated metrics
 */
function calculateAttendance(a, t, r, e = 3) {
  validateInputs(a, t, r, e);

  // If no classes have happened yet, we cannot compute a percentage
  if (t === 0) {
    return {
      attended: 0,
      total: 0,
      required: r,
      reserve: e,
      percentage: null,
      belowLimit: false,
      safeMisses: 0,
      spareBuffer: 0,
      recoveryNeeded: 0,
      status: 'NoData'
    };
  }

  // Display percentage formatted with 1 decimal place using integer rounding
  const percentage = Math.round((1000 * a) / t) / 10;

  // Exact integer comparison: (100 * a / t < r) <=> (100 * a < r * t)
  const belowLimit = (100 * a) < (r * t);

  // How many future classes can you miss before dropping below r%?
  // Condition: 100 * a / (t + m) >= r  =>  100 * a >= r * t + r * m  =>  m <= (100 * a - r * t) / r
  const safeMisses = Math.max(0, Math.floor((100 * a - r * t) / r));

  // Spare buffer is only the misses allowed beyond the emergency reserve
  const spareBuffer = Math.max(0, safeMisses - e);

  // If below limit, how many consecutive classes must be attended to reach r%?
  // Condition: 100 * (a + c) / (t + c) >= r  =>  100 * a + 100 * c >= r * t + r * c
  // => (100 - r) * c >= r * t - 100 * a  =>  c >= (r * t - 100 * a) / (100 - r)
  const recoveryNeeded = belowLimit
    ? Math.ceil((r * t - 100 * a) / (100 - r))
    : 0;

  // Determine safety status:
  // 1. Danger: currently below the required threshold
  // 2. Careful: safeMisses is within or equal to emergency reserve (no spare buffer)
  // 3. Safe: student has safe misses beyond the emergency reserve
  let status = 'Safe';
  if (belowLimit) {
    status = 'Danger';
  } else if (safeMisses <= e) {
    status = 'Careful';
  }

  return {
    attended: a,
    total: t,
    required: r,
    reserve: e,
    percentage,
    belowLimit,
    safeMisses,
    spareBuffer,
    recoveryNeeded,
    status
  };
}

/**
 * Simulates the impact of missing N future classes.
 * Total classes increases by missN, while attended classes remains unchanged.
 *
 * @param {number} a - Attended classes
 * @param {number} t - Total classes
 * @param {number} r - Required percentage (1-99)
 * @param {number} [e=3] - Emergency reserve (default 3)
 * @param {number} missN - Number of upcoming classes simulated as missed (0-60)
 * @returns {object} Simulated attendance metrics
 */
function whatIf(a, t, r, e = 3, missN = 0) {
  if (!Number.isInteger(missN) || missN < 0 || missN > 60) {
    throw new Error('Missed classes must be an integer between 0 and 60.');
  }

  // Calculate with new total: (t + missN) and same attended: a
  const result = calculateAttendance(a, t + missN, r, e);

  return {
    ...result,
    simulatedMisses: missN
  };
}

module.exports = {
  validateInputs,
  calculateAttendance,
  whatIf
};

