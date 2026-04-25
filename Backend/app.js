/*
This is the main server file that runs Card Clash.
It uses Express to handle routes, render the page templates
and serve the game files. It also runs HTTPS locally using a self-signed
certificate so Unity WebGL Brotli-compressed assets can load correctly.
Browsers require HTTPS to decode Brotli content encoding.
*/
const path = require("path");
const fs = require("fs");
const https = require("https");
const express = require("express");
const expressSession = require("express-session");
const selfsigned = require("selfsigned");
const dataStore = require("./dbController");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = express();
app.set('trust proxy', 1);


function getRuntimeMode() {
    const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
    const modeFromArg = modeArg ? modeArg.split("=")[1] : "";
    const mode = process.env.RUN_MODE || modeFromArg;
    return mode === "server" ? "server" : "local";
}

const runtimeMode = getRuntimeMode();
const port = Number.parseInt(process.env.PORT || "3000", 10);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../Frontend/views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((err, req, res, next) => {
    if (!err || !req.path.startsWith("/api/")) {
        next(err);
        return;
    }
    if (err.type === "entity.parse.failed") {
        res.status(400).json({ error: "Malformed JSON in request body.", code: "BAD_JSON" });
        return;
    }
    if (err.type === "entity.too.large") {
        res.status(413).json({ error: "Request body is too large.", code: "PAYLOAD_TOO_LARGE" });
        return;
    }
    next(err);
});

/*
Brotli middleware: Unity WebGL exports compressed .br files.
Browsers need Content-Encoding: br and the correct MIME type
to decode them. This middleware sets those headers before Express
serves the file so the game loads correctly.
HTTPS is required for Brotli to work in most browsers.
*/
function attachBrotliHeaders(req, res, next) {
    if (!req.path.endsWith(".br")) {
        next();
        return;
    }
    res.setHeader("Content-Encoding", "br");
    res.setHeader("Vary", "Accept-Encoding");
    if (req.path.endsWith(".wasm.br")) {
        res.type("application/wasm");
    } else if (req.path.endsWith(".js.br")) {
        res.type("application/javascript");
    } else if (req.path.endsWith(".data.br")) {
        res.type("application/octet-stream");
    }
    next();
}

app.use(attachBrotliHeaders);
app.use(express.static(path.join(__dirname, "../Frontend/public")));

/*
Session middleware so the server can remember who is logged in.
SESSION_SECRET must be set in a .env file before going to production.
resave: false means we only save sessions that actually changed.
saveUninitialized: false means we don't create a session until someone logs in.
httpOnly: true prevents JavaScript from reading the session cookie.
sameSite: 'lax' reduces CSRF exposure for same-origin navigation.
secure is enabled automatically when the server runs over HTTPS.
*/
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.SESSION_SECRET) {
    console.error("FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production.");
    process.exit(1);
}

app.use(expressSession({
    secret: process.env.SESSION_SECRET || "card_clash_dev_secret_do_not_use_in_production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction
    }
}));

/*
Blocks access to teacher-only routes.
If the session shows isAuthenticated is true we let them through,
otherwise we redirect them to the login page.
*/
function requireTeacherAuthentication(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        next();
    } else {
        res.redirect("/login");
    }
}

function formatSessionDate(rawDate) {
    if (!rawDate) return "Unknown date";
    return rawDate;
}

