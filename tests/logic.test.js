/**
 * Tests for HaziriGuard Core Logic (src/logic.js)
 * Uses Node's built-in test runner (`node:test`) and assertions (`node:assert`).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateAttendance, whatIf, validateInputs } = require('../src/logic');

describe('HaziriGuard - Core Logic Tests', () => {

  describe('Prompt Required Test Cases', () => {
    it('Case 1: 36 attended of 40 at 75% => safeMisses 8, status Safe (reserve 3)', () => {
      const result = calculateAttendance(36, 40, 75, 3);
      assert.equal(result.attended, 36);
      assert.equal(result.total, 40);
      assert.equal(result.percentage, 90.0);
      assert.equal(result.belowLimit, false);
      assert.equal(result.safeMisses, 8);
      assert.equal(result.spareBuffer, 5); // 8 safe misses - 3 reserve = 5 spare
      assert.equal(result.recoveryNeeded, 0);
      assert.equal(result.status, 'Safe');
    });

    it('Case 2: 28 of 40 at 75% => Danger, recoveryNeeded 8', () => {
      const result = calculateAttendance(28, 40, 75, 3);
      assert.equal(result.attended, 28);
      assert.equal(result.total, 40);
      assert.equal(result.percentage, 70.0);
      assert.equal(result.belowLimit, true);
      assert.equal(result.safeMisses, 0);
      assert.equal(result.spareBuffer, 0);
      assert.equal(result.recoveryNeeded, 8); // (75*40 - 100*28)/(100-75) = 200/25 = 8
      assert.equal(result.status, 'Danger');
    });

    it('Case 3: 30 of 40 at 75% => exactly on limit, not Danger, safeMisses 0, status Careful', () => {
      const result = calculateAttendance(30, 40, 75, 3);
      assert.equal(result.attended, 30);
      assert.equal(result.total, 40);
      assert.equal(result.percentage, 75.0);
      assert.equal(result.belowLimit, false);
      assert.equal(result.safeMisses, 0);
      assert.equal(result.spareBuffer, 0);
      assert.equal(result.recoveryNeeded, 0);
      assert.equal(result.status, 'Careful'); // safeMisses (0) <= reserve (3)
    });

    it('Case 4: t = 0 must not crash (returns NoData)', () => {
      const result = calculateAttendance(0, 0, 75, 3);
      assert.equal(result.attended, 0);
      assert.equal(result.total, 0);
      assert.equal(result.percentage, null);
      assert.equal(result.belowLimit, false);
      assert.equal(result.safeMisses, 0);
      assert.equal(result.spareBuffer, 0);
      assert.equal(result.recoveryNeeded, 0);
      assert.equal(result.status, 'NoData');
    });
  });

  describe('Input Validation & Error Handling', () => {
    it('rejects attended > total with clear error', () => {
      assert.throws(
        () => calculateAttendance(41, 40, 75, 3),
        /Attended classes cannot exceed total classes/
      );
    });

    it('rejects negative numbers with clear error', () => {
      assert.throws(
        () => calculateAttendance(-1, 40, 75, 3),
        /Values cannot be negative/
      );
      assert.throws(
        () => calculateAttendance(10, -5, 75, 3),
        /Values cannot be negative/
      );
      assert.throws(
        () => calculateAttendance(10, 20, 75, -1),
        /Values cannot be negative/
      );
    });

    it('rejects non-integers with clear error', () => {
      assert.throws(
        () => calculateAttendance(10.5, 20, 75, 3),
        /must all be whole integers/
      );
      assert.throws(
        () => calculateAttendance(10, 20.2, 75, 3),
        /must all be whole integers/
      );
      assert.throws(
        () => calculateAttendance(10, 20, 75.5, 3),
        /must all be whole integers/
      );
      assert.throws(
        () => calculateAttendance(10, 20, 75, 2.5),
        /must all be whole integers/
      );
    });

    it('rejects required attendance of 0 or 100 or outside 1-99', () => {
      assert.throws(
        () => calculateAttendance(10, 20, 0, 3),
        /Required attendance percentage must be a whole number between 1 and 99/
      );
      assert.throws(
        () => calculateAttendance(10, 20, 100, 3),
        /Required attendance percentage must be a whole number between 1 and 99/
      );
      assert.throws(
        () => calculateAttendance(10, 20, -10, 3),
        /Required attendance percentage must be a whole number between 1 and 99/
      );
      assert.throws(
        () => calculateAttendance(10, 20, 120, 3),
        /Required attendance percentage must be a whole number between 1 and 99/
      );
    });
  });

  describe('Percentage Formatting & Precision', () => {
    it('rounds percentages to 1 decimal place without floating-point drift', () => {
      // 1 attended out of 3 = 33.3333...% => 33.3
      const res1 = calculateAttendance(1, 3, 75, 3);
      assert.equal(res1.percentage, 33.3);

      // 2 attended out of 3 = 66.6666...% => 66.7
      const res2 = calculateAttendance(2, 3, 75, 3);
      assert.equal(res2.percentage, 66.7);

      // 7 attended out of 8 = 87.5%
      const res3 = calculateAttendance(7, 8, 75, 3);
      assert.equal(res3.percentage, 87.5);
    });
  });

  describe('Emergency Reserve & Spare Buffer Logic', () => {
    it('correctly calculates spareBuffer when safeMisses > reserve', () => {
      // 35 of 40 at 75% => safeMisses = floor((3500 - 3000)/75) = floor(500/75) = 6
      // reserve = 3 => spareBuffer = 3
      const res = calculateAttendance(35, 40, 75, 3);
      assert.equal(res.safeMisses, 6);
      assert.equal(res.spareBuffer, 3);
      assert.equal(res.status, 'Safe');
    });

    it('sets status Careful and spareBuffer 0 when safeMisses equals reserve', () => {
      // safeMisses = 3, reserve = 3 => spareBuffer = 0, status Careful
      // 100*a - 75*t = 75*3 = 225 => if t = 40, 75*40 + 225 = 3225 (not multiple of 100)
      // Let t = 20, r = 75: 75*20 = 1500. For safeMisses 3: 1500 + 3*75 = 1725.
      // Let's test with a=33, t=40, r=75: 3300 - 3000 = 300. floor(300/75) = 4.
      // With reserve = 4:
      const res = calculateAttendance(33, 40, 75, 4);
      assert.equal(res.safeMisses, 4);
      assert.equal(res.spareBuffer, 0);
      assert.equal(res.status, 'Careful');
    });

    it('sets status Careful and spareBuffer 0 when safeMisses < reserve but not below limit', () => {
      // 31 of 40 at 75%: 3100 - 3000 = 100. floor(100/75) = 1.
      // reserve = 3 => safeMisses = 1 <= 3 => Careful, spareBuffer = 0
      const res = calculateAttendance(31, 40, 75, 3);
      assert.equal(res.safeMisses, 1);
      assert.equal(res.spareBuffer, 0);
      assert.equal(res.status, 'Careful');
    });
  });

  describe('whatIf Simulation Function', () => {
    it('simulates missing 0 classes identically to current state', () => {
      const base = calculateAttendance(36, 40, 75, 3);
      const sim = whatIf(36, 40, 75, 3, 0);
      assert.equal(sim.simulatedMisses, 0);
      assert.equal(sim.total, 40);
      assert.equal(sim.percentage, base.percentage);
      assert.equal(sim.safeMisses, base.safeMisses);
      assert.equal(sim.status, base.status);
    });

    it('simulates missing 5 classes accurately', () => {
      // Currently 36/40. If we miss 5 more, total becomes 45, attended stays 36.
      // percentage: 36/45 = 80.0%
      // 100*36 - 75*45 = 3600 - 3375 = 225. 225/75 = 3.
      // safeMisses: 3, reserve: 3 => spareBuffer: 0, status: Careful
      const sim = whatIf(36, 40, 75, 3, 5);
      assert.equal(sim.simulatedMisses, 5);
      assert.equal(sim.attended, 36);
      assert.equal(sim.total, 45);
      assert.equal(sim.percentage, 80.0);
      assert.equal(sim.safeMisses, 3);
      assert.equal(sim.spareBuffer, 0);
      assert.equal(sim.status, 'Careful');
    });

    it('simulates missing classes that push into Danger', () => {
      // Currently 36/40. If we miss 9 classes, total becomes 49, attended 36.
      // 100*36 = 3600, 75*49 = 3675. 3600 < 3675 => Danger!
      const sim = whatIf(36, 40, 75, 3, 9);
      assert.equal(sim.simulatedMisses, 9);
      assert.equal(sim.total, 49);
      assert.equal(sim.belowLimit, true);
      assert.equal(sim.status, 'Danger');
      assert.ok(sim.recoveryNeeded > 0);
    });

    it('validates missN boundaries (0 to 60 integers only)', () => {
      assert.doesNotThrow(() => whatIf(36, 40, 75, 3, 0));
      assert.doesNotThrow(() => whatIf(36, 40, 75, 3, 60));

      assert.throws(() => whatIf(36, 40, 75, 3, -1), /between 0 and 60/);
      assert.throws(() => whatIf(36, 40, 75, 3, 61), /between 0 and 60/);
      assert.throws(() => whatIf(36, 40, 75, 3, 2.5), /between 0 and 60/);
      assert.throws(() => whatIf(36, 40, 75, 3, '5'), /between 0 and 60/);
    });
  });
});

