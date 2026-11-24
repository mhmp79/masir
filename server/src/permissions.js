'use strict';

const { query } = require('./db');

const APPROVED = 'approved';

/** Advisor ids currently allowed to read/write a student's data. */
async function approvedAdvisorIds(studentId) {
  if (!studentId) return [];
  const { rows } = await query(
    `SELECT advisor_id::text AS id
       FROM advisor_links
      WHERE student_id = $1 AND status = $2`,
    [String(studentId), APPROVED],
  );
  return rows.map((row) => row.id);
}

/** Student ids an advisor (or admin) may see. */
async function approvedStudentIds(userId) {
  if (!userId) return [];
  const { rows } = await query(
    `SELECT student_id::text AS id
       FROM advisor_links
      WHERE advisor_id = $1 AND status = $2 AND student_id IS NOT NULL`,
    [String(userId), APPROVED],
  );
  return rows.map((row) => row.id);
}

/** Owner ids whose rows may be included in a snapshot for this user. */
async function visibleOwnerIds(user) {
  const owners = new Set([String(user.id)]);
  if (user.role === 'advisor' || user.role === 'admin') {
    for (const id of await approvedStudentIds(user.id)) owners.add(id);
  }
  return [...owners];
}

/** True when the user may write rows owned by ownerId. */
async function canWriteOwner(user, ownerId) {
  if (!ownerId) return false;
  if (String(ownerId) === String(user.id)) return true;
  if (user.role !== 'advisor' && user.role !== 'admin') return false;
  const { rowCount } = await query(
    `SELECT 1
       FROM advisor_links
      WHERE advisor_id = $1 AND student_id = $2 AND status = $3
      LIMIT 1`,
    [String(user.id), String(ownerId), APPROVED],
  );
  return rowCount > 0;
}

module.exports = {
  APPROVED,
  approvedAdvisorIds,
  approvedStudentIds,
  visibleOwnerIds,
  canWriteOwner,
};
