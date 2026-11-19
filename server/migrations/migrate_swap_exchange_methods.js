const { pool } = require('../config/db');

async function runMigration() {
    console.log('--- Starting Swap Exchange Methods Migration ---');
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Inspect existing columns in swap_requests
        const [existingColumns] = await connection.execute('DESCRIBE swap_requests');
        const colNames = existingColumns.map(c => c.Field);
        console.log('Existing swap_requests columns:', colNames.join(', '));

        // 2. Modify status column to VARCHAR(50) so it's not constrained by old ENUM
        console.log('Modifying status column to VARCHAR(50)...');
        await connection.execute('ALTER TABLE swap_requests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT "pending"');

        // Helper to add column if missing
        const addColumnIfMissing = async (colName, colDef) => {
            if (!colNames.includes(colName)) {
                console.log(`Adding column ${colName}...`);
                await connection.execute(`ALTER TABLE swap_requests ADD COLUMN ${colName} ${colDef}`);
            } else {
                console.log(`Column ${colName} already exists.`);
            }
        };

        await addColumnIfMissing('exchange_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('requester_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('owner_method', 'VARCHAR(50) NULL');
        await addColumnIfMissing('method_agreed', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('requester_consent', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_consent', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('shipping_fee_per_user', 'DECIMAL(10,2) DEFAULT 79.00');
        await addColumnIfMissing('requester_paid', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_paid', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('collection_date', 'DATETIME NULL');
        await addColumnIfMissing('delivery_date', 'DATETIME NULL');
        await addColumnIfMissing('courier_tracking', 'VARCHAR(100) NULL');
        await addColumnIfMissing('courier_status', 'VARCHAR(50) NULL');
        await addColumnIfMissing('requester_confirmed', 'TINYINT(1) DEFAULT 0');
        await addColumnIfMissing('owner_confirmed', 'TINYINT(1) DEFAULT 0');

        // 3. Create swap_addresses table
        console.log('Creating swap_addresses table if not exists...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_addresses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                user_id INT NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                address_line1 TEXT NOT NULL,
                city VARCHAR(100) NOT NULL,
                state VARCHAR(100) NOT NULL,
                postal_code VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_swap_user (swap_id, user_id),
                INDEX idx_swap_id (swap_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Create swap_payments table
        console.log('Creating swap_payments table if not exists...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                user_id INT NOT NULL,
                role VARCHAR(20) NOT NULL,
                razorpay_order_id VARCHAR(100) NOT NULL,
                razorpay_payment_id VARCHAR(100) NULL,
                razorpay_signature VARCHAR(255) NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 79.00,
                status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                refund_id VARCHAR(100) NULL,
                refund_amount DECIMAL(10,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_swap_payment (swap_id, user_id),
                INDEX idx_razorpay_order (razorpay_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. Create swap_timeline table
        console.log('Creating swap_timeline table if not exists...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS swap_timeline (
                id INT AUTO_INCREMENT PRIMARY KEY,
                swap_id INT NOT NULL,
                status VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                actor_id INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_timeline_swap (swap_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.commit();
        console.log('--- Migration completed successfully! ---');
    } catch (err) {
        await connection.rollback();
        console.error('Migration failed:', err);
        throw err;
    } finally {
        connection.release();
    }
}

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = { migrate: runMigration, runMigration };

