const { getRecords, getRecordsWithJoins, upsertRecord, updateRecord } = require('./dbQueries');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    const month = padZero(date.getUTCMonth() + 1);
    const day = padZero(date.getUTCDate());
    const hours = padZero(date.getUTCHours());
    const minutes = padZero(date.getUTCMinutes());
    const seconds = padZero(date.getUTCSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function convertFromMySQLUTC(mysqlDateStr) {
    var t = mysqlDateStr.split(/[- :]/)
    var d = new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]))
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
// RETRIEVAL FUNCTIONS
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
        const response2 = await updateRecord(
            'teachers',
            { last_login: formatToMySQLUTC(new Date()) },
            { teacher_id: response.data[0].teacher_id },
            ['last_login'],
            ['teacher_id']
        )
        return { success: true, id: response.data[0].teacher_id, code: 200, message: "Credentials valid" }
    }

    console.log('Invalid credentials for username: ' + username)
    return { success: false, error: "Invalid username or password", code: 401 }
}

async function getDecks(teacher_id) {
    console.log("getDecks called with teacher_id:", teacher_id);
    const allowedFields = ['deck_id', 'deck_name', 'number_of_questions', 'description', 'subject_tag']
    const allowedConditionFields = ['owner_id']
    const response = await getRecords('decks', allowedFields, { owner_id: teacher_id }, allowedConditionFields)
    console.log("getDecks response:", JSON.stringify(response));

    if (!response.success) {
        console.error('Error fetching decks:', response.error)
        return { success: false, error: response.error, code: response.code }
    }

    return { success: true, code: 200, data: response.data }
}

async function getSessions(teacher_id) {
    const allowedFields = ['session_id', 'game_sessions.deck_id', 'deck_name', 'date_played', 'rounds_played',
                          'average_accuracy', 'average_response_time_ms', 'ai_summary_text']
    const allowedConditionFields = ['owner_id']
    const joinClauses = [
        { type: "INNER", table: "decks", on: "game_sessions.deck_id = decks.deck_id" }
    ]
    const response = await getRecordsWithJoins('game_sessions', allowedFields, { owner_id: teacher_id }, allowedConditionFields, joinClauses)

    if (!response.success) {
        console.error('Error fetching sessions:', response.error)
        return { success: false, error: response.error, code: response.code }
    }

    return { success: true, code: 200, data: response.data }
}

async function getDeckById(deckID, teacher_id) {
    const allowedFields = ['deck_id', 'deck_name', 'number_of_questions', 'description', 'subject_tag']
    const allowedConditionFields = ['deck_id', 'owner_id']
    const deckResponse = await getRecords('decks', allowedFields, { deck_id: deckID, owner_id: teacher_id }, allowedConditionFields)

    if (!deckResponse.success) {
        console.error('Error fetching deck:', deckResponse.error)
        return { success: false, error: deckResponse.error, code: deckResponse.code }
    }

    const foundDeckID = deckResponse.data[0].deck_id

    const allowedQuestionFields = ['question_id', 'question_text', 'question_type', 'correct_answer', 'answer_options']
    const allowedQuestionConditionFields = ['deck_id']
    const questionResponse = await getRecords('questions', allowedQuestionFields, { deck_id: foundDeckID }, allowedQuestionConditionFields)

    if (!questionResponse.success) {
        console.error('Error fetching questions for deck:', questionResponse.error)
        return { success: false, error: questionResponse.error, code: questionResponse.code }
    }

    return { success: true, code: 200, data: { deck: deckResponse.data[0], questions: questionResponse.data } }
}

async function getSessionById(sessionID) {
    const response = await getRecordsWithJoins(
        'game_sessions',
        ['session_id', 'game_sessions.deck_id', 'deck_name', 'date_played',
         'rounds_played', 'average_accuracy', 'average_response_time_ms', 'ai_summary_text'],
        { session_id: sessionID },
        ['session_id'],
        [{ type: "INNER", table: "decks", on: "game_sessions.deck_id = decks.deck_id" }]
    );

    if (!response.success || !response.data.length) {
        return null;
    }

    return response.data[0];
}

// ============================================================
// SAVE/UPDATE FUNCTIONS
// ============================================================

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

