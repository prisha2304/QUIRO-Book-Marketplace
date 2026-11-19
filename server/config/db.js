const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

function getDbConfig() {
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const host = process.env.DB_HOST || 'localhost';
    const isTiDB = (host && host.includes('tidbcloud.com')) || port === 4000;
    const enableSSL = process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' || isTiDB;

    const config = {
        host: host,
        port: port,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'booknest_chatgpt_ag',
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
        queueLimit: 0
    };

    if (enableSSL) {
        config.ssl = {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        };
    }

    return config;
}

const pool = mysql.createPool(getDbConfig());

const connectDB = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('MySQL Connected...');
        connection.release();
    } catch (error) {
        console.error('MySQL connection error:', error.message);
        process.exit(1);
    }
};

module.exports = { pool, connectDB, getDbConfig };
