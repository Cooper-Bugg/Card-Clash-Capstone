// ============================================================
// IMPORTS
// ============================================================

const { pool } = require('./dbConnect');

// ============================================================
// PRIMITIVE HELPERS
// ============================================================

/*
 * Filters an object's keys against an allowlist and checks for undefined values.
 * Used as the shared validation step across all query builders.
 *
 * @param {Object} fields - Key-value pairs to validate
 * @param {string[]} allowedFields - Whitelist of permitted field names
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, fields: string[], values: any[] }}
 */
function filterValidFields(fields, allowedFields) {
  const valid = Object.keys(fields)
    .filter(key => allowedFields.includes(key) && fields[key] !== undefined);

  if (!valid.length) {
    return { success: false, error: "No valid fields provided", code: 400 };
  }

  return { success: true, fields: valid, values: valid.map(f => fields[f]) };
}

/*
 * Builds a WHERE clause from a conditions object.
 * Used directly by updateRecord and as a base for buildSelectClauses.
 *
 * @param {Object} conditions - Key-value pairs for WHERE conditions
 * @param {string[]} allowedConditionFields - Whitelist of permitted condition field names
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, whereClause: string, conditionValues: any[] }}
 *
 * @example
 * buildConditionFields({ teacher_id: 5 }, ['teacher_id'])
 * // { success: true, whereClause: "teacher_id = ?", conditionValues: [5] }
 */
function buildConditionFields(conditions, allowedConditionFields) {
  const validConditions = Object.keys(conditions)
    .filter(key => allowedConditionFields.includes(key) && conditions[key] !== undefined);

  if (!validConditions.length) {
    return { success: false, error: "No valid conditions provided", code: 400 };
  }

  return {
    success: true,
    whereClause: validConditions.map(f => `${f} = ?`).join(" AND "),
    conditionValues: validConditions.map(f => conditions[f])
  };
}

// ============================================================
// QUERY BUILDERS
// ============================================================

/*
 * Builds clauses for a SELECT query.
 * Wraps buildConditionFields and adds SELECT and WHERE keyword formatting.
 *
 * @param {string[]} allowedFields - Fields to SELECT. Passes "*" if empty
 * @param {Object} conditions - Key-value pairs for WHERE conditions
 * @param {string[]} allowedConditionFields - Whitelist of permitted condition field names
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, selectClause: string, whereClause: string, values: any[] }}
 *
 * @example
 * buildSelectClauses(['name', 'email'], { teacher_id: 5 }, ['teacher_id'])
 * // { success: true, selectClause: "name, email", whereClause: "WHERE teacher_id = ?", values: [5] }
 */
function buildSelectClauses(allowedFields, conditions, allowedConditionFields) {
  const selectClause = allowedFields.length ? allowedFields.join(", ") : "*";

  const conditionResponse = buildConditionFields(conditions, allowedConditionFields);
  if (!conditionResponse.success) return conditionResponse;

  return {
    success: true,
    selectClause,
    whereClause: `WHERE ${conditionResponse.whereClause}`,
    values: conditionResponse.conditionValues
  };
}

/*
 * Builds clauses for an INSERT ... ON DUPLICATE KEY UPDATE query.
 *
 * @param {Object} fields - Key-value pairs to insert/update
 * @param {string[]} allowedFields - Whitelist of permitted field names
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, allValues: any[], columnList: string, placeholders: string, updateClause: string }}
 *
 * @example
 * buildUpsertFields({ deck_id: 1, name: 'My Deck' }, ['deck_id', 'name'])
 * // { success: true, allValues: [1, 'My Deck'], columnList: "deck_id, name",
 * //   placeholders: "?, ?", updateClause: "deck_id = VALUES(deck_id), name = VALUES(name)" }
 */
function buildUpsertFields(fields, allowedFields) {
  const response = filterValidFields(fields, allowedFields);
  if (!response.success) return response;

  const { fields: validFields, values } = response;
  return {
    success: true,
    allValues: values,
    columnList: validFields.join(", "),
    placeholders: validFields.map(() => "?").join(", "),
    updateClause: validFields.map(f => `${f} = VALUES(${f})`).join(", ")
  };
}

/*
 * Builds clauses for an UPDATE ... SET query.
 *
 * @param {Object} fields - Key-value pairs to update
 * @param {string[]} allowedFields - Whitelist of permitted field names
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, setClause: string, fieldValues: any[] }}
 *
 * @example
 * buildUpdateFields({ last_login: '2026-01-01' }, ['last_login'])
 * // { success: true, setClause: "last_login = ?", fieldValues: ['2026-01-01'] }
 */
function buildUpdateFields(fields, allowedFields) {
  const response = filterValidFields(fields, allowedFields);
  if (!response.success) return response;

  const { fields: validFields, values } = response;
  return {
    success: true,
    fieldValues: values,
    setClause: validFields.map(f => `${f} = ?`).join(", ")
  };
}

// ============================================================
// ERROR HANDLING
// ============================================================

/*
 * Standardizes error responses for all async DB functions.
 *
 * @param {string} operation - The operation that failed e.g. "Upsert", "Update"
 * @param {string} tableName - The table the operation was attempted on
 * @param {Error} error - The caught error object
 * @returns {{ success: false, error: string, code: number }}
 */
function handleDBError(operation, tableName, error) {
  console.error(`[DB Error] ${operation} failed on ${tableName}:`, error.message);
  if (error.code === 'ECONNREFUSED') {
    return { success: false, error: "Database unavailable", code: 503 };
  }
  return { success: false, error: "Internal server error", code: 500 };
}

// ============================================================
// DB FUNCTIONS
// ============================================================

