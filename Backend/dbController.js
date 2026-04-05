/*
Mock data access layer for testing frontend components and Unity integration.
This module will be refactored to execute asynchronous MySQL queries
targeting the production database.

NOTE: This file is a mock data layer for local development and UI prototyping.
Replace all in-memory arrays and functions with real MySQL queries for production.
When adding new analytics (e.g. per-player stats), update both this mock and schema.sql.

The question schema maps directly to the SQL structure:
questionText, optionA, optionB, optionC, optionD, correctAnswer (A/B/C/D)
*/

/*
The metrics object above is just class averages for now.
If we want better stats, we should add per-player data to the Sessions table and the game log.
That means both the backend and Unity need to handle something like:
   players: [
     { playerName: "Alice", correctCount: 7, incorrectCount: 1, ... }
   ]

 Stuff we might want to track for each player:
   - playerName: whatever the student types in
   - correctCount: how many they got right
   - incorrectCount: how many they missed
   - averageResponseTime: how fast they answer on average
   - fastestAnswer: their best time
   - missedQuestions: which questions they missed
   - improvementRate: did they get better over time?

If we add this, the AI summary can give more specific feedback for each student or the class.
*/

// Helper Functions (for date formatting) -------------------------------------------------
// Likely that only the third one will be useful now; db automatically updates timestamps, except for last_login in teachers
function padZero(num) {
    return num.toString().padStart(2, '0');
}

function formatToMySQLUTC(date) {
  const year = date.getUTCFullYear();
  const month = padZero(date.getUTCMonth() + 1); // 0-based → +1
  const day = padZero(date.getUTCDate());
  const hours = padZero(date.getUTCHours());
  const minutes = padZero(date.getUTCMinutes());
  const seconds = padZero(date.getUTCSeconds());
 
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function convertFromMySQLUTC(mysqlDateStr) {
    var t = mysqlDateStr.split(/[- :]/)

    // Put each element in the Date function (subtract 1 from month since it's 0-based)
    var d = new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]))

    // Adjust for local timezone
    var offset = new Date().getTimezoneOffset()
    d.setMinutes(d.getMinutes() - offset)

    return d
}


/*
Need to create MySQL functions for the following scenarios:
- Viewing personal decks
SELECT *
FROM decks
WHERE owner_id = ?;
- Viewing public decks
SELECT *
FROM decks
WHERE is_public = TRUE;
- Viewing deck contents (also for sending to Unity game)
SELECT *
FROM questions
WHERE deck_id = ?;
- Viewing session history
SELECT *
FROM game_sessions
WHERE teacher_id = ?;
- Viewing session details (check with frontend on what info and what functions)
?

- Creating/updating decks
INSERT INTO decks (owner_id, deck_name, description, subject_tag, is_public, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, NOW(), NOW())
ON DUPLICATE KEY UPDATE deck_name = ?, description = ?, subject_tag = ?, is_public = ?, updated_at = NOW();
- Creating/updating questions (part of above)
- Creating teacher accounts
INSERT INTO teachers (username, email, password_hash, display_name, created_at, last_login)
VALUES (?, ?, ?, ?, NOW(), NULL)
ON DUPLICATE KEY UPDATE


- Deleting decks (potentially)


- Uploading new session info


- Parsing data and calculating metrics from Unity game logs
- Comparing teacher login credentials to database



DO NEED to work with others on what format data should be received and sent in
*/

/*

 async function updateAccount(accountId, fields) {
  const allowedFields = ["display_name", "favorite_color"];

  const updates = Object.keys(fields)
    .filter(key => allowedFields.includes(key))
    .filter(key => fields[key] !== undefined);

  if (!updates.length) {
    throw new Error("No valid fields provided");
  }

  const setClause = updates.map(f => `${f} = ?`).join(", ");
  const values = updates.map(f => fields[f]);

  const sql = `UPDATE accounts SET ${setClause} WHERE account_id = ?`;

  const [result] = await pool.query(sql, [...values, accountId]);

  return result.affectedRows === 1;
} 


async function updateRecord(tableName, idValue, fields, allowedFields, idColumn = "id") {
  try {
    // 1. Validation & Filtering
    const updates = Object.keys(fields)
      .filter(key => allowedFields.includes(key) && fields[key] !== undefined);

    if (!updates.length) {
      // This is a "client error" - they sent nothing valid
      return { success: false, error: "No valid fields provided", code: 400 };
    }

    // 2. Build Query
    const now = new Date();
    const setClause = [...updates.map(f => `${f} = ?`), "updated_at = ?"].join(", ");
    const values = [...updates.map(f => fields[f]), now, idValue];
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`;

    // 3. Database Execution
    const [result] = await pool.query(sql, values);

    // 4. Result Handling
    if (result.affectedRows === 0) {
      return { success: false, error: "Record not found", code: 404 };
    }

    return { success: true, code: 200 };

  } catch (error) {
    // 5. Emergency Error Handling
    console.error(`[DB Error] Update failed on ${tableName}:`, error.message);
    
    // Check for specific DB errors (like connection loss)
    if (error.code === 'ECONNREFUSED') {
      return { success: false, error: "Database unavailable", code: 503 };
    }

    return { success: false, error: "Internal server error", code: 500 };
  }
}
*/

