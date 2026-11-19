const { pool } = require('../config/db');

async function migrateSwapTwoParty() {
    console.log('--- Starting Swap Two-Party Migration ---');
    const conn = await pool.getConnection();

    try {
        const [cols] = await conn.query('DESCRIBE swap_requests');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('requester_confirmed')) {
            console.log('Adding requester_confirmed column to swap_requests...');
            await conn.query('ALTER TABLE swap_requests ADD COLUMN requester_confirmed TINYINT(1) DEFAULT 0');
            console.log('Added requester_confirmed column.');
        } else {
            console.log('requester_confirmed column already exists.');
        }

        if (!colNames.includes('owner_confirmed')) {
            console.log('Adding owner_confirmed column to swap_requests...');
            await conn.query('ALTER TABLE swap_requests ADD COLUMN owner_confirmed TINYINT(1) DEFAULT 0');
            console.log('Added owner_confirmed column.');
        } else {
            console.log('owner_confirmed column already exists.');
        }

        // Also check payment_refunds table has admin_notes
        const [refundCols] = await conn.query('DESCRIBE payment_refunds');
        const refundColNames = refundCols.map(c => c.Field);

        if (!refundColNames.includes('admin_notes')) {
            console.log('Adding admin_notes column to payment_refunds...');
            await conn.query('ALTER TABLE payment_refunds ADD COLUMN admin_notes TEXT NULL');
            console.log('Added admin_notes column.');
        }

        console.log('✔ Swap two-party migration completed successfully.');
    } catch (err) {
        console.error('❌ Swap two-party migration failed:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrateSwapTwoParty()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { migrate: migrateSwapTwoParty, migrateSwapTwoParty };
