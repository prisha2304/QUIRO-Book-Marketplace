const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const { getDbConfig } = require('./config/db');

const initDB = async () => {
    const dbConfig = getDbConfig();
    const dbName = dbConfig.database || 'booknest_chatgpt_ag';
    const schemaPath = path.join(__dirname, '../schema.sql');

    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');
    let connection;

    try {
        console.log(`Connecting to database server at ${dbConfig.host}:${dbConfig.port}...`);

        // Attempt 1: Direct connection with target database (standard for TiDB Cloud & managed databases)
        try {
            connection = await mysql.createConnection({
                ...dbConfig,
                database: dbName,
                multipleStatements: true
            });
            console.log(`Connected directly to database: ${dbName}`);
        } catch (connErr) {
            // ER_BAD_DB_ERROR (1049) means the database does not exist yet; connect to server root and create it
            if (connErr.errno === 1049 || connErr.code === 'ER_BAD_DB_ERROR') {
                console.log(`Database "${dbName}" does not exist yet. Connecting to server root to create it...`);
                const rootConfig = { ...dbConfig, multipleStatements: true };
                delete rootConfig.database;
                connection = await mysql.createConnection(rootConfig);

                console.log(`Creating database "${dbName}" if not exists...`);
                await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
                await connection.query(`USE \`${dbName}\``);
            } else {
                throw connErr;
            }
        }

        console.log('Reading and applying base schema (schema.sql)...');
        await connection.query(schema);
        console.log('✔ Base database schema initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
};

if (require.main === module) {
    initDB()
        .then(() => {
            console.log('✔ Database initialization completed.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Database initialization failed:', err.message);
            process.exit(1);
        });
}

module.exports = { initDB };
