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

function getSessionById(sessionID) {
    return Promise.resolve(null);
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

module.exports = {
    getDecks,
    getSessions,
    getDeckById,
    getSessionById,
    saveDeck,
    validateTeacherCredentials,
    registerTeacherAccount
};