async function saveQuestion(fields) {
    const allowedFields = ['question_id', 'deck_id', 'question_text', 'question_type', 'correct_answer', 'answer_options']
    const response = await upsertRecord('questions', fields, allowedFields)

    if (!response.success) {
        console.error('Error saving question:', response.error)
        return response
    }

    return response
}

async function saveDeck(infoPackage) {
    // First save the deck metadata
    const allowedDeckFields = ['deck_id', 'owner_id', 'deck_name', 'description', 'subject_tag', 'number_of_questions', 'is_public']
    const deckResponse = await upsertRecord('decks', infoPackage, allowedDeckFields)
    console.log("deckResponse:", JSON.stringify(deckResponse))

    if (!deckResponse.success) {
        console.error('Error saving deck:', deckResponse.error)
        return deckResponse
    }

    // Get the deck ID — either from the insert or from the original package
    const deckId = deckResponse.insertID || infoPackage.deck_id

    // If math deck, save parameters to math_decks table
    if (infoPackage.subject_tag === 'math') {
        const allowedMathFields = ['deck_id', 'operations', 'lowest_number', 'highest_number', 'number_of_operands', 'subject_tag']
        const mathResponse = await upsertRecord('math_decks', infoPackage.questions[0], allowedMathFields)
        if (!mathResponse.success) {
            console.error('Error saving math deck parameters:', mathResponse.error)
            return mathResponse
        }
        return { success: true, code: 200, message: "Math deck saved successfully", insertID: deckId }
    }

    // Save regular questions
    const questions = infoPackage.questions || []
    const questionResponses = []

    for (const question of questions) {
        question.deck_id = deckId
        const questionResponse = await saveQuestion(question)
        questionResponses.push(questionResponse)
    }

    if (questionResponses.some(res => !res.success)) {
        console.error('Error saving one or more questions:', questionResponses.filter(res => !res.success).map(res => res.error))
        return { success: false, error: "Error saving one or more questions", code: 500 }
    }

    return { success: true, code: 200, message: "Deck and questions saved successfully", insertID: deckId }
}

async function getSessionSummaryFromAI(sessionID) {
    // Fetch session + deck name
    const sessionResponse = await getRecordsWithJoins(
        'game_sessions',
        ['session_id', 'game_sessions.deck_id', 'deck_name', 'date_played',
         'rounds_played', 'average_accuracy', 'average_response_time_ms', 'ai_summary_text'],
        { session_id: sessionID },
        ['session_id'],
        [{ type: "INNER", table: "decks", on: "game_sessions.deck_id = decks.deck_id" }]
    );

    if (!sessionResponse.success || !sessionResponse.data.length) {
        return { success: false, code: 404, error: "Session not found." };
    }

    const session = sessionResponse.data[0];

    // Return cached summary if it already exists — no API call needed
    if (session.ai_summary_text) {
        return { success: true, summary: session.ai_summary_text };
    }

    // Fetch per-player stats from session_summaries
    const playerResponse = await getRecords(
        'session_summaries',
        ['player_name', 'final_score', 'final_rank', 'accuracy_pct',
         'longest_streak', 'questions_answered', 'questions_correct'],
        { session_id: sessionID },
        ['session_id']
    );

    const players = playerResponse.success ? playerResponse.data : [];

    // Build player breakdown for the prompt
    const playerLines = players.length
        ? players
            .sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99))
            .map(p =>
                `  - ${p.player_name} (Rank #${p.final_rank ?? "?"}): ` +
                `score ${p.final_score ?? "?"}, ` +
                `${p.questions_correct ?? "?"}/${p.questions_answered ?? "?"} correct, ` +
                `longest streak ${p.longest_streak ?? 0}`
            )
            .join("\n")
        : "  No player data available.";

    const prompt = `
        You are summarizing a classroom quiz game session for a teacher.

        Deck: "${session.deck_name}"
        Date played: ${session.date_played}
        Rounds played: ${session.rounds_played ?? "unknown"}
        Average accuracy: ${session.average_accuracy != null ? session.average_accuracy + "%" : "unknown"}
        Average response time: ${session.average_response_time_ms != null ? session.average_response_time_ms + "ms" : "unknown"}

        Player results:
        ${playerLines}

        Write a friendly 2-3 sentence summary of how the session went.
        Call out the top performer by name, mention overall accuracy, and flag anything students may need to review.
        Keep it encouraging and concise for the teacher.
            `.trim();


    // Replace the try block inside getSessionSummaryFromAI
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent(prompt);
        const summaryText = result.response.text();

        await saveSessionSummary(sessionID, summaryText);
        return { success: true, summary: summaryText };

    } catch (error) {
        console.error("Gemini API call failed.", error);
        return { success: false, code: 500, error: "AI summary generation failed." };
    }
}