/*
Gathers all the deck and session data for the dashboard.
Pulls from the data store (async so it will work when MySQL replaces mock data),
counts the questions in each deck, and formats everything for the dashboard view.
*/
async function buildDashboardViewModel(teacherID) {
    const decksResponse = await dataStore.getDecks(teacherID);
    const sessionsResponse = await dataStore.getSessions(teacherID);

    const decks = [];
    const sessions = [];

    if (!decksResponse.success) {
        console.error("Error fetching decks for dashboard:", decksResponse.error);
    } else {
        for (let i = 0; i < decksResponse.data.length; i += 1) {
            const deck = decksResponse.data[i];
            decks.push({
                id: deck.deck_id,
                title: deck.deck_name,
                questionCount: deck.number_of_questions || 0
            });
        }
    }

    if (!sessionsResponse.success) {
        console.error("Error fetching sessions for dashboard:", sessionsResponse.error);
    } else {
        for (let i = 0; i < sessionsResponse.data.length; i += 1) {
            const session = sessionsResponse.data[i];
            sessions.push({
                id: session.session_id,
                deckTitle: session.deck_name || "Untitled Deck",
                createdAt: formatSessionDate(session.date_played),
                summaryPreview: session.ai_summary_text,
                metrics: {
                    roundsPlayed: session.rounds_played,
                    averageAccuracy: session.average_accuracy,
                    averageResponseTime: session.average_response_time_ms
                }
            });
        }
    }

    return { decks, sessions };
}

function sendServerError(res, message) {
    res.status(500).send(message);
}

function toPositiveInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanFlag(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1";
    }
    return false;
}

function mapQuestionTypeToUnity(questionType) {
    if (questionType === "TF") return "TF";
    if (questionType === "FB") return "FB";
    return "MC";
}

function normalizeUnitySessionPayload(rawPayload, teacherIdentity) {
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
        return { error: "Payload must be a JSON object." };
    }

    const deckID = toPositiveInteger(rawPayload.deck_id);
    if (!deckID) {
        return { error: "deck_id is required and must be a positive integer." };
    }

    const rawDate = rawPayload.date_played ? new Date(rawPayload.date_played) : new Date();
    const datePlayed = Number.isNaN(rawDate.getTime()) ? new Date().toISOString() : rawDate.toISOString();

    const incomingPlayers = Array.isArray(rawPayload.player_data) ? rawPayload.player_data : [];
    const incomingQuestions = Array.isArray(rawPayload.question_data) ? rawPayload.question_data : [];

    const playerStatsByName = new Map();
    const playerOrder = [];

    function ensurePlayer(name) {
        const normalizedName = String(name || "Unknown Player").trim() || "Unknown Player";
        if (!playerStatsByName.has(normalizedName)) {
            playerStatsByName.set(normalizedName, {
                player_name: normalizedName,
                final_score: 0,
                final_rank: null,
                questions_answered: 0,
                questions_correct: 0,
                longest_streak: 0,
                current_streak: 0
            });
            playerOrder.push(normalizedName);
        }
        return playerStatsByName.get(normalizedName);
    }

    for (let i = 0; i < incomingPlayers.length; i += 1) {
        const player = incomingPlayers[i] || {};
        const stats = ensurePlayer(player.player_name);
        const score = Number(player.final_score);
        const rank = toPositiveInteger(player.final_rank);
        stats.final_score = Number.isFinite(score) ? score : stats.final_score;
        stats.final_rank = rank || stats.final_rank;
    }

    const normalizedQuestions = [];

    for (let i = 0; i < incomingQuestions.length; i += 1) {
        const questionEntry = incomingQuestions[i] || {};
        const questionID = toPositiveInteger(questionEntry.question_id);
        if (!questionID) continue;

        const incomingResponses = Array.isArray(questionEntry.player_responses) ? questionEntry.player_responses : [];
        const normalizedResponses = [];
        let computedTimesSeen = 0;
        let computedTimesCorrect = 0;

        for (let j = 0; j < incomingResponses.length; j += 1) {
            const response = incomingResponses[j] || {};
            const playerName = String(response.player_name || "Unknown Player").trim() || "Unknown Player";
            const isCorrect = parseBooleanFlag(response.is_correct);
            const responseTime = Number(response.response_time);
            const stats = ensurePlayer(playerName);

            stats.questions_answered += 1;
            if (isCorrect) {
                stats.questions_correct += 1;
                stats.current_streak += 1;
                stats.longest_streak = Math.max(stats.longest_streak, stats.current_streak);
            } else {
                stats.current_streak = 0;
            }

            computedTimesSeen += 1;
            if (isCorrect) computedTimesCorrect += 1;

            normalizedResponses.push({
                player_name: playerName,
                answer_given: response.answer_given !== undefined ? response.answer_given : null,
                is_correct: isCorrect,
                response_time: Number.isFinite(responseTime) ? responseTime : null
            });
        }

        const incomingTimesSeen = Number(questionEntry.times_seen);
        const incomingTimesCorrect = Number(questionEntry.times_correct);

        normalizedQuestions.push({
            question_id: questionID,
            times_seen: Number.isFinite(incomingTimesSeen) ? incomingTimesSeen : computedTimesSeen,
            times_correct: Number.isFinite(incomingTimesCorrect) ? incomingTimesCorrect : computedTimesCorrect,
            player_responses: normalizedResponses
        });
    }

    const normalizedPlayers = playerOrder.map((playerName) => {
        const stats = playerStatsByName.get(playerName);
        return {
            player_name: stats.player_name,
            final_score: stats.final_score,
            final_rank: stats.final_rank,
            questions_answered: stats.questions_answered,
            questions_correct: stats.questions_correct,
            longest_streak: stats.longest_streak
        };
    });

    const playerCount = toPositiveInteger(rawPayload.player_count) || normalizedPlayers.length;
    const roundsPlayed = toPositiveInteger(rawPayload.rounds_played) || normalizedQuestions.length;

    return {
        teacher_id: teacherIdentity,
        deck_id: deckID,
        date_played: datePlayed,
        player_count: playerCount,
        rounds_played: roundsPlayed,
        player_data: normalizedPlayers,
        question_data: normalizedQuestions
    };
}

