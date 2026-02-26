CREATE DATABASE cardclash_db;

use cardclash_db;

# Teachers table
#NOTE: does not include an email as of now
CREATE TABLE teachers (
    teacher_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

# Question decks table
CREATE TABLE decks (
    deck_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_id INT UNSIGNED,
    deck_name VARCHAR(128) NOT NULL,
    description TEXT,
    subject_tag VARCHAR(64), # e.g. "math", "history", etc. IF SUBJECT TAG IS MATH, SHOULD SEARCH MATH DECKS INSTEAD OF QUESTIONS TABLE
    is_public TINYINT(1) DEFAULT 0, #0 = private, 1 = public
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL #set null?
);

# Questions table
CREATE TABLE questions (
    question_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    deck_id INT UNSIGNED,
    question_text TEXT NOT NULL,
    question_type ENUM('MC', 'TF', 'SA') NOT NULL, #multiple choice, true/false, short answer
    correct_answer TEXT NOT NULL,
    answer_options JSON, #for MC
    points_value SMALLINT NOT NULL, #maybe replace this with difficulty level?
    FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE
);

# Math Questions Table
# TALK TO TEACHER TO REFINE
CREATE TABLE math_decks (
    deck_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    operations JSON, #e.g. {"addition": true, "subtraction": false, ...}. can change this later
    lowest_number INT NOT NULL,
    highest_number INT NOT NULL,
    number_of_operands INT UNSIGNED NOT NULL,
    number_of_questions INT UNSIGNED NOT NULL,
    subject_tag VARCHAR(64), #e.g. "arithmetic", "algebra", etc. #do I need this?
    FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE
);

# Game Sessions table
CREATE TABLE game_sessions (
    session_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    host_teacher_id INT UNSIGNED,
    deck_id INT UNSIGNED,
    started_at TIMESTAMP,
    ended_at TIMESTAMP, #combine into date played?
    player_count SMALLINT,
    rounds_played SMALLINT,
    average_accuracy DECIMAL(5,2),
    average_response_time_ms INT UNSIGNED,
    ai_summary_text TEXT,
    FOREIGN KEY (host_teacher_id) REFERENCES teachers(teacher_id) ON DELETE SET NULL,
    FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE SET NULL
);

# Session Results table
# COME BACK TO THIS ONE; NOT SURE IF STATS SHOULD BE PER QUESTION
CREATE TABLE session_results (
    result_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED,
    question_id INT UNSIGNED,
    player_name VARCHAR(64),
    answer_given TEXT,
    is_correct TINYINT(1),
    response_time_ms INT UNSIGNED,
    FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE SET NULL
);

# deck Saves table
CREATE TABLE deck_saves (
    save_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT UNSIGNED,
    deck_id INT UNSIGNED,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE
);

#V2 Metrics

# Session Summaries table
CREATE TABLE session_summaries (
    summary_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id INT UNSIGNED,
    player_name VARCHAR(64),
    final_score INT,
    rank SMALLINT,
    accuracy_pct DECIMAL(5,2),
    avg_response_ms INT UNSIGNED,
    fastest_response_ms INT UNSIGNED,
    longest_streak SMALLINT,
    questions_answered SMALLINT,
    questions_correct SMALLINT,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES game_sessions(session_id) ON DELETE CASCADE
);

# Question Metrics table; meant to be across all sessions, not per session
CREATE TABLE question_metrics (
    question_id INT UNSIGNED PRIMARY KEY,
    times_seen INT UNSIGNED,
    times_correct INT UNSIGNED,
    difficulty_index DECIMAL(5,2), #computed as (times_correct - times_seen) / (times_seen * 100)
    avg_response_ms INT UNSIGNED,
    answer_distribution JSON, #e.g. {"A": 40, "B": 35, "C": 15, "D": 10} for MC; can be empty for TF/SA
    sessions_used_in INT UNSIGNED,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
);

# deck Metrics table
CREATE TABLE deck_metrics (
    deck_id INT UNSIGNED PRIMARY KEY,
    total_sessions INT UNSIGNED,
    avg_accuracy_pct DECIMAL(5,2),
    avg_session_score DECIMAL(8,2),
    hardest_question_id INT UNSIGNED,
    easiest_question_id INT UNSIGNED,
    save_count INT UNSIGNED,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deck_id) REFERENCES decks(deck_id) ON DELETE CASCADE,
    FOREIGN KEY (hardest_question_id) REFERENCES questions(question_id) ON DELETE SET NULL,
    FOREIGN KEY (easiest_question_id) REFERENCES questions(question_id) ON DELETE SET NULL
);