import { Pool } from 'pg';

/**
 * Auto-migration runner for the YSM Attendance system.
 * Runs pending SQL migrations on server startup.
 * Tracks which migrations have been applied via a `_migrations` table.
 */

const MIGRATIONS: { name: string; sql: string }[] = [];

export async function runMigrations() {
    // Prefer direct connection for migrations (triggers/DO blocks may not work through PgBouncer)
    const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

    const isLocalhost =
        dbUrl?.includes('localhost') ||
        dbUrl?.includes('127.0.0.1');

    const pool = new Pool({
        connectionString: dbUrl,
        ...(isLocalhost ? {} : { ssl: { rejectUnauthorized: false } }),
    });

    const client = await pool.connect();
    try {
        // Create migrations tracking table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS _migrations (
                name VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check which migrations have been applied
        const applied = await client.query('SELECT name FROM _migrations');
        const appliedNames = new Set(applied.rows.map((r: { name: string }) => r.name));

        for (const migration of MIGRATIONS) {
            if (appliedNames.has(migration.name)) {
                continue; // Already applied
            }

            console.log(`[Migration] Running: ${migration.name}...`);
            try {
                await client.query(migration.sql);
                await client.query(
                    'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
                    [migration.name]
                );
                console.log(`[Migration] ✅ ${migration.name} applied successfully`);
            } catch (err) {
                console.error(`[Migration] ❌ ${migration.name} failed:`, err);
                // Don't throw - let the app continue even if migration fails
            }
        }

        console.log('[Migration] All migrations checked.');
    } catch (err) {
        console.error('[Migration] Migration runner error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