/*
Shows the teacher login page.
*/
async function renderLoginPage(req, res) {
    try {
        res.render("login", { pageTitle: "Teacher Login", errorMessage: null });
    } catch (error) {
        console.error("Login page render failed.", error);
        sendServerError(res, "Login page could not render.");
    }
}

/*
Shows the main dashboard with all the decks and past game sessions.
*/
async function renderDashboard(req, res) {
    console.log("teacherID from session:", req.session.teacherID);
    try {
        const viewModel = await buildDashboardViewModel(req.session.teacherID);
        res.render("dashboard", {
            pageTitle: "Dashboard",
            decks: viewModel.decks,
            sessions: viewModel.sessions
        });
    } catch (error) {
        console.error("Dashboard render failed.", error);
        sendServerError(res, "Dashboard could not render.");
    }
}

/*
Processes the login form.
*/
async function processAuthenticationRequest(req, res) {
    const submittedUsername = req.body.username;
    const submittedPassword = req.body.password;

    const result = await dataStore.validateTeacherCredentials(submittedUsername, submittedPassword);
    console.log(`Authentication result for username '${submittedUsername}': ${result.success ? "SUCCESS" : "FAILURE"}`);

    if (result.success) {
        req.session.isAuthenticated = true;
        req.session.teacherID = result.id;
        res.redirect("/dashboard");
    } else {
        res.status(401).render("login", {
            pageTitle: "Teacher Login",
            errorMessage: "Invalid username or password."
        });
    }
}

/*
Destroys the active session and sends the teacher back to the login page.
*/
function processLogoutRequest(req, res) {
    req.session.destroy(() => {
        res.redirect("/login");
    });
}

/*
Shows the game window with the Unity frame.
*/
async function renderGame(req, res) {
    try {
        const deckID = Number.parseInt(req.query.deckID, 10);
        const deckResponse = Number.isNaN(deckID) ? null : await dataStore.getDeckById(deckID, req.session.teacherID);

        if (!deckResponse || !deckResponse.success) {
            res.status(404).send("No deck found. Please create a deck first.");
            return;
        }

        const deck = {
            id: deckResponse.data.deck.deck_id,
            title: deckResponse.data.deck.deck_name
        };

        res.render("game", {
            pageTitle: "Launch Game",
            deck,
            unityPath: "/Unity/index.html"
        });
    } catch (error) {
        console.error("Game page render failed.", error);
        sendServerError(res, "Game page could not render.");
    }
}

