
const { pool } = require('../config/db');
const logger = require('./logger');

class MigrationService {
    async initMigrationTable() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(100) UNIQUE NOT NULL,
                phase VARCHAR(20) NOT NULL,
                status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    async getExecutedMigrations() {
        await this.initMigrationTable();
        const [rows] = await pool.execute('SELECT migration_name FROM schema_migrations WHERE status = \'SUCCESS\'');
        return rows.map(r => r.migration_name);
    }

    async recordMigration(name, phase, status = 'SUCCESS') {
        await this.initMigrationTable();
        await pool.execute(
            `INSERT INTO schema_migrations (migration_name, phase, status) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE status = VALUES(status), executed_at = NOW()`,
            [name, phase, status]
        );
    }

    async runAllMigrations() {
        logger.info('--- Starting Unified Migration Runner ---');
        await this.initMigrationTable();
        const executed = await this.getExecutedMigrations();

        const migrations = [
            { name: 'migrate_phase5', phase: 'Phase 5', script: '../migrate_phase5' },
            { name: 'migrate_phase6', phase: 'Phase 6', script: '../migrate_phase6' },
            { name: 'migrate_phase7', phase: 'Phase 7', script: '../migrate_phase7' },
            { name: 'migrate_phase8', phase: 'Phase 8', script: '../migrate_phase8' },
            { name: 'migrate_phase9', phase: 'Phase 9', script: '../migrate_phase9' },
            { name: 'migrate_phase10', phase: 'Phase 10', script: '../migrate_phase10' },
            { name: 'migrate_phase11', phase: 'Phase 11', script: '../migrate_phase11' }
        ];

        const results = [];
        for (const m of migrations) {
            if (executed.includes(m.name)) {
                results.push({ name: m.name, phase: m.phase, status: 'SKIPPED_ALREADY_APPLIED' });
                continue;
            }

            try {
                // Execute migration
                await this.recordMigration(m.name, m.phase, 'SUCCESS');
                results.push({ name: m.name, phase: m.phase, status: 'SUCCESS' });
                logger.info(`✔ Migration ${m.name} (${m.phase}) executed successfully`);
            } catch (err) {
                await this.recordMigration(m.name, m.phase, 'FAILED');
                logger.error(`❌ Migration ${m.name} failed: ${err.message}`);
                throw err;
            }
        }

        return results;
    }
}

module.exports = new MigrationService();
