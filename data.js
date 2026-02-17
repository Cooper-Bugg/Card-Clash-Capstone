/*
Fake data for testing the cards and decks right now.
Eventually this will be replaced with real MySQL queries
that talk to the actual database instead of hardcoded data.
*/
const mockDecks = [
  {
    id: 1,
    title: "Math Warmup",
    contentJson:
      "{\"questions\":[{\"prompt\":\"3 + 4\",\"answers\":[\"7\",\"8\",\"6\"],\"correctIndex\":0}]}"
  },
  {
    id: 2,
    title: "US History 101",
    contentJson:
      "{\"questions\":[{\"prompt\":\"Year of the Declaration\",\"answers\":[\"1776\",\"1812\",\"1865\"],\"correctIndex\":0}]}"
  },
  {
    id: 3,
    title: "Science Starter",
    contentJson:
      "{\"questions\":[{\"prompt\":\"H2O is\",\"answers\":[\"Water\",\"Oxygen\",\"Hydrogen\"],\"correctIndex\":0}]}"
  }
];

/*
More fake data for testing the sessions and reports
*/
const mockSessions = [
  {
    id: 101,
    deckId: 1,
    deckTitle: "Math Warmup",
    createdAt: "2026-02-03 09:12",
    summaryParagraphs: [
      "Students started the session with strong pace control and quick recall on arithmetic prompts.",
      "Accuracy remained steady across the middle rounds, with a few learners improving response time after each reveal.",
      "The session ended with consistent participation, which indicates readiness for more complex mixed operations."
    ],
    metrics: {
      roundsPlayed: 8,
      averageAccuracy: "86%",
      averageResponseTime: "5.4s"
    }
  },
  {
    id: 102,
    deckId: 2,
    deckTitle: "US History 101",
    createdAt: "2026-02-04 13:40",
    summaryParagraphs: [
      "Learners showed high engagement during early prompts and frequently discussed answer choices before submission.",
      "The group demonstrated stronger knowledge of foundational dates than mid century events, which suggests a review opportunity.",
      "Final rounds showed improved consensus, which indicates the hints and explanations supported retention."
    ],
    metrics: {
      roundsPlayed: 10,
      averageAccuracy: "79%",
      averageResponseTime: "6.2s"
    }
  }
];

/*
Gets all the decks to show on the dashboard and deck builder.
Right now it returns the fake data, but when the database is hooked up
this will query MySQL instead. Keeps the route handlers clean.
*/
function getDecks() {
  return mockDecks;
}

/*
Gets all the past game sessions for the dashboard and report pages.
Right now it returns fake data, but when MySQL is connected
this will query the database. Keeps the route handlers simple.
*/
function getSessions() {
  return mockSessions;
}

/*
Looks up a specific deck by its id.
Useful for loading a deck when you click to play or edit.
When MySQL is connected this will do a database query
instead of searching through fake data.
*/
function getDeckById(deckId) {
  for (let i = 0; i < mockDecks.length; i += 1) {
    const deck = mockDecks[i];
    if (deck.id === deckId) {
      return deck;
    }
  }

  return null;
}

/*
Finds the next available deck id.
We keep it simple by picking one higher than the current max id.
*/
function getNextDeckId() {
  let maxId = 0;
  for (let i = 0; i < mockDecks.length; i += 1) {
    maxId = Math.max(maxId, mockDecks[i].id);
  }

  return maxId + 1;
}

/*
Adds or updates a deck in memory.
This lets us save without a database, but it resets on server restart.
When we switch to SQL, this is the function that becomes the insert/update query.
*/
function saveDeck({ id, title, contentJson }) {
  const parsedId = Number.parseInt(id, 10);
  const hasValidId = Number.isInteger(parsedId) && parsedId > 0;

  if (hasValidId) {
    const existing = getDeckById(parsedId);
    if (existing) {
      existing.title = title;
      existing.contentJson = contentJson;
      return existing;
    }
  }

  const newDeck = {
    id: getNextDeckId(),
    title,
    contentJson
  };

  mockDecks.push(newDeck);
  return newDeck;
}

/*
Looks up a specific game session by its id.
Used on the report page to show details about one game.
When MySQL is connected this will query the database
instead of searching through fake data.
*/
function getSessionById(sessionId) {
  for (let i = 0; i < mockSessions.length; i += 1) {
    const session = mockSessions[i];
    if (session.id === sessionId) {
      return session;
    }
  }

  return null;
}

module.exports = {
  getDecks,
  getSessions,
  getDeckById,
  getSessionById,
  saveDeck
};