/*
Shows the AI summary and stats after a game session.
*/
async function renderReport(req, res) {
    try {
        const sessionID = Number.parseInt(req.params.id, 10);
        const session = Number.isNaN(sessionID) ? null : await dataStore.getSessionById(sessionID);

        if (!session) {
            res.status(404).send("Report not found.");
            return;
        }

        res.render("report", {
            pageTitle: "Session Report",
            session: {
                id: session.session_id,                    // ← fixed
                deckTitle: session.deck_name || "Untitled Deck",  // ← fixed
                createdAt: session.date_played || "Unknown date", // ← fixed
                summaryText: session.ai_summary_text || null,     // ← fixed
                metrics: {
                    roundsPlayed: session.rounds_played || 0,
                    averageAccuracy: session.average_accuracy || "N/A",
                    averageResponseTime: session.average_response_time_ms || "N/A"
                }
            }
        });
    } catch (error) {
        console.error("Report page render failed.", error);
        sendServerError(res, "Report page could not render.");
    }
}

/*
Shows all past game sessions.
*/
async function renderSessions(req, res) {
    try {
        const sessionsResponse = await dataStore.getSessions(req.session.teacherID);
        const sessions = sessionsResponse.success ? sessionsResponse.data.map((s) => ({
            id: s.session_id,
            deckTitle: s.deck_name || "Untitled Deck",
            createdAt: formatSessionDate(s.date_played),
            summaryPreview: s.ai_summary_text || null,
            metrics: {
                roundsPlayed: s.rounds_played || 0,
                averageAccuracy: s.average_accuracy || "N/A",
                averageResponseTime: s.average_response_time_ms || "N/A"
            }
        })) : [];

        res.render("sessions", { pageTitle: "Sessions", sessions });
    } catch (error) {
        console.error("Sessions page render failed.", error);
        sendServerError(res, "Sessions page could not render.");
    }
}

/*
Shows a blank deck editor.
*/
async function renderNewDeck(req, res) {
    try {
        res.render("deck", {
            pageTitle: "Create Deck",
            mode: "create",
            deck: { id: null, title: "", contentJson: "{\n  \"questions\": []\n}" }
        });
    } catch (error) {
        console.error("Deck create page render failed.", error);
        sendServerError(res, "Deck editor could not render.");
    }
}

/*
Shows the deck editor loaded with an existing deck.
*/
async function renderEditDeck(req, res) {
    try {
        const deckID = Number.parseInt(req.params.id, 10);
        const deckResponse = Number.isNaN(deckID) ? null : await dataStore.getDeckById(deckID, req.session.teacherID);

        if (!deckResponse || !deckResponse.success) {
            res.status(404).send("Deck not found.");
            return;
        }

        const deck = deckResponse.data.deck;
        const questions = deckResponse.data.questions;

        const contentJson = JSON.stringify({
            questions: questions.map((q) => {
                const options = q.answer_options
                    ? (typeof q.answer_options === "string" ? JSON.parse(q.answer_options) : q.answer_options)
                    : [];
                return {
                    id: q.question_id,
                    questionType: q.question_type === "MC" ? "multiple_choice" :
                                  q.question_type === "TF" ? "true_false" : "fill_blank",
                    questionText: q.question_text,
                    optionA: options[0] || "",
                    optionB: options[1] || "",
                    optionC: options[2] || "",
                    optionD: options[3] || "",
                    correctAnswer: q.correct_answer,
                    correctAnswerText: q.correct_answer
                };
            })
        }, null, 2);

        res.render("deck", {
            pageTitle: "Edit Deck",
            mode: "edit",
            deck: {
                id: deck.deck_id,
                title: deck.deck_name,
                contentJson
            }
        });
    } catch (error) {
        console.error("Deck edit page render failed.", error);
        sendServerError(res, "Deck editor could not render.");
    }
}

