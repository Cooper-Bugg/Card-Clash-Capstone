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
// TODO after demo: switch data routes from mockdata.js to dbController.js
// Replace the line below with: const dataStore = require("./dbController");
const dataStore = require("./mockdata");

// Loads environment variables from a .env file into process.env
// .env lives at the repo root, one level above Backend/
//require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = express();

// Script mode controls default network/certificate behavior.
// local (default): localhost-friendly for Unity team testing.
// server: VM/domain defaults for hosted deployment.
function getRuntimeMode() {
    const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
    const modeFromArg = modeArg ? modeArg.split("=")[1] : "";
    const mode = process.env.RUN_MODE || modeFromArg;
    return mode === "server" ? "server" : "local";
}

const runtimeMode = getRuntimeMode();
// Use PORT env var if set (e.g. for deployment), otherwise default to 3000.
const port = Number.parseInt(process.env.PORT || "3000", 10);

app.set("view engine", "ejs");
// Views now live in Frontend/views — one level up from Backend/
app.set("views", path.join(__dirname, "../Frontend/views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Keep API contracts machine-readable: malformed request bodies should return JSON, not HTML.
app.use((err, req, res, next) => {
    if (!err || !req.path.startsWith("/api/")) {
        next(err);
        return;
    }

    if (err.type === "entity.parse.failed") {
        res.status(400).json({
            error: "Malformed JSON in request body.",
            code: "BAD_JSON"
        });
        return;
    }

    if (err.type === "entity.too.large") {
        res.status(413).json({
            error: "Request body is too large.",
            code: "PAYLOAD_TOO_LARGE"
        });
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
// Static assets (CSS, fonts, Unity build) now live in Frontend/public
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

/*
Takes a date from our fake data and formats it nicely for display.
Right now it just returns the date as-is, but later this can
make dates look prettier without needing an extra library.
*/
function formatSessionDate(rawDate) {
    if (!rawDate) {
        return "Unknown date";
    }

    return rawDate;
}

/*
Gathers all the deck and session data for the dashboard.
Pulls from the data store (async so it will work when MySQL replaces mock data),
counts the questions in each deck, and formats everything for the dashboard view.
*/
async function buildDashboardViewModel() {
    const decks = [];
    const sessions = [];
    const storedDecks = await dataStore.getDecks();
    // TODO after demo: switch data routes from data.js to dbConnect.js — replace above with database.getDecks()
    const storedSessions = await dataStore.getSessions();
    // TODO after demo: switch data routes from data.js to dbConnect.js — replace above with database.getSessions()

    for (let i = 0; i < storedDecks.length; i += 1) {
        const deck = storedDecks[i];
        const deckSummary = {
            id: deck.id,
            title: deck.title,
            questionCount: 0
        };

        try {
            const parsed = JSON.parse(deck.contentJson);
            if (parsed && Array.isArray(parsed.questions)) {
                deckSummary.questionCount = parsed.questions.length;
            }
        } catch (error) {
            deckSummary.questionCount = 0;
        }

        decks.push(deckSummary);
    }

    for (let i = 0; i < storedSessions.length; i += 1) {
        const session = storedSessions[i];
        sessions.push({
            id: session.id,
            deckTitle: session.deckTitle || "Untitled Deck",
            createdAt: formatSessionDate(session.createdAt),
            summaryPreview: Array.isArray(session.summaryParagraphs) ? session.summaryParagraphs[0] : null,
            metrics: session.metrics || { roundsPlayed: 0, averageAccuracy: "N/A", averageResponseTime: "N/A" }
        });
    }

    return { decks, sessions };
}

/*
Sends back a standard error response.
Keeps us from writing the same error handling code over and over
in every route handler.
*/
function sendServerError(res, message) {
    res.status(500).send(message);
}

function toPositiveInteger(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanFlag(value) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "number") {
        return value === 1;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1";
    }

    return false;
}

function mapQuestionTypeToUnity(questionType) {
    if (questionType === "true_false") {
        return "TF";
    }

    if (questionType === "fill_blank") {
        return "FB";
    }

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
        if (!questionID) {
            continue;
        }

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
            if (isCorrect) {
                computedTimesCorrect += 1;
            }

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
This is the gate you have to go through before you can see the dashboard.
*/
async function renderLoginPage(req, res) {
    try {
        res.render("login", {
            pageTitle: "Teacher Login",
            errorMessage: null
        });
    } catch (error) {
        console.error("Login page render failed.", error);
        sendServerError(res, "Login page could not render.");
    }
}

/*
Shows the main dashboard with all the decks and past game sessions.
This is the main hub where teachers manage everything.
*/
async function renderDashboard(req, res) {
    try {
        const viewModel = await buildDashboardViewModel();
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
Processes the login form. Checks username and password.
On success it marks the session as authenticated and redirects to the dashboard.
On failure it re-renders the login page with an error message.
Credentials are read from environment variables (ADMIN_USERNAME / ADMIN_PASSWORD).
For production, replace with hashed password lookup against the Users table.
*/
/*
store teacher id in req.session.accountID for future retrieval; already destroyed in session.destroy on logout, so good there
*/
async function processAuthenticationRequest(req, res) {
    const submittedUsername = req.body.username;
    const submittedPassword = req.body.password;

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "password";

    if (submittedUsername === expectedUsername && submittedPassword === expectedPassword) {
        req.session.isAuthenticated = true;
        // TODO: Until SQL auth is wired in, keep username in session so Unity payloads stay teacher-owned.
        req.session.teacherUsername = submittedUsername;
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
Looks up which deck you want to play and displays the game iframe.
*/
async function renderGame(req, res) {
    try {
        const deckID = Number.parseInt(req.query.deckID, 10);
        const deck = Number.isNaN(deckID) ? null : await dataStore.getDeckById(deckID);

        let fallbackDeck = deck;
        if (!fallbackDeck) {
            // TODO after demo: switch data routes from data.js to database.js — replace below with database.getDecks()
            const allDecks = await dataStore.getDecks();
            fallbackDeck = allDecks[0] || null;
        }

        if (!fallbackDeck) {
            res.status(404).send("No decks available. Please create a deck first.");
            return;
        }

        res.render("game", {
            pageTitle: "Launch Game",
            deck: fallbackDeck,
            unityPath: "/Unity/index.html"
        });
    } catch (error) {
        console.error("Game page render failed.", error);
        sendServerError(res, "Game page could not render.");
    }
}

/*
Shows the AI summary and stats after a game session.
Looks up which session you want to review and displays the report.
*/
async function renderReport(req, res) {
    try {
        const sessionID = Number.parseInt(req.params.id, 10);
        const session = Number.isNaN(sessionID)
            ? null
            : await dataStore.getSessionById(sessionID);

        if (!session) {
            res.status(404).send("Report not found.");
            return;
        }

        res.render("report", {
            pageTitle: "Session Report",
            session: {
                id: session.id,
                deckTitle: session.deckTitle || "Untitled Deck",
                createdAt: session.createdAt || "Unknown date",
                summaryParagraphs: Array.isArray(session.summaryParagraphs) ? session.summaryParagraphs : [],
                metrics: session.metrics || { roundsPlayed: 0, averageAccuracy: "N/A", averageResponseTime: "N/A" }
            }
        });
    } catch (error) {
        console.error("Report page render failed.", error);
        sendServerError(res, "Report page could not render.");
    }
}

/*
Shows all past game sessions so the teacher can pick one to review.
Pulls from the data store — ready for MySQL implementation.
*/
async function renderSessions(req, res) {
    try {
        // TODO after demo: switch data routes from data.js to database.js — replace below with database.getSessions()
        const storedSessions = await dataStore.getSessions();
        const sessions = (Array.isArray(storedSessions) ? storedSessions : []).map((s) => ({
            id: s.id,
            deckID: s.deckID,
            deckTitle: s.deckTitle || "Untitled Deck",
            createdAt: s.createdAt || "Unknown date",
            summaryPreview: Array.isArray(s.summaryParagraphs) ? s.summaryParagraphs[0] : null,
            metrics: s.metrics || { roundsPlayed: 0, averageAccuracy: "N/A", averageResponseTime: "N/A" }
        }));

        res.render("sessions", {
            pageTitle: "Sessions",
            sessions
        });
    } catch (error) {
        console.error("Sessions page render failed.", error);
        sendServerError(res, "Sessions page could not render.");
    }
}

/*
Shows a blank deck editor so you can create a new quiz.
Starts with an empty form ready for you to add questions.
*/
async function renderNewDeck(req, res) {
    try {
        res.render("deck", {
            pageTitle: "Create Deck",
            mode: "create",
            deck: {
                id: null,
                title: "",
                contentJson: "{\n  \"questions\": []\n}"
            }
        });
    } catch (error) {
        console.error("Deck create page render failed.", error);
        sendServerError(res, "Deck editor could not render.");
    }
}

/*
Shows the deck editor loaded with an existing deck.
Lets you edit questions and answers for a deck you already created.
*/
async function renderEditDeck(req, res) {
    try {
        const deckID = Number.parseInt(req.params.id, 10);
        const deck = Number.isNaN(deckID) ? null : await dataStore.getDeckById(deckID);

        if (!deck) {
            res.status(404).send("Deck not found.");
            return;
        }

        res.render("deck", {
            pageTitle: "Edit Deck",
            mode: "edit",
            deck
        });
    } catch (error) {
        console.error("Deck edit page render failed.", error);
        sendServerError(res, "Deck editor could not render.");
    }
}

/*
Saves a deck from the form and stores it in memory.
Validates the contentJson shape before saving to prevent broken payloads
from reaching the game or Unity integration.
*/
async function saveDeck(req, res) {
    try {
        const title = (req.body.title || "").trim() || "Untitled Deck";
        const contentJson = (req.body.contentJson || "").trim() || "{\n  \"questions\": []\n}";

        // Validate deck JSON shape before saving.
        // Ensures downstream game and Unity logic receives well-formed data.
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
                    res.status(400).send(`Deck could not be saved: multiple-choice question at index ${i} is missing required fields (optionA-D, correctAnswer A-D).`);
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

            if (q.minValue !== undefined && !Number.isFinite(Number(q.minValue))) {
                res.status(400).send(`Deck could not be saved: question at index ${i} has invalid minValue.`);
                return;
            }

            if (q.maxValue !== undefined && !Number.isFinite(Number(q.maxValue))) {
                res.status(400).send(`Deck could not be saved: question at index ${i} has invalid maxValue.`);
                return;
            }
        }

        // TODO after demo: switch data routes from data.js to database.js — replace below with database.saveDeck(...)
        const savedDeck = await dataStore.saveDeck({
            id: req.body.id,
            title,
            contentJson
        });

        res.redirect(`/deck/${savedDeck.id}/edit`);
    } catch (error) {
        console.error("Deck save failed.", error);
        sendServerError(res, "Deck could not be saved.");
    }
}

/*
Starts the server with HTTPS so Brotli-compressed Unity assets work.
Generates a self-signed certificate in the /certs folder if one does not exist.
Falls back to plain HTTP if certificate generation fails for any reason.
*/
async function startServer() {
    // certs/ lives at the repo root, one level above Backend/
    const certsDir = path.join(__dirname, "../certs");
    // HOST controls bind address; TLS_HOST controls certificate identity.
    // local mode defaults to localhost. server mode defaults to VM/domain values.
    const host = process.env.HOST || (runtimeMode === "server" ? "0.0.0.0" : "127.0.0.1");
    const tlsHost = process.env.TLS_HOST
        || (runtimeMode === "server" ? (process.env.PUBLIC_HOST || "ajc40.info") : "localhost");
    const tlsIp = process.env.TLS_IP || (runtimeMode === "server" ? "74.208.236.122" : "127.0.0.1");
    const certBase = tlsHost.replace(/[^a-zA-Z0-9.-]/g, "_");
    const keyPath = path.join(certsDir, `${certBase}-key.pem`);
    const certPath = path.join(certsDir, `${certBase}-cert.pem`);

    // Make sure certs directory exists
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    // Generate self-signed cert if not already present
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

    // Start HTTPS server
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

/*
Home page. Everyone lands here first.
Choose if you're a student or a teacher.
*/
app.get("/", (req, res) => {
    res.render("index");
});

/*
Teacher login page route.
*/
app.get("/login", renderLoginPage);
app.post("/login", processAuthenticationRequest);

/*
Teacher portal — choose to sign in or create an account.
*/
app.get("/teacher", (req, res) => {
    res.render("teacher", { pageTitle: "Teacher Portal" });
});

/*
Teacher registration page - create a new account
For now this just renders the form real persistence happens after
the database layer is wired up.
*/
app.get("/register", (req, res) => {
    res.render("register", { pageTitle: "Create Account", errorMessage: null, successMessage: null });
});

app.post("/register", (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.render("register", {
            pageTitle: "Create Account",
            errorMessage: "All fields are required.",
            successMessage: null
        });
    }
    // TODO: persist to database and hash password before storing
    res.render("register", {
        pageTitle: "Create Account",
        errorMessage: null,
        successMessage: "Account created! You can now sign in."
    });
});

/*
Logout route — destroys the session and redirects to login.
*/
app.post("/logout", processLogoutRequest);

/*
Student game page. Just the game, no dashboard.
Students do not need to authenticate.
Students currently have no accounts, so session analytics still belong to the host teacher.
*/
app.get("/join", (req, res) => {
    res.render("student", {
        unityPath: "/Unity/index.html"
    });
});

/*
Game page. Protected — teacher must be logged in.
*/
app.get("/game/play", requireTeacherAuthentication, renderGame);

/*
Protected teacher routes. requireTeacherAuthentication blocks
anyone who is not logged in and redirects them to /login.
*/
app.get("/dashboard", requireTeacherAuthentication, renderDashboard);
app.get("/sessions", requireTeacherAuthentication, renderSessions);
app.get("/report/:id", requireTeacherAuthentication, renderReport);
app.get("/deck/new", requireTeacherAuthentication, renderNewDeck);
app.get("/deck/:id/edit", requireTeacherAuthentication, renderEditDeck);
app.post("/deck", requireTeacherAuthentication, saveDeck);

/*
Unity API routes.
The authenticated teacher is the owner for all game data at this stage.
Students are guest players for now, so player_name text should be saved without requiring student IDs.
*/
app.get("/api/unity/deck/:deckID", requireTeacherAuthentication, async (req, res) => {
    try {
        const deckID = toPositiveInteger(req.params.deckID);
        if (!deckID) {
            res.status(400).json({ error: "deckID must be a positive integer." });
            return;
        }

        const deck = await dataStore.getDeckById(deckID);
        if (!deck) {
            res.status(404).json({ error: "Deck not found." });
            return;
        }

        let parsedContent;
        try {
            parsedContent = JSON.parse(deck.contentJson || "{}");
        } catch (parseError) {
            res.status(500).json({ error: "Deck contentJson is not valid JSON." });
            return;
        }

        const questions = Array.isArray(parsedContent.questions)
            ? parsedContent.questions.map((question, index) => {
                const type = mapQuestionTypeToUnity(question.questionType || "multiple_choice");
                let answerOptions = null;

                if (type === "MC") {
                    answerOptions = [question.optionA, question.optionB, question.optionC, question.optionD].filter((opt) => typeof opt === "string");
                } else if (type === "TF") {
                    answerOptions = ["true", "false"];
                }

                return {
                    question_id: toPositiveInteger(question.id) || index + 1,
                    deck_id: deck.id,
                    question_text: question.questionText || "",
                    question_type: type,
                    correct_answer: question.correctAnswerText || question.correctAnswer || "",
                    answer_options: answerOptions,
                    points_value: Number.isFinite(Number(question.pointsValue)) ? Number(question.pointsValue) : 1
                };
            })
            : [];

        // SQL TODO: read owner_id, timestamps, and question IDs directly from MySQL tables (decks/questions).
        res.json({
            deck_id: deck.id,
            owner_id: null,
            deck_name: deck.title || "Untitled Deck",
            description: null,
            subject_tag: null,
            number_of_questions: questions.length,
            is_public: 0,
            created_at: null,
            updated_at: null,
            questions
        });
    } catch (error) {
        console.error("Unity deck export failed.", error);
        res.status(500).json({ error: "Unity deck export failed." });
    }
});

app.post("/api/unity/session/ingest", requireTeacherAuthentication, async (req, res) => {
    try {
        const teacherIdentity = req.session.teacherUsername || process.env.ADMIN_USERNAME || "admin";
        const normalizedPayload = normalizeUnitySessionPayload(req.body, teacherIdentity);

        if (normalizedPayload.error) {
            res.status(400).json({ error: normalizedPayload.error });
            return;
        }
        // TODO: save session/player/question rows in one transaction
        // SQL TODO: use a transaction in dbController to:
        // 1) INSERT into game_sessions (teacher-owned session metadata)
        // 2) INSERT/UPSERT per-player rows in session_summaries
        // 3) INSERT per-response rows in session_results
        // 4) UPSERT aggregated counters in question_metrics
        res.status(202).json({
            ok: true,
            note: "Unity payload accepted and normalized. SQL persistence is the next step in dbController.",
            payload: normalizedPayload
        });
    } catch (error) {
        console.error("Unity session ingest failed.", error);
        res.status(500).json({ error: "Unity session ingest failed." });
    }
});

/*
Ollama and LLM API routes.
These are the endpoints the server will use to talk to Ollama locally.
Right now they return stub responses so the rest of the application can be built.
*/
app.post("/api/ai/summarize", requireTeacherAuthentication, async (req, res) => {
    try {
        // Implement Ollama API connection here to fetch the AI summary.
        res.json({
            summary: "AI summary stub — Ollama not connected yet."
        });
    } catch (error) {
        console.error("AI summarize failed.", error);
        res.status(500).json({ error: "AI summarize request failed." });
    }
});

app.get("/api/ai/report/:sessionID", requireTeacherAuthentication, async (req, res) => {
    try {
        // Implement MySQL SELECT query here to retrieve the session summary.
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
        // TODO: Implement MySQL UPDATE query here to save the completed AI summary.
        res.json({ ok: true, note: "Save stub — MySQL not connected yet." });
    } catch (error) {
        console.error("AI report save failed.", error);
        res.status(500).json({ error: "AI report save failed." });
    }
});

startServer();