//Be sure to include dbConnect.js in I think this file...

const pool = require('./dbConnect').pool; //TODO: switch to ES6 import syntax after demo
//OR require('./dbConnect'), and then use pool.getConnection() and stuff

/*
Unity ingest contract (DB-side planning only):

Expected incoming session payload from Unity:
{
  teacher_id,          // server should prefer authenticated teacher identity
  deck_id,
  date_played,
  player_count,
  rounds_played,
  player_data: [
    {
      player_name,
      final_score,
      final_rank,
      questions_answered, // server-computed when omitted
      questions_correct,  // server-computed when omitted
      longest_streak      // server-computed when omitted
    }
  ],
  question_data: [
    {
      question_id,
      times_seen,         // server-computed when omitted
      times_correct,      // server-computed when omitted
      player_responses: [
        {
          player_name,
          answer_given,
          is_correct,
          response_time
        }
      ]
    }
  ]
}

Teacher ownership rule for current scope:
- Students do not have accounts yet.

SQL migration plan:
1) INSERT game_sessions row (host_teacher_id, deck_id, date_played, player_count, rounds_played, aggregate metrics).
2) INSERT/UPSERT one session_summaries row per player_data entry.
3) INSERT one session_results row per player_responses entry.
4) UPSERT question_metrics for each question_id (times_seen, times_correct, avg_response_ms, answer_dist).
*/