async function saveSessionSummary(sessionID, summaryText) {
    const response = await updateRecord(
        'game_sessions',
        { ai_summary_text: summaryText },
        { session_id: sessionID },
        ['ai_summary_text'],
        ['session_id']
    );

    if (!response.success) {
        console.error('Error saving AI summary to DB:', response.error);
    }

    return response;
}

async function saveSession(payload) {
    // 1. Insert the main session row into game_sessions
    const sessionFields = {
        host_teacher_id: payload.teacher_id,
        deck_id: payload.deck_id,
        date_played: payload.date_played
            ? formatToMySQLUTC(new Date(payload.date_played))
            : formatToMySQLUTC(new Date()),
        player_count: payload.player_count || 0,
        rounds_played: payload.rounds_played || 0,
        average_accuracy: computeAverageAccuracy(payload.player_data),
        average_response_time_ms: computeAverageResponseTime(payload.question_data),
        unity_data_json: JSON.stringify(payload)
    };

    const allowedSessionFields = [
        'host_teacher_id', 'deck_id', 'date_played', 'player_count',
        'rounds_played', 'average_accuracy', 'average_response_time_ms', 'unity_data_json'
    ];

    const sessionResponse = await upsertRecord('game_sessions', sessionFields, allowedSessionFields);

    if (!sessionResponse.success) {
        console.error('Error saving session:', sessionResponse.error);
        return { success: false, error: sessionResponse.error, code: 500 };
    }

    const sessionId = sessionResponse.insertID;

    // 2. Insert one row per player into session_summaries
    const players = Array.isArray(payload.player_data) ? payload.player_data : [];

    for (const player of players) {
        const answered = player.questions_answered || 0;
        const correct = player.questions_correct || 0;
        const accuracyPct = answered > 0
            ? parseFloat(((correct / answered) * 100).toFixed(2))
            : 0;

        const summaryFields = {
            session_id: sessionId,
            player_name: player.player_name || 'Unknown Player',
            final_score: player.final_score || 0,
            final_rank: player.final_rank || null,
            accuracy_pct: accuracyPct,
            longest_streak: player.longest_streak || 0,
            questions_answered: answered,
            questions_correct: correct
        };

        const allowedSummaryFields = [
            'session_id', 'player_name', 'final_score', 'final_rank',
            'accuracy_pct', 'longest_streak', 'questions_answered', 'questions_correct'
        ];

        const summaryResponse = await upsertRecord('session_summaries', summaryFields, allowedSummaryFields);

        if (!summaryResponse.success) {
            console.error(`Error saving summary for player ${player.player_name}:`, summaryResponse.error);
        }
    }

    return { success: true, code: 200, sessionId };
}

// Averages accuracy across all players
function computeAverageAccuracy(playerData) {
    if (!Array.isArray(playerData) || playerData.length === 0) return null;
    const total = playerData.reduce((sum, p) => {
        const answered = p.questions_answered || 0;
        const correct = p.questions_correct || 0;
        return sum + (answered > 0 ? (correct / answered) * 100 : 0);
    }, 0);
    return parseFloat((total / playerData.length).toFixed(2));
}

// Averages response time across all question responses
function computeAverageResponseTime(questionData) {
    if (!Array.isArray(questionData) || questionData.length === 0) return null;
    const times = [];
    for (const q of questionData) {
        for (const r of (q.player_responses || [])) {
            if (r.response_time != null) times.push(r.response_time);
        }
    }
    if (times.length === 0) return null;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

module.exports = {
    getDecks,
    getSessions,
    getDeckById,
    getSessionById,
    saveDeck,
    saveSession,          
    validateTeacherCredentials,
    registerTeacherAccount,
    getSessionSummaryFromAI,
    saveSessionSummary
};