/*
Saves a deck and its questions to the database.
*/
async function saveDeck(req, res) {
    try {
        const title = (req.body.title || "").trim() || "Untitled Deck";
        const contentJson = (req.body.contentJson || "").trim() || "{\n  \"questions\": []\n}";

        let parsed;
        try {
            parsed = JSON.parse(contentJson);
        } catch (parseError) {
            res.status(400).send("Deck could not be saved: contentJson is not valid JSON.");
            return;
        }

        if (!parsed || !Array.isArray(parsed.questions)) {
            res.status(400).send("Deck could not be saved: contentJson must contain a 'questions' array.");
            return;
        }

        const validAnswers = new Set(["A", "B", "C", "D"]);
        const validQuestionTypes = new Set(["multiple_choice", "true_false", "fill_blank"]);

        for (let i = 0; i < parsed.questions.length; i += 1) {
            const q = parsed.questions[i];

            if (!q.questionText || typeof q.questionText !== "string" || q.questionText.trim().length === 0) {
                res.status(400).send(`Deck could not be saved: question at index ${i} is missing required field 'questionText'.`);
                return;
            }

            const questionType = q.questionType || "multiple_choice";
            if (!validQuestionTypes.has(questionType)) {
                res.status(400).send(`Deck could not be saved: question at index ${i} has invalid questionType '${questionType}'.`);
                return;
            }

            if (questionType === "multiple_choice") {
                if (!q.optionA || !q.optionB || !q.optionC || !q.optionD || !validAnswers.has(q.correctAnswer)) {
                    res.status(400).send(`Deck could not be saved: multiple-choice question at index ${i} is missing required fields.`);
                    return;
                }
            }

            if (questionType === "true_false") {
                const correct = String(q.correctAnswer || "").toLowerCase();
                if (correct !== "true" && correct !== "false") {
                    res.status(400).send(`Deck could not be saved: true/false question at index ${i} must use correctAnswer of 'true' or 'false'.`);
                    return;
                }
            }

            if (questionType === "fill_blank") {
                const answerText = (q.correctAnswerText || q.correctAnswer || "").toString().trim();
                if (!answerText) {
                    res.status(400).send(`Deck could not be saved: fill-in-the-blank question at index ${i} must include correctAnswerText.`);
                    return;
                }
            }
        }

        const questions = parsed.questions.map((q) => ({
            question_id: q.id || undefined,
            question_text: q.questionText || "",
            question_type: q.questionType === "multiple_choice" ? "MC" :
                           q.questionType === "true_false" ? "TF" : "FB",
            correct_answer: q.correctAnswerText || q.correctAnswer || "",
            answer_options: (q.optionA || q.optionB || q.optionC || q.optionD)
                ? JSON.stringify([q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean))
                : null
        }));

        const deckIdFromForm = toPositiveInteger(req.body.id);

        const infoPackage = {
            deck_id: deckIdFromForm || undefined,
            owner_id: req.session.teacherID,
            deck_name: title,
            number_of_questions: questions.length,
            questions
        };

        const savedDeck = await dataStore.saveDeck(infoPackage);

        console.log("infoPackage:", JSON.stringify(infoPackage));
        console.log("savedDeck result:", JSON.stringify(savedDeck));

        if (!savedDeck.success) {
            console.error("Deck save failed:", savedDeck.error);
            res.status(500).send("Deck could not be saved.");
            return;
        }

        const deckId = savedDeck.insertID || deckIdFromForm;
        console.log("deckId:", deckId);
        res.redirect(`/deck/${deckId}/edit`);
    } catch (error) {
        console.error("Deck save failed.", error);
        sendServerError(res, "Deck could not be saved.");
    }
}