/*
Function used to insert a new record or update an existing one based on unique key constraints.
Inserts if a record with the same key doesn't exist, updates if it does.

FOR NOW, this works best for decks and questions upserts. Make sure it is compatible
with all other tables as well.
*/
//Have a time field?
//Separate functions, maybe, for dealing with teacher accounts...
async function upsertRecord(tableName, fields, allowedFields) {
  try {
    // 1. Validation & Filtering
    const validFields = Object.keys(fields)
      .filter(key => allowedFields.includes(key) && fields[key] !== undefined);
    if (!validFields.length) {
      return { success: false, error: "No valid fields provided", code: 400 };
    }

    // 2. Build Query
    const allFields = [...validFields];
    const allValues = [...validFields.map(f => fields[f])];

    const columnList = allFields.join(", ");
    const placeholders = allFields.map(() => "?").join(", ");
    const updateClause = allFields.map(f => `${f} = VALUES(${f})`).join(", ");

    const sql = `
      INSERT INTO ${tableName} (${columnList})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    // 3. Database Execution
    const [result] = await pool.query(sql, allValues);

    // 4. Result Handling
    // affectedRows is 1 for insert, 2 for update, 0 for no change
    return { 
      success: true, 
      code: 200,
      action: result.affectedRows === 1 ? "inserted" : "updated"
    };

  } catch (error) {
    console.error(`[DB Error] Upsert failed on ${tableName}:`, error.message);
    if (error.code === 'ECONNREFUSED') {
      return { success: false, error: "Database unavailable", code: 503 };
    }
    return { success: false, error: "Internal server error", code: 500 };
  }
}


/* 
Function used to get records from any table with flexible conditions and field selection. Should
never be exposed directly to the client, but can be used internally by other functions.
Arguments:
- tableName: string, the name of the table to query. Always hardcode in calling functions
- allowedFields: array of strings, fields that are allowed to be selected. Always hardcode
- conditions: object, key-value pairs (JSON) for WHERE clause
- allowedConditionFields: array of strings, fields that are allowed to be used in conditions.
  Always hardcode

Returns:
- On success: { success: true, code: 200, data: [...] }
- On client error (e.g. no valid fields): { success: false, error: "message", code: 400 }
- On not found: { success: false, error: "No records found", code: 404 }
- On server error: { success: false, error: "message", code: 500 or 503 }
*/
async function getRecords(tableName, allowedFields, conditions = {}, allowedConditionFields = []) {
  try {
    // 1. Build SELECT clause
    const selectClause = allowedFields.length
      ? allowedFields.join(", ")
      : "*";

    // 2. Build WHERE clause from conditions
    const validConditions = Object.keys(conditions)
      .filter(key => allowedConditionFields.includes(key) && conditions[key] !== undefined);

    const whereClause = validConditions.length
      ? `WHERE ${validConditions.map(f => `${f} = ?`).join(" AND ")}`
      : "";

    const values = validConditions.map(f => conditions[f]);

    // 3. Build and execute query
    const sql = `SELECT ${selectClause} FROM ${tableName} ${whereClause}`;
    const [rows] = await pool.query(sql, values);

    // 4. Handle results
    if (!rows.length) {
      return { success: false, error: "No records found", code: 404 };
    }

    return {
      success: true,
      code: 200,
      data: rows  // mysql2 already returns rows as JSON-friendly objects
    };

  } catch (error) {
    console.error(`[DB Error] Select failed on ${tableName}:`, error.message);
    if (error.code === "ECONNREFUSED") {
      return { success: false, error: "Database unavailable", code: 503 };
    }
    return { success: false, error: "Internal server error", code: 500 };
  }
}

/*
NOTES:
- pool.query() works as just a single query, but for multiple queries or transactions,
  we need to use pool.getConnection() and connection.query() with proper error handling and connection release.
*/

/*
Retrieve all available question decks.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM decks
// TODO after demo: switch data routes from data.js to database.js — replace with database.getDecks()
*/
async function getDecks(teacher_id) {
  try {
    const [rows] = await pool.query('SELECT * FROM decks WHERE owner_id = ?', [teacher_id]);
    return rows;
  } catch (error) {
    console.error('Error fetching decks:', error);
  }
  /*
  SELECT *
  FROM decks
  WHERE owner_id = ?;
  */
}

/*
Retrieve all historical session data.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM game_sessions
// TODO after demo: switch data routes from data.js to database.js — replace with database.getSessions()
*/
async function getSessions(id) {
  try {
    const [rows] = await pool.query('SELECT * FROM game_sessions WHERE teacher_id = ?', [id]);
    return rows;
  } catch (error) {
    console.error('Error fetching sessions:', error);
  }
  /*
  SELECT *
  FROM game_sessions
  WHERE teacher_id =?;
  */
}

//Huh? ----------------------------------------------------------------------------------------------------
/*
Retrieve a specific deck object by its primary key.
This function must be refactored to execute: SELECT * FROM decks WHERE deck_id = ?
// TODO after demo: switch data routes from data.js to database.js — replace with database.getDeckById(deckID)
*/
function getDeckById(deckID) {
  return Promise.resolve((() => {
    for (let i = 0; i < mockDecks.length; i += 1) {
      const deck = mockDecks[i];
      if (deck.id === deckID) {
        return deck;
      }
    }
    return null;
  })());
}


/*
Insert or update a question record.
Used only in saveDeck for now.
*/
function saveQuestion(fields) {
  //tablename, fields, allowedFields
  const allowedFields = ['question_id', 'deck_id', 'question_text', 'correct_answer', 'answer_options']
  response = upsertRecord('questions', fields, allowedFields)

  if (!response.success) {
    console.error('Error saving question:', response.error)
    return response
  }
}


/*
Save a deck and its associated questions to the database. Inserts if primary keys are not present, updates if they are.
Arguments:
- infoPackage: A JSON object containing all relevant deck and question info. Must include deck_id for updates, and question_id for question updates.
  Example format below. Note that the questions array can be empty if the teacher is just updating deck metadata without changing questions.
  {
  "deck_id": 12,
  "owner_id": 5,
  "deck_name": "Intro to History",
  "description": "A basic quiz on US history.",
  "subject_tag": "history",
  "number_of_questions": 2,
  "is_public": 0,
  "questions": [
    {
      "question_id": 34,
      "deck_id": 12,
      "question_text": "Who was the first US President?",
      "correct_answer": "George Washington",
      "answer_options": ["George Washington", "Abraham Lincoln", "Thomas Jefferson", "John Adams"]
    },
    {
      "question_id": 35,
      "deck_id": 12,
      "question_text": "The titanic sank in 1912.",
      "correct_answer": "true",
      "answer_options": ["true", "false"]
    }
  ]
}
  This is the most information an infoPackage should have for saving this number of questions. For new decks, the deck_id and question_ids can be 
  omitted or set to null, and the database will auto-assign them. For updates, they must be included to target the correct records. IF this is
  a math deck, the questions array should contain 1 object with the math deck parameters.

  Returns:
- On success: { success: true, code: 200, message: "Deck and questions saved successfully" }
- On client error (e.g. no valid fields): { success: false, error: "message", code: 400 }
- On not found (e.g. trying to update a deck that doesn't exist): { success: false, error: "Deck not found", code: 404 }
- On server error: { success: false, error: "message", code: 500 or 503 }
*/
function saveDeck(infoPackage) {

  //First, save the deck and its metadata.
  const allowedDeckFields = ['deck_id', 'owner_id', 'deck_name', 'description', 'subject_tag', 'number_of_questions', 'is_public']
  const deckResponse = upsertRecord('decks', infoPackage, allowedDeckFields)

  //Handle errors saving the deck
  if (!deckResponse.success) {
    console.error('Error saving deck:', deckResponse.error)
    return deckResponse
  }

  //Second, save what is in the questions array
  
  //If the deck subject tag is math, the questions array
  //contains a single object with math parameters. Save accordingly
  if (infoPackage.subject_tag === 'math') {
    const allowedMathFields = ['deck_id', 'operations', 'lowest_number', 'highest_number', 'number_of_operands', 'subject_tag']
    const mathResponse = upsertRecord('math_decks', infoPackage.questions[0], allowedMathFields)
    if (!mathResponse.success) {
      console.error('Error saving math deck parameters:', mathResponse.error)
      return mathResponse
    }
    return { success: true, code: 200, message: "Math deck and parameters saved successfully" }
  }

  //If the subject tag is anything else, the questions array contains
  //a list of questions. Save those questions. Loop through the array
  //and call saveQuestion for each one
  const questions = infoPackage.questions || []
  const questionResponses = []

  for (const question of questions) {
    question.deck_id = infoPackage.deck_id  // Ensure question has the correct deck_id
    const questionResponse = saveQuestion(question)
    questionResponses.push(questionResponse)
  }

  //Handle errors saving questions
  if (questionResponses.some(res => !res.success)) {
    console.error('Error saving one or more questions:', questionResponses.filter(res => !res.success).map(res => res.error));
    return { success: false, error: "Error saving one or more questions", code: 500 };
  }

  //Final response if everything succeeded
  return { success: true, code: 200, message: "Deck and questions saved successfully" };

  
}


/*
Retrieve a specific session object by its primary key.
This function must be refactored to execute: SELECT * FROM game_sessions WHERE session_id = ?
// TODO after demo: switch data routes from data.js to database.js — replace with database.getSessionById(sessionID)
*/
function getSessionById(sessionID) {
  return Promise.resolve((() => {
    for (let i = 0; i < mockSessions.length; i += 1) {
      const session = mockSessions[i];
      if (session.id === sessionID) {
        return session;
      }
    }
    return null;
  })());
}

//What about a math deck????????
function getExportForUnity(deckID) {
  const allowedDeckFields = ['deck_id', 'deck_name', 'subject_tag', 'number_of_questions']
  const allowedDeckConditions = ['deck_id']
  const deck = getRecords('decks', allowedDeckFields, {"deck_id": deckID}, allowedDeckConditions)

  if (!deck.success) {
    return { success: false, error: "Deck not found", code: 404 };
  }

  const allowedQuestionFields = ['question_id', 'question_text', 'correct_answer', 'answer_options']
  const allowedQuestionConditions = ['deck_id']
  const questions = getRecords('questions', allowedQuestionFields, {"deck_id": deckID}, allowedQuestionConditions)

  if (!questions.success) {
    return { success: false, error: "Questions not found for deck", code: 404 };
  }

  return { //Not correct format, maybe.....
    deck: deck.data[0],  // Assuming deck_id is unique, so we take the first result
    questions: questions.data
  }

}


module.exports = {
  getDecks,
  getSessions,
  getDeckById,
  getSessionById,
  saveDeck,
  getExportForUnity
};
