/*
Used for database connection only, not query execution
*/
//require('dotenv').config();

// pool export is supposedly more reliable; need to refine this part of the code
/*
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

export { pool };
*/


const path = require("path");
const mysql = require('mysql2/promise');

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = mysql.createPool({
    host: process.env.DB_HOST,//'localhost',//
    user: process.env.DB_USER,//'root',//
    password: process.env.DB_PASSWORD,//'K#33sh8r/s1ng3n71t6',//
    database: process.env.DB_DATABASE//'cardclash_db'//
});

module.exports = { pool }