/*
 * Fetches records from a table with optional field selection and conditions.
 * Should never be exposed directly to the client.
 *
 * @param {string} tableName - Table to query. Always hardcode in calling functions
 * @param {string[]} allowedFields - Fields to SELECT. Always hardcode
 * @param {Object} conditions - Key-value pairs for WHERE clause
 * @param {string[]} allowedConditionFields - Permitted condition fields. Always hardcode
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, code: 200, data: Object[] }}
 */
async function getRecords(tableName, allowedFields, conditions = {}, allowedConditionFields = []) {
  try {
    const response = buildSelectClauses(allowedFields, conditions, allowedConditionFields);
    if (!response.success) return response;

    const { selectClause, whereClause, values } = response;

    const sql = `SELECT ${selectClause} FROM ${tableName} ${whereClause}`;
    const [rows] = await pool.query(sql, values);

    if (!rows.length) {
      return { success: false, error: "No records found", code: 404 };
    }

    return { success: true, code: 200, data: rows };

  } catch (error) {
    return handleDBError("Select", tableName, error);
  }
}

/*
 * Fetches records from a table with support for JOIN clauses.
 * Should never be exposed directly to the client.
 *
 * @param {string} tableName - Base table to query. Always hardcode in calling functions
 * @param {string[]} allowedFields - Fields to SELECT. Always hardcode
 * @param {Object} conditions - Key-value pairs for WHERE clause
 * @param {string[]} allowedConditionFields - Permitted condition fields. Always hardcode
 * @param {{ type: string, table: string, on: string }[]} joinClauses - Array of JOIN definitions
 *   @param {string} joinClauses[].type - Join type: "INNER" | "LEFT" | "RIGHT" | "FULL"
 *   @param {string} joinClauses[].table - Table to join
 *   @param {string} joinClauses[].on - Join condition e.g. "game_sessions.deck_id = decks.deck_id"
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, code: 200, data: Object[] }}
 */
async function getRecordsWithJoins(tableName, allowedFields, conditions = {}, allowedConditionFields = [], joinClauses = []) {
  try {
    const ALLOWED_JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"];
    for (const join of joinClauses) {
      if (!ALLOWED_JOIN_TYPES.includes(join.type.toUpperCase())) {
        return { success: false, error: `Invalid join type: ${join.type}`, code: 400 };
      }
    }

    const response = buildSelectClauses(allowedFields, conditions, allowedConditionFields);
    if (!response.success) return response;

    const { selectClause, whereClause, values } = response;

    const joins = joinClauses.map(({ type, table, on }) => `${type} JOIN ${table} ON ${on}`);

    const sql = `SELECT ${selectClause} FROM ${tableName} ${joins.join(" ")} ${whereClause}`;
    const [rows] = await pool.query(sql, values);

    if (!rows.length) {
      return { success: false, error: "No records found", code: 404 };
    }

    return { success: true, code: 200, data: rows };

  } catch (error) {
    return handleDBError("Select", tableName, error);
  }
}

/*
 * Inserts a new record or updates an existing one based on unique key constraints.
 * affectedRows: 1 = inserted, 2 = updated, 0 = no change.
 *
 * @param {string} tableName - Table to upsert into. Always hardcode in calling functions
 * @param {Object} fields - Key-value pairs to insert/update
 * @param {string[]} allowedFields - Permitted field names. Always hardcode
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, code: 200, action: "inserted" | "updated" }}
 */
async function upsertRecord(tableName, fields, allowedFields) {
  try {
    const response = buildUpsertFields(fields, allowedFields);
    if (!response.success) return response;

    const { allValues, columnList, placeholders, updateClause } = response;

    const sql = `
      INSERT INTO ${tableName} (${columnList})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    const [result] = await pool.query(sql, allValues);

    return {
      success: true,
      code: 200,
      action: result.affectedRows === 1 ? "inserted" : "updated",
      insertID: result.insertId
    };

  } catch (error) {
    return handleDBError("Upsert", tableName, error);
  }
}

/*
 * Updates an existing record in a table.
 * Use this over upsertRecord when the record is guaranteed to exist,
 * or when the table has non-nullable columns without defaults.
 *
 * @param {string} tableName - Table to update. Always hardcode in calling functions
 * @param {Object} fields - Key-value pairs of columns to update
 * @param {Object} conditions - Key-value pairs for WHERE clause
 * @param {string[]} allowedFields - Permitted field names. Always hardcode
 * @param {string[]} allowedConditionFields - Permitted condition fields. Always hardcode
 * @returns {{ success: false, error: string, code: number }
 *          |{ success: true, code: 200, action: "updated" | "no_change" }}
 */
async function updateRecord(tableName, fields, conditions, allowedFields, allowedConditionFields) {
  try {
    const fieldsResponse = buildUpdateFields(fields, allowedFields);
    if (!fieldsResponse.success) return fieldsResponse;

    const conditionsResponse = buildConditionFields(conditions, allowedConditionFields);
    if (!conditionsResponse.success) return conditionsResponse;

    const { setClause, fieldValues } = fieldsResponse;
    const { whereClause, conditionValues } = conditionsResponse;

    const sql = `
      UPDATE ${tableName}
      SET ${setClause}
      WHERE ${whereClause}
    `;

    const [result] = await pool.query(sql, [...fieldValues, ...conditionValues]);

    return {
      success: true,
      code: 200,
      action: result.affectedRows > 0 ? "updated" : "no_change"
    };

  } catch (error) {
    return handleDBError("Update", tableName, error);
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getRecords,
    getRecordsWithJoins,
    upsertRecord,
    updateRecord
};