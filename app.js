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
const dataStore = require("./data");

// Loads environment variables from a .env file into process.env
require("dotenv").config();

const app = express();
// Use PORT env var if set (e.g. for deployment), otherwise default to 3000 for local dev
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
app.use(express.static(path.join(__dirname, "public")));

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
    const storedSessions = await dataStore.getSessions();

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
async function processAuthenticationRequest(req, res) {
    const submittedUsername = req.body.username;
    const submittedPassword = req.body.password;

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "password";

    if (submittedUsername === expectedUsername && submittedPassword === expectedPassword) {
        req.session.isAuthenticated = true;
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
        for (let i = 0; i < parsed.questions.length; i += 1) {
            const q = parsed.questions[i];
            if (!q.questionText || !q.optionA || !q.optionB || !q.optionC || !q.optionD || !validAnswers.has(q.correctAnswer)) {
                res.status(400).send(`Deck could not be saved: question at index ${i} is missing required fields (questionText, optionA-D, correctAnswer A-D).`);
                return;
            }
        }

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
    const certsDir = path.join(__dirname, "certs");
    const keyPath = path.join(certsDir, "localhost-key.pem");
    const certPath = path.join(certsDir, "localhost-cert.pem");

    // Make sure certs directory exists
    if (!fs.existsSync(certsDir)) {
        fs.mkdirSync(certsDir, { recursive: true });
    }

    // Generate self-signed cert if not already present
    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        try {
            const attrs = [{ name: "commonName", value: "localhost" }];
            const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });
            fs.writeFileSync(keyPath, pems.private, "utf8");
            fs.writeFileSync(certPath, pems.cert, "utf8");
            console.log("Generated self-signed HTTPS certificates in /certs.");
        } catch (err) {
            console.warn("Certificate generation failed, falling back to HTTP.", err);
            app.listen(port, () => {
                console.log(`Server started on http://localhost:${port}.`);
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

    https.createServer(serverOptions, app).listen(httpsPort, () => {
        console.log(`Server started on https://localhost:${httpsPort}.`);
        console.log("Note: Your browser will show a security warning for the self-signed cert.");
        console.log("Click 'Advanced' and 'Proceed' to continue - this is safe on localhost.");
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
Logout route — destroys the session and redirects to login.
*/
app.post("/logout", processLogoutRequest);

/*
Student game page. Just the game, no dashboard.
Students do not need to authenticate.
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
        // Implement MySQL UPDATE query here to save the completed AI summary.
        res.json({ ok: true, note: "Save stub — MySQL not connected yet." });
    } catch (error) {
        console.error("AI report save failed.", error);
        res.status(500).json({ error: "AI report save failed." });
    }
});

startServer();