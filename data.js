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
const mockDecks = [
  {
    id: 1,
    title: "Basic Math",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "What is 5 + 7?",          optionA: "12",  optionB: "10",  optionC: "15",  optionD: "14",  correctAnswer: "A" },
        { questionText: "What is 12 × 3?",          optionA: "30",  optionB: "36",  optionC: "42",  optionD: "24",  correctAnswer: "B" },
        { questionText: "What is 100 ÷ 4?",         optionA: "20",  optionB: "25",  optionC: "50",  optionD: "10",  correctAnswer: "B" },
        { questionText: "What is 9 × 9?",           optionA: "72",  optionB: "81",  optionC: "90",  optionD: "63",  correctAnswer: "B" },
        { questionText: "What is 144 ÷ 12?",        optionA: "10",  optionB: "14",  optionC: "12",  optionD: "11",  correctAnswer: "C" },
        { questionText: "What is 15 + 27?",         optionA: "40",  optionB: "42",  optionC: "44",  optionD: "38",  correctAnswer: "B" },
        { questionText: "What is 8 × 7?",           optionA: "54",  optionB: "56",  optionC: "64",  optionD: "48",  correctAnswer: "B" },
        { questionText: "What is 200 - 85?",        optionA: "105", optionB: "125", optionC: "115", optionD: "115", correctAnswer: "C" },
        { questionText: "What is 6²?",              optionA: "12",  optionB: "36",  optionC: "18",  optionD: "30",  correctAnswer: "B" },
        { questionText: "What is 50% of 80?",       optionA: "30",  optionB: "45",  optionC: "40",  optionD: "35",  correctAnswer: "C" },
        { questionText: "What is 3 × 3 × 3?",       optionA: "9",   optionB: "27",  optionC: "18",  optionD: "21",  correctAnswer: "B" },
        { questionText: "What is 1000 ÷ 25?",       optionA: "50",  optionB: "45",  optionC: "40",  optionD: "35",  correctAnswer: "C" },
        { questionText: "What is 17 + 38?",         optionA: "54",  optionB: "55",  optionC: "56",  optionD: "57",  correctAnswer: "B" },
        { questionText: "What is 11 × 11?",         optionA: "111", optionB: "112", optionC: "121", optionD: "131", correctAnswer: "C" },
        { questionText: "What is 72 ÷ 8?",          optionA: "8",   optionB: "7",   optionC: "9",   optionD: "6",   correctAnswer: "C" },
        { questionText: "What is 25% of 200?",      optionA: "40",  optionB: "50",  optionC: "60",  optionD: "25",  correctAnswer: "B" },
        { questionText: "What is 4³?",              optionA: "12",  optionB: "48",  optionC: "64",  optionD: "32",  correctAnswer: "C" },
        { questionText: "What is 99 + 101?",        optionA: "190", optionB: "200", optionC: "210", optionD: "199", correctAnswer: "B" },
        { questionText: "What is 13 × 4?",          optionA: "48",  optionB: "52",  optionC: "56",  optionD: "44",  correctAnswer: "B" },
        { questionText: "What is 500 ÷ 20?",        optionA: "20",  optionB: "30",  optionC: "25",  optionD: "15",  correctAnswer: "C" }
      ]
    })
  },
  {
    id: 2,
    title: "US History 101",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "In what year did the US declare independence?",           optionA: "1776", optionB: "1783", optionC: "1765", optionD: "1812", correctAnswer: "A" },
        { questionText: "Who was the first US president?",                          optionA: "Adams", optionB: "Jefferson", optionC: "Washington", optionD: "Lincoln", correctAnswer: "C" },
        { questionText: "What document ended the Civil War?",                       optionA: "Treaty of Paris", optionB: "Emancipation Proclamation", optionC: "Appomattox surrender", optionD: "13th Amendment", correctAnswer: "C" },
        { questionText: "Which war was fought from 1950 to 1953?",                  optionA: "Vietnam War", optionB: "Korean War", optionC: "Gulf War", optionD: "WWI", correctAnswer: "B" },
        { questionText: "What year did women gain the right to vote in the US?",    optionA: "1915", optionB: "1920", optionC: "1925", optionD: "1930", correctAnswer: "B" }
      ]
    })
  },
  {
    id: 3,
    title: "Science: Solar System",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "Which planet is closest to the Sun?",        optionA: "Venus",   optionB: "Earth",   optionC: "Mercury", optionD: "Mars",    correctAnswer: "C" },
        { questionText: "How many moons does Mars have?",             optionA: "0",       optionB: "1",       optionC: "2",       optionD: "4",       correctAnswer: "C" },
        { questionText: "What is the largest planet in our system?",  optionA: "Saturn",  optionB: "Neptune", optionC: "Uranus",  optionD: "Jupiter", correctAnswer: "D" },
        { questionText: "Which planet has a Great Red Spot?",         optionA: "Mars",    optionB: "Jupiter", optionC: "Saturn",  optionD: "Uranus",  correctAnswer: "B" },
        { questionText: "What is the name of Earth's moon?",          optionA: "Titan",   optionB: "Europa",  optionC: "Luna",    optionD: "Io",      correctAnswer: "C" }
      ]
    })
  },
  {
    id: 4,
    title: "English Vocabulary",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "What does 'benevolent' mean?",    optionA: "Evil",       optionB: "Kind",       optionC: "Clever",    optionD: "Sad",      correctAnswer: "B" },
        { questionText: "What is a synonym for 'happy'?",  optionA: "Melancholy", optionB: "Elated",     optionC: "Anxious",   optionD: "Tired",    correctAnswer: "B" },
        { questionText: "What does 'verbose' mean?",       optionA: "Silent",     optionB: "Concise",    optionC: "Wordy",     optionD: "Angry",    correctAnswer: "C" },
        { questionText: "What is an antonym for 'ancient'?", optionA: "Old",      optionB: "Modern",     optionC: "Historic",  optionD: "Ruined",   correctAnswer: "B" },
        { questionText: "What does 'ambiguous' mean?",     optionA: "Clear",      optionB: "Uncertain",  optionC: "Definite",  optionD: "Simple",   correctAnswer: "B" }
      ]
    })
  },
  {
    id: 5,
    title: "World Geography",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "What is the capital of France?",         optionA: "Berlin",   optionB: "Madrid",  optionC: "Paris",   optionD: "Rome",    correctAnswer: "C" },
        { questionText: "Which country has the most land area?",   optionA: "China",    optionB: "Canada",  optionC: "USA",     optionD: "Russia",  correctAnswer: "D" },
        { questionText: "What is the longest river in the world?", optionA: "Amazon",   optionB: "Nile",    optionC: "Niger",   optionD: "Congo",   correctAnswer: "B" },
        { questionText: "On which continent is Egypt?",            optionA: "Asia",     optionB: "Europe",  optionC: "Africa",  optionD: "America", correctAnswer: "C" },
        { questionText: "What ocean is the largest?",              optionA: "Atlantic", optionB: "Arctic",  optionC: "Indian",  optionD: "Pacific", correctAnswer: "D" }
      ]
    })
  },
  {
    id: 6,
    title: "Biology Basics",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "What is the powerhouse of the cell?",          optionA: "Nucleus",      optionB: "Ribosome",    optionC: "Mitochondria", optionD: "Vacuole",   correctAnswer: "C" },
        { questionText: "How many chromosomes do humans have?",          optionA: "23",           optionB: "46",          optionC: "48",           optionD: "44",        correctAnswer: "B" },
        { questionText: "What molecule carries genetic information?",    optionA: "RNA",          optionB: "ATP",         optionC: "DNA",          optionD: "Protein",   correctAnswer: "C" },
        { questionText: "What process do plants use to make food?",      optionA: "Respiration",  optionB: "Digestion",   optionC: "Photosynthesis",optionD: "Osmosis",   correctAnswer: "C" },
        { questionText: "What is the basic unit of life?",               optionA: "Atom",         optionB: "Organ",       optionC: "Tissue",       optionD: "Cell",      correctAnswer: "D" }
      ]
    })
  },
  {
    id: 7,
    title: "Pop Culture Trivia",
    contentJson: JSON.stringify({
      questions: [
        { questionText: "Who sang 'Shake It Off'?",                  optionA: "Beyoncé",      optionB: "Taylor Swift", optionC: "Rihanna",  optionD: "Adele",       correctAnswer: "B" },
        { questionText: "What studio makes the Marvel films?",        optionA: "Warner Bros",  optionB: "Sony",         optionC: "Disney",   optionD: "Universal",   correctAnswer: "C" },
        { questionText: "Which game uses 'Battle Royale' mode?",      optionA: "Minecraft",    optionB: "Fortnite",     optionC: "Roblox",   optionD: "Overwatch",   correctAnswer: "B" },
        { questionText: "What color is Pikachu?",                     optionA: "Blue",         optionB: "Red",          optionC: "Yellow",   optionD: "Green",       correctAnswer: "C" },
        { questionText: "How many Harry Potter main books are there?", optionA: "6",            optionB: "8",            optionC: "7",        optionD: "5",           correctAnswer: "C" }
      ]
    })
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
    metrics: { roundsPlayed: 8,  averageAccuracy: "86%", averageResponseTime: "5.4s" }
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
    metrics: { roundsPlayed: 10, averageAccuracy: "79%", averageResponseTime: "6.2s" }
  },
  {
    id: 103,
    deckId: 3,
    deckTitle: "Science: Solar System",
    createdAt: "2026-02-05 10:00",
    summaryParagraphs: [
      "Students demonstrated strong recall on planets closer to the Sun but struggled with outer planet details.",
      "Moon and satellite questions produced the most discussion, likely because multiple answers seemed plausible.",
      "Overall performance suggests a brief review of gas giants before the next session would be beneficial."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "72%", averageResponseTime: "7.1s" }
  },
  {
    id: 104,
    deckId: 4,
    deckTitle: "English Vocabulary",
    createdAt: "2026-02-06 11:30",
    summaryParagraphs: [
      "Vocabulary retention was high for commonly used words but dropped off for academic terms.",
      "Students who engaged with context clues before answering scored noticeably higher.",
      "Recommend revisiting antonym and synonym pairings in the next vocabulary session."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "81%", averageResponseTime: "5.9s" }
  },
  {
    id: 105,
    deckId: 5,
    deckTitle: "World Geography",
    createdAt: "2026-02-10 09:45",
    summaryParagraphs: [
      "Capital city questions were answered quickly and confidently by most of the group.",
      "River and ocean size questions caused hesitation, with many students choosing between two plausible options.",
      "Consider adding a map visual aid before the next round to reinforce spatial memory."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "77%", averageResponseTime: "6.8s" }
  },
  {
    id: 106,
    deckId: 1,
    deckTitle: "Basic Math",
    createdAt: "2026-02-12 14:15",
    summaryParagraphs: [
      "This repeat session showed measurable improvement over the first Math Warmup run.",
      "Students answered multiplication and division questions nearly two seconds faster on average.",
      "The class is ready to progress to fractions and percentage-based word problems."
    ],
    metrics: { roundsPlayed: 12, averageAccuracy: "91%", averageResponseTime: "4.2s" }
  },
  {
    id: 107,
    deckId: 6,
    deckTitle: "Biology Basics",
    createdAt: "2026-02-14 08:50",
    summaryParagraphs: [
      "Cell structure questions were answered with high accuracy, reflecting strong prior knowledge.",
      "The photosynthesis and respiration distinction caused the most errors across the group.",
      "Students would benefit from a diagram-based review activity before covering cellular respiration."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "84%", averageResponseTime: "5.6s" }
  },
  {
    id: 108,
    deckId: 7,
    deckTitle: "Pop Culture Trivia",
    createdAt: "2026-02-17 13:00",
    summaryParagraphs: [
      "Engagement was exceptionally high throughout the session, with near-instant response times on music questions.",
      "Gaming-related prompts saw the widest spread of answers, suggesting varied familiarity across the class.",
      "This session is great for building classroom rapport — consider using it as a warm-up activity."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "88%", averageResponseTime: "3.8s" }
  },
  {
    id: 109,
    deckId: 2,
    deckTitle: "US History 101",
    createdAt: "2026-02-19 10:20",
    summaryParagraphs: [
      "Second run on US History showed meaningful improvement in Civil War and suffrage questions.",
      "Students still struggled with exact dates, suggesting memorization drills or mnemonics could help.",
      "Overall the class is trending upward in history comprehension based on both sessions."
    ],
    metrics: { roundsPlayed: 10, averageAccuracy: "85%", averageResponseTime: "5.5s" }
  },
  {
    id: 110,
    deckId: 3,
    deckTitle: "Science: Solar System",
    createdAt: "2026-02-21 09:00",
    summaryParagraphs: [
      "A significant accuracy increase from session 103 confirms that the review activity was effective.",
      "Students now correctly identify gas giants with confidence and respond faster on moon count questions.",
      "Ready to advance to topics such as star classification and the life cycle of stars."
    ],
    metrics: { roundsPlayed: 5,  averageAccuracy: "93%", averageResponseTime: "4.5s" }
  }
];

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
Retrieve all available question decks.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM Decks
*/
async function getDecks() {
  return mockDecks;
}

/*
Retrieve all historical session data.
Returns a Promise to simulate asynchronous database latency.
This function must be refactored to execute: SELECT * FROM Sessions
*/
async function getSessions() {
  return mockSessions;
}

/*
Retrieve a specific deck object by its primary key.
This function must be refactored to execute: SELECT * FROM Decks WHERE deckId = ?
*/
function getDeckById(deckId) {
  return Promise.resolve((() => {
    for (let i = 0; i < mockDecks.length; i += 1) {
      const deck = mockDecks[i];
      if (deck.id === deckId) {
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
function getNextDeckId() {
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
      id: getNextDeckId(),
      title,
      contentJson
    };

    mockDecks.push(newDeck);
    return newDeck;
  })());
}

/*
Retrieve a specific session object by its primary key.
This function must be refactored to execute: SELECT * FROM Sessions WHERE sessionId = ?
*/
function getSessionById(sessionId) {
  return Promise.resolve((() => {
    for (let i = 0; i < mockSessions.length; i += 1) {
      const session = mockSessions[i];
      if (session.id === sessionId) {
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
