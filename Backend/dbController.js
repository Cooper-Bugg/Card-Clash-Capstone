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

//Be sure to include dbConnect.js in I think this file...

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
Retrieve all available question decks.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM decks
// TODO after demo: switch data routes from data.js to database.js — replace with database.getDecks()
*/
async function getDecks() {
  /*
  SELECT *
  FROM decks
  WHERE owner_id = ?;
  */
  return mockDecks;
}

/*
Retrieve all historical session data.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM game_sessions
// TODO after demo: switch data routes from data.js to database.js — replace with database.getSessions()
*/
async function getSessions() {
  /*
  SELECT *
  FROM game_sessions
  WHERE teacher_id =?;
  */
  return mockSessions;
}

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
Calculate the next sequential primary key.
This function will be deprecated when the database schema implements AUTO_INCREMENT.
*/
function getNextDeckID() {
  let maxId = 0;
  for (let i = 0; i < mockDecks.length; i += 1) {
    maxId = Math.max(maxId, mockDecks[i].id);
  }

  return maxId + 1;
}

/*
Insert or update a deck record.
Data is currently stored in volatile memory and drops on server termination.
This function must be refactored to execute INSERT or UPDATE statements.
// TODO after demo: switch data routes from data.js to database.js — replace with database.saveDeck({ id, title, contentJson })
*/
function saveDeck({ id, title, contentJson }) {
  return Promise.resolve((() => {
    const parsedId = Number.parseInt(id, 10);
    const hasValidId = Number.isInteger(parsedId) && parsedId > 0;

    if (hasValidId) {
      const existing = mockDecks.find((d) => d.id === parsedId) || null;
      if (existing) {
        existing.title = title;
        existing.contentJson = contentJson;
        return existing;
      }
    }

    const newDeck = {
      id: getNextDeckID(),
      title,
      contentJson
    };

    mockDecks.push(newDeck);
    return newDeck;
  })());
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

module.exports = {
  getDecks,
  getSessions,
  getDeckById,
  getSessionById,
  saveDeck
};