/*
Starts the server.
In production (Render), runs plain HTTP and lets Render handle HTTPS.
Locally, generates a self-signed cert so Brotli/WebGL works in the browser.
*/
async function startServer() {
    if (process.env.NODE_ENV === "production") {
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server started on http://0.0.0.0:${port}`);
        });
        return;
    }

    const certsDir = path.join(__dirname, "../certs");
    const host = process.env.HOST || (runtimeMode === "server" ? "0.0.0.0" : "127.0.0.1");
    const tlsHost = process.env.TLS_HOST
    || (runtimeMode === "server" ? (process.env.PUBLIC_HOST || "45.26.97.159") : "localhost");
    const tlsIp = process.env.TLS_IP || (runtimeMode === "server" ? "45.26.97.159" : "127.0.0.1");
    const certBase = tlsHost.replace(/[^a-zA-Z0-9.-]/g, "_");
    const keyPath = path.join(certsDir, `${certBase}-key.pem`);
    const certPath = path.join(certsDir, `${certBase}-cert.pem`);

    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        try {
            const attrs = [{ name: "commonName", value: tlsHost }];
            const isTlsHostIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(tlsHost);
            const isTlsIpValid = /^\d{1,3}(\.\d{1,3}){3}$/.test(tlsIp);
            const altNames = [{ type: 2, value: "localhost" }];

            if (isTlsHostIp) {
                altNames.push({ type: 7, ip: tlsHost });
            } else {
                altNames.push({ type: 2, value: tlsHost });
            }

            if (isTlsIpValid && tlsIp !== tlsHost) {
                altNames.push({ type: 7, ip: tlsIp });
            }

            const pems = selfsigned.generate(attrs, {
                days: 365,
                keySize: 2048,
                extensions: [{ name: "subjectAltName", altNames }]
            });
            fs.writeFileSync(keyPath, pems.private, "utf8");
            fs.writeFileSync(certPath, pems.cert, "utf8");
            console.log(`Generated self-signed HTTPS certificates for '${tlsHost}' in /certs.`);
        } catch (err) {
            console.warn("Certificate generation failed, falling back to HTTP.", err);
            app.listen(port, host, () => {
                console.log(`Server started on http://${tlsHost}:${port}.`);
            });
            return;
        }
    }

    const httpsPort = Number.parseInt(process.env.HTTPS_PORT || port, 10);
    const serverOptions = {
        key: fs.readFileSync(keyPath, "utf8"),
        cert: fs.readFileSync(certPath, "utf8")
    };

    https.createServer(serverOptions, app).listen(httpsPort, host, () => {
        console.log(`Server started on https://${tlsHost}:${httpsPort}.`);
        console.log("Note: Your browser will show a security warning for self-signed certs unless trusted.");
    });
}

// ============================================================
// ROUTES
// ============================================================

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", renderLoginPage);
app.post("/login", processAuthenticationRequest);

app.get("/teacher", (req, res) => {
    res.render("teacher", { pageTitle: "Teacher Portal" });
});

app.get("/register", (req, res) => {
    res.render("register", { pageTitle: "Create Account", errorMessage: null, successMessage: null });
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.render("register", {
                pageTitle: "Create Account",
                errorMessage: "All fields are required.",
                successMessage: null
            });
        }
        const result = await dataStore.registerTeacherAccount(username, email, password, username);
        if (result.success) {
            return res.render("register", {
                pageTitle: "Create Account",
                errorMessage: null,
                successMessage: "Account created! You can now sign in."
            });
        } else {
            return res.render("register", {
                pageTitle: "Create Account",
                errorMessage: "There was some problem with the database...",
                successMessage: null
            });
        }
    } catch (error) {
        console.error("Error registering teacher account:", error);
        return res.render("register", {
            pageTitle: "Create Account",
            errorMessage: "An unexpected error occurred.",
            successMessage: null
        });
    }
});

app.post("/logout", processLogoutRequest);

app.get("/join", (req, res) => {
    res.render("student", { unityPath: "/Unity/index.html" });
});

app.get("/game/play", requireTeacherAuthentication, renderGame);

app.get("/dashboard", requireTeacherAuthentication, renderDashboard);
app.get("/sessions", requireTeacherAuthentication, renderSessions);
app.get("/report/:id", requireTeacherAuthentication, renderReport);
app.get("/deck/new", requireTeacherAuthentication, renderNewDeck);
app.get("/deck/:id/edit", requireTeacherAuthentication, renderEditDeck);
app.post("/deck", requireTeacherAuthentication, saveDeck);

