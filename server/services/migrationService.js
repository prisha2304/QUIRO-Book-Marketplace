const path = require('path');
const { pool } = require('../config/db');
const logger = require('./logger');
const { initDB } = require('../init-db');

class MigrationService {
    async initMigrationTable() {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(100) UNIQUE NOT NULL,
                phase VARCHAR(50) NOT NULL,
                status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    async getExecutedMigrations() {
        await this.initMigrationTable();
        const [rows] = await pool.execute("SELECT migration_name FROM schema_migrations WHERE status = 'SUCCESS'");
        return rows.map(r => r.migration_name);
    }

    async recordMigration(name, phase, status = 'SUCCESS') {
        await this.initMigrationTable();
        await pool.execute(
            `INSERT INTO schema_migrations (migration_name, phase, status, executed_at) 
             VALUES (?, ?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE status = VALUES(status), phase = VALUES(phase), executed_at = NOW()`,
            [name, phase, status]
        );
    }

    async isBaseSchemaInitialized() {
        try {
            const [rows] = await pool.query("SHOW TABLES LIKE 'users'");
            return rows.length > 0;
        } catch {
            return false;
        }
    }

    async ensureBaseSchema() {
        const initialized = await this.isBaseSchemaInitialized();
        if (!initialized) {
            logger.info('Base schema not detected. Initializing base schema from schema.sql...');
            await initDB();
            logger.info('✔ Base schema initialized successfully.');
        }
    }

    async executeMigration(m) {
        const scriptPath = path.resolve(__dirname, m.script);
        const mod = require(scriptPath);
        const runner = typeof mod === 'function' 
            ? mod 
            : (mod.migrate || mod.runMigration || mod.migratePhase18 || mod.migratePhase11 || 
               mod.migratePhase10 || mod.migratePhase9 || mod.migratePhase8 || mod.migratePhase7 || 
               mod.migratePhase6 || mod.migratePhase5 || mod.migrateSwapTwoParty);

        if (typeof runner !== 'function') {
            throw new Error(`Migration module "${m.name}" does not export an executable runner function`);
        }

        await runner();
    }

    async runAllMigrations(options = { ensureBase: true }) {
        logger.info('--- Starting Unified Migration Runner ---');

        if (options && options.ensureBase) {
            await this.ensureBaseSchema();
        }

        await this.initMigrationTable();
        const executed = await this.getExecutedMigrations();

        // Strict Dependency Ordering
        const migrations = [
            { name: 'migrate_phase5', phase: 'Phase 5', script: '../migrate_phase5' },
            { name: 'migrate_phase6', phase: 'Phase 6', script: '../migrate_phase6' },
            { name: 'migrate_phase7', phase: 'Phase 7', script: '../migrate_phase7' },
            { name: 'migrate_phase8', phase: 'Phase 8', script: '../migrate_phase8' },
            { name: 'migrate_phase9', phase: 'Phase 9', script: '../migrate_phase9' },
            { name: 'migrate_phase10', phase: 'Phase 10', script: '../migrate_phase10' },
            { name: 'migrate_phase11', phase: 'Phase 11', script: '../migrate_phase11' },
            { name: 'migrate_swap_two_party', phase: 'Swap Two-Party', script: '../migrations/migrate_swap_two_party' },
            { name: 'migrate_swap_exchange_methods', phase: 'Swap Exchange Methods', script: '../migrations/migrate_swap_exchange_methods' },
            { name: 'migrate_managed_exchange_v2', phase: 'Swap Managed Exchange v2', script: '../migrations/migrate_managed_exchange_v2' },
            { name: 'migrate_phase18', phase: 'Phase 18', script: '../migrate_phase18' }
        ];

        const results = [];
        for (const m of migrations) {
            if (executed.includes(m.name)) {
                results.push({ name: m.name, phase: m.phase, status: 'SKIPPED_ALREADY_APPLIED' });
                continue;
            }

            logger.info(`▶ Executing migration ${m.name} (${m.phase})...`);

            try {
                // 1. Execute database migration operations FIRST
                await this.executeMigration(m);

                // 2. Record SUCCESS only after successful execution
                await this.recordMigration(m.name, m.phase, 'SUCCESS');
                results.push({ name: m.name, phase: m.phase, status: 'SUCCESS' });
                logger.info(`✔ Migration ${m.name} (${m.phase}) executed successfully`);
            } catch (err) {
                // 3. Record FAILED status in schema_migrations table
                try {
                    await this.recordMigration(m.name, m.phase, 'FAILED');
                } catch (recErr) {
                    logger.error(`Failed to record failure status in schema_migrations for ${m.name}: ${recErr.message}`);
                }

                results.push({ name: m.name, phase: m.phase, status: 'FAILED', error: err.message });
                logger.error(`❌ Migration ${m.name} (${m.phase}) failed: ${err.message}`);

                // Halt further migration execution immediately to prevent executing dependent migrations
                throw new Error(`Migration ${m.name} (${m.phase}) failed: ${err.message}`);
            }
        }

        return results;
    }
}

module.exports = new MigrationService();
