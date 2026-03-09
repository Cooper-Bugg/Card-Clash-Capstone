/*
Used for database connection only, not query execution
*/
require('dotenv').config();

// pool export is supposedly more reliable; need to refine this part of the code
import { createPool } from "mysql2/promise";

export const pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});