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
NOTES:
- pool.query() works as just a single query, but for multiple queries or transactions,
  we need to use pool.getConnection() and connection.query() with proper error handling and connection release.
*/

//Try to console.log or console.error things

//import { hash, compare } from 'bcryptjs';

// ============================================================
// IMPORTS AND CONSTANTS
// ============================================================

//import { pool } from './dbConnect.js';

//const { pool } = require('./dbConnect'); //TODO: switch to ES6 import syntax after demo; actually, this format works as it needs to

const { getRecords, getRecordsWithJoins, upsertRecord, updateRecord } = require('./dbQueries');

const bcrypt = require('bcryptjs');

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10

// ============================================================
// HELPER FUNCTIONS
// ============================================================

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

async function hashPassword(plainTextPassword) {
  const hashedPassword = await bcrypt.hash(plainTextPassword, saltRounds);
  return hashedPassword;
}

async function verifyPassword(plainTextPassword, storedHash) {
  const match = await bcrypt.compare(plainTextPassword, storedHash);
  return match;
}






// ============================================================
// RETRIEVAL FUNCTIONS FOR FRONTEND/UNITY REQUESTS
// ============================================================


async function validateTeacherCredentials(username, password) {
  const allowedFields = ['teacher_id', 'password_hash']
  const allowedConditionFields = ['username']
  const response = await getRecords('teachers', allowedFields, { username: username }, allowedConditionFields)

  if (!response.success) {
    console.error('Error validating account credentials', response.error)
    return { success: false, error: response.error, code: response.code }
  }

  const passwordHash = response.data[0].password_hash

  const isValid = await verifyPassword(password, passwordHash)

  if (isValid) {
    // Optionally, update last_login timestamp here with another query
    const response2 = await updateRecord('teachers',  //table name
                                          { last_login: formatToMySQLUTC(new Date()) },  //fields to update
                                          { teacher_id: response.data[0].teacher_id },  //conditions (which record to update)
                                          ['last_login'],  //allowed fields (to update)
                                          [ 'teacher_id' ])  //allowed condition fields) 
    return { success: true, id: response.data[0].teacher_id, code: 200, message: "Credentials valid" }
  }

  console.log('Invalid credentials for username: ' + username)

  return { success: false, error: "Invalid username or password", code: 401 }
}


/*
Retrieve all available question decks.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM decks
// TODO after demo: switch data routes from data.js to database.js — replace with database.getDecks()
*/
async function getDecks(teacher_id) {
  const allowedFields = ['deck_id', 'deck_name', 'number_of_questions', 'description', 'subject_tag'] //id, name, number of questions, description? subject tag...
  const allowedConditionFields = ['owner_id']
  const response = await getRecords('decks', allowedFields, { owner_id: teacher_id }, allowedConditionFields)

  if (!response.success) {
    console.error('Error fetching decks:', response.error)
    return { success: false, error: response.error, code: response.code }
  }

  return {success: true, code: 200, data: response.data }
}

/*
Retrieve all historical session data.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM game_sessions
// TODO after demo: switch data routes from data.js to database.js — replace with database.getSessions()
*/
async function getSessions(teacher_id) {
  const allowedFields = ['session_id', 'game_sessions.deck_id', 'deck_name', 'date_played', 'rounds_played',
                        'average_accuracy', 'average_response_time_ms', 'ai_summary_text'] //id, name, number of questions, description? subject tag...
  const allowedConditionFields = ['owner_id']
  const joinClauses = [
    { type: "INNER", table: "decks", on: "game_sessions.deck_id = decks.deck_id" }
  ]
  const response = await getRecordsWithJoins('game_sessions', allowedFields, { owner_id: teacher_id }, allowedConditionFields, joinClauses)

  if (!response.success) {
    console.error('Error fetching sessions:', response.error)
    return { success: false, error: response.error, code: response.code }
  }

  return {success: true, code: 200, data: response.data }
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
//MATH DECK PATH?
async function getDeckById(deckID, teacher_id) {
  const allowedFields = ['deck_id', 'deck_name', 'number_of_questions', 'description', 'subject_tag'] //id, name, number of questions, description? subject tag...
  const allowedConditionFields = ['deck_id', 'owner_id']
  const deckResponse = await getRecords('decks', allowedFields, { deck_id: deckID, owner_id: teacher_id }, allowedConditionFields)

  if (!deckResponse.success) {
    console.error('Error fetching decks:', deckResponse.error)
    return { success: false, error: deckResponse.error, code: deckResponse.code }
  }

  const foundDeckID = deckResponse.data[0].deck_id

  //Unnecessary check?
  if (foundDeckID !== deckID) {
    console.error(`Deck ID mismatch: requested ${deckID} but got ${foundDeckID}`)
    return { success: false, error: "Deck ID mismatch", code: 500 }
  }

  const allowedQuestionFields = ['question_id', 'question_text', 'question_type', 'correct_answer', 'answer_options']
  const allowedQuestionConditionFields = ['deck_id']
  const questionResponse = await getRecords('questions', allowedQuestionFields, { deck_id: foundDeckID }, allowedQuestionConditionFields);

  if (!questionResponse.success) {
    console.error('Error fetching questions for deck:', questionResponse.error)
    return { success: false, error: questionResponse.error, code: questionResponse.code }
  }

  return {success: true, code: 200, data: { deck: deckResponse.data[0], questions: questionResponse.data } }
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
  const allowedDeckFields = ['deck_id', 'deck_name', 'description', 'number_of_questions']
  const allowedDeckConditions = ['deck_id']
  const deck = getRecords('decks', allowedDeckFields, {"deck_id": deckID}, allowedDeckConditions)

  if (!deck.success) {
    return { success: false, error: "Deck not found", code: 404 };
  }

  const allowedQuestionFields = ['question_id', 'question_text', 'question_type','correct_answer', 'answer_options']
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


// ============================================================
// SAVE/UPDATE FUNCTIONS WITH CLIENT DATA INPUT
// ============================================================

/*
Registers a teacher account to the database.
Recheck this to make sure it works for updates too, although that may not happen anytime soon...
NEED TO HAVE WAY TO UPDATE LAST LOGIN... WHEN WILL THAT FUNCTION BE CALLED AND WHAT WILL IT TAKE?
Arguments:
- username: string, unique username for the teacher
- email: string, teacher's email address
- password: string, plaintext password (will be hashed before storing)
- displayName: string, name to display in the Unity game

Returns:
- not sure yet
*/
// MAYBE NOT GOOD>>> WHAT ABOUT UNIQUE USERNAME/EMAIL CONSTRAINTS?
async function registerTeacherAccount(username, email, password, displayName) {
  const allowedFields = ['username', 'email', 'password_hash', 'display_name']
  const hashedPassword = await hashPassword(password)
  const response = await upsertRecord('teachers', { username: username, email: email, password_hash: hashedPassword, display_name: displayName }, allowedFields)

  if (!response.success) {
    console.error('Error registering teacher account: ' + response.error)
    return response
  }

  console.log("Teacher account " + username + " registered successfully.")
  
  return { success: true, code: 200, message: "Teacher account registered successfully" }
}

/*
Insert or update a question record. Calls upsertRecord with the correct parameters for
the questions table.
Arguments:
- fields: object containing question fields. Include question_id for updates, omit for inserts.

Returns:
- On success: { success: true, code: 200, action: "inserted" or "updated" }
- On client error (e.g. no valid fields): { success: false, error: "message", code: 400 }
- On not found (e.g. trying to update a question that doesn't exist): { success: false, error: "Question not found", code: 404 }
- On server error: { success: false, error: "message", code: 500 or 503 }
*/
function saveQuestion(fields) {

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


module.exports ={
  getDecks,
  getSessions,
  getDeckById,
  getSessionById,
  saveDeck,
  getExportForUnity,
  validateTeacherCredentials,
  registerTeacherAccount
};
