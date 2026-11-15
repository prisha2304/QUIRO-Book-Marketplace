const { pool } = require('../config/db');

async function runMigration() {
    console.log('--- Starting Managed Exchange v2 Migration ---');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Inspect swap_addresses columns
        const [addrCols] = await connection.execute('DESCRIBE swap_addresses');
        const addrColNames = addrCols.map(c => c.Field);

        const addAddrColIfMissing = async (col, def) => {
            if (!addrColNames.includes(col)) {
                console.log(`Adding column ${col} to swap_addresses...`);
                await connection.execute(`ALTER TABLE swap_addresses ADD COLUMN ${col} ${def}`);
            }
        };

        await addAddrColIfMissing('pickup_address', 'TEXT NULL');
        await addAddrColIfMissing('delivery_address', 'TEXT NULL');
        await addAddrColIfMissing('delivery_instructions', 'TEXT NULL');
        await addAddrColIfMissing('confirmed_at', 'DATETIME NULL');

        // Migrate existing address_line1 data into pickup_address and delivery_address if needed
        await connection.execute(`
            UPDATE swap_addresses 
            SET pickup_address = COALESCE(pickup_address, address_line1),
                delivery_address = COALESCE(delivery_address, address_line1)
            WHERE address_line1 IS NOT NULL AND (pickup_address IS NULL OR delivery_address IS NULL)
        `);

        // 2. Inspect swap_requests columns
        const [reqCols] = await connection.execute('DESCRIBE swap_requests');
        const reqColNames = reqCols.map(c => c.Field);

        const addReqColIfMissing = async (col, def) => {
            if (!reqColNames.includes(col)) {
                console.log(`Adding column ${col} to swap_requests...`);
                await connection.execute(`ALTER TABLE swap_requests ADD COLUMN ${col} ${def}`);
            }
        };

        await addReqColIfMissing('requester_confirmed_at', 'DATETIME NULL');
        await addReqColIfMissing('owner_confirmed_at', 'DATETIME NULL');
        await addReqColIfMissing('pickup_date', 'DATETIME NULL');
        await addReqColIfMissing('delivery_notes', 'TEXT NULL');

        await connection.commit();
        console.log('--- Managed Exchange v2 Migration completed successfully! ---');
        process.exit(0);
    } catch (err) {
        await connection.rollback();
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        connection.release();
    }
}

runMigration();