/*
Unity API routes.
*/
app.get("/api/unity/deck/:deckID", async (req, res) => {
    try {
        const deckID = toPositiveInteger(req.params.deckID);
        if (!deckID) {
            res.status(400).json({ error: "deckID must be a positive integer." });
            return;
        }

        const deckResponse = await dataStore.getDeckById(deckID, req.session.teacherID);
        if (!deckResponse || !deckResponse.success) {
            res.status(404).json({ error: "Deck not found." });
            return;
        }

        const deck = deckResponse.data.deck;
        const questions = deckResponse.data.questions.map((q, index) => {
            const type = mapQuestionTypeToUnity(q.question_type);
            let answerOptions = null;

            if (type === "MC" || type === "TF") {
                answerOptions = q.answer_options
                    ? (typeof q.answer_options === "string" ? JSON.parse(q.answer_options) : q.answer_options)
                    : null;
            }

            return {
                question_id: q.question_id || index + 1,
                deck_id: deck.deck_id,
                question_text: q.question_text || "",
                question_type: type,
                correct_answer: q.correct_answer || "",
                answer_options: answerOptions,
                points_value: 1
            };
        });

        res.json({
            deck_id: deck.deck_id,
            owner_id: deck.owner_id || null,
            deck_name: deck.deck_name || "Untitled Deck",
            description: deck.description || null,
            subject_tag: deck.subject_tag || null,
            number_of_questions: questions.length,
            is_public: deck.is_public || 0,
            created_at: deck.created_at || null,
            updated_at: deck.updated_at || null,
            questions
        });
    } catch (error) {
        console.error("Unity deck export failed.", error);
        res.status(500).json({ error: "Unity deck export failed." });
    }
});

app.post("/api/unity/session/ingest", async (req, res) => {
    try {
        const teacherIdentity = req.session.teacherID || null;
        console.log("Ingest hit — teacherID:", teacherIdentity);
        console.log("Raw body:", JSON.stringify(req.body));

        const normalizedPayload = normalizeUnitySessionPayload(req.body, teacherIdentity);

        if (normalizedPayload.error) {
            console.log("Normalize error:", normalizedPayload.error);
            res.status(400).json({ error: normalizedPayload.error });
            return;
        }

        console.log("Normalized payload:", JSON.stringify(normalizedPayload));

        const saveResult = await dataStore.saveSession(normalizedPayload);
        console.log("Save result:", JSON.stringify(saveResult));

        if (!saveResult.success) {
            res.status(500).json({ error: "Failed to save session." });
            return;
        }

        dataStore.getSessionSummaryFromAI(saveResult.sessionId).catch(err => {
            console.error("Background summary generation failed.", err);
        });

        res.status(202).json({ ok: true, sessionId: saveResult.sessionId });
    } catch (error) {
        console.error("Unity session ingest failed.", error);
        res.status(500).json({ error: "Unity session ingest failed." });
    }
});

app.post("/api/ai/summarize", requireTeacherAuthentication, async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({ error: "sessionId is required." });
            return;
        }

        const result = await dataStore.getSessionSummaryFromAI(sessionId);

        if (!result.success) {
            res.status(result.code || 500).json({ error: result.error });
            return;
        }

        res.json({ summary: result.summary });
    } catch (error) {
        console.error("AI summarize failed.", error);
        res.status(500).json({ error: "AI summarize request failed." });
    }
});

app.get("/api/ai/report/:sessionID", requireTeacherAuthentication, async (req, res) => {
    try {
        const sessionID = Number.parseInt(req.params.sessionID, 10);
        const session = await dataStore.getSessionById(sessionID);

        if (!session) {
            res.status(404).json({ error: "Session not found." });
            return;
        }

        res.json({
            sessionID,
            summary: Array.isArray(session.summaryParagraphs) ? session.summaryParagraphs.join("\n\n") : ""
        });
    } catch (error) {
        console.error("AI report fetch failed.", error);
        res.status(500).json({ error: "AI report fetch failed." });
    }
});

app.post("/api/ai/report/:sessionID", requireTeacherAuthentication, async (req, res) => {
    try {
        res.json({ ok: true, note: "Save stub — MySQL not connected yet." });
    } catch (error) {
        console.error("AI report save failed.", error);
        res.status(500).json({ error: "AI report save failed." });
    }
});

startServer();