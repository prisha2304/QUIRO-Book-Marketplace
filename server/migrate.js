require('dotenv').config();
const migrationService = require('./services/migrationService');

async function main() {
    try {
        console.log('🚀 Running QUIRO Unified Database Migrations...');
        const results = await migrationService.runAllMigrations();
        console.table(results);
        console.log('✔ All migrations completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failure:', e.message || e);
        process.exit(1);
    }
}

main();
