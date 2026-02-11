/*
This is the main server file that runs Card Clash.
It uses Express to handle routes, render the page templates
and serve the game files. Later we'll add mssql database, user login sessions,
and AI report generation.
*/
const path = require("path");
const express = require("express");
const dataStore = require("./data");

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
Pulls from the fake data, counts the questions in each deck,
and formats everything nice for the dashboard view to render.
*/
function buildDashboardViewModel() {
	const decks = [];
	const sessions = [];
	const storedDecks = dataStore.getDecks();
	const storedSessions = dataStore.getSessions();

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
			deckTitle: session.deckTitle,
			createdAt: formatSessionDate(session.createdAt),
			summaryPreview: session.summaryParagraphs[0],
			metrics: session.metrics
		});
	}

	return {
		decks,
		sessions
	};
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
			pageTitle: "Teacher Login"
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
		const viewModel = buildDashboardViewModel();
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
Shows the game window with the Unity frame.
Looks up which deck you want to play and displays the game iframe.
*/
async function renderGame(req, res) {
	try {
		const deckId = Number.parseInt(req.query.deckId, 10);
		const deck = Number.isNaN(deckId) ? null : dataStore.getDeckById(deckId);
		const fallbackDeck = deck || dataStore.getDecks()[0];

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
		const sessionId = Number.parseInt(req.params.id, 10);
		const session = Number.isNaN(sessionId)
			? null
			: dataStore.getSessionById(sessionId);

		if (!session) {
			res.status(404).send("Report not found.");
			return;
		}

		res.render("report", {
			pageTitle: "Session Report",
			session
		});
	} catch (error) {
		console.error("Report page render failed.", error);
		sendServerError(res, "Report page could not render.");
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
		const deckId = Number.parseInt(req.params.id, 10);
		const deck = Number.isNaN(deckId) ? null : dataStore.getDeckById(deckId);

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
This lets us create or update decks without a database yet.
*/
async function saveDeck(req, res) {
	try {
		const title = (req.body.title || "").trim() || "Untitled Deck";
		const contentJson = (req.body.contentJson || "").trim() || "{\n  \"questions\": []\n}";
		const savedDeck = dataStore.saveDeck({
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
Prints a message to the console when the server starts up.
This tells us the server is running and on what port.
*/
function handleServerStart() {
	console.log(`Server started on port ${port}.`);
}

/*
Starts the Express server so it can listen for requests.
This runs the app and makes it available on port 3000.
*/
function startServer() {
	app.listen(port, handleServerStart);
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

/*
Student game page. Just the game, no dashboard.
*/
app.get("/join", (req, res) => {
	res.render("student", {
		unityPath: "/Unity/index.html"
	});
});

/*
Game page. Shows the dashboard nav at the top plus the game in the middle.
*/
app.get("/game/play", renderGame);

app.get("/dashboard", renderDashboard);
app.get("/report/:id", renderReport);
app.get("/deck/new", renderNewDeck);
app.get("/deck/:id/edit", renderEditDeck);
app.post("/deck", saveDeck);

startServer();