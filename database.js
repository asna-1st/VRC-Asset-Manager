const Database = require('better-sqlite3');
const path = require('path');

function initDb(customPath) {
    const dbPath = customPath || path.join(__dirname, 'assets.db');
    const db = new Database(dbPath);

    // Main assets table
    db.exec(`
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('Avatar', 'Outfit', 'Accessory', 'Texture', 'Hair', 'Miscellaneous')),
            thumbnail_url TEXT,
            gallery_urls TEXT,
            video_url TEXT,
            booth_link TEXT,
            nsfw INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    ensureAssetsColumns(db);
    migrateAssetsCategoryCheck(db);

    // Files associated with assets
    db.exec(`
        CREATE TABLE IF NOT EXISTS asset_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            is_resource INTEGER DEFAULT 0,
            resource_name TEXT,
            FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS file_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            target_asset_id INTEGER,
            manual_name TEXT,
            FOREIGN KEY (file_id) REFERENCES asset_files(id) ON DELETE CASCADE,
            FOREIGN KEY (target_asset_id) REFERENCES assets(id) ON DELETE SET NULL
        )
    `);

    return db;
}

function ensureAssetsColumns(db) {
    const columns = db.pragma('table_info(assets)').map(r => r.name);
    
    if (!columns.includes('gallery_urls')) {
        db.exec("ALTER TABLE assets ADD COLUMN gallery_urls TEXT");
    }
    if (!columns.includes('video_url')) {
        db.exec("ALTER TABLE assets ADD COLUMN video_url TEXT");
    }
    if (!columns.includes('nsfw')) {
        db.exec("ALTER TABLE assets ADD COLUMN nsfw INTEGER DEFAULT 0");
    }
}

function migrateAssetsCategoryCheck(db) {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='assets'").get();
    if (!row || !row.sql || row.sql.includes('Miscellaneous')) {
        return;
    }

    const createSql = `
        CREATE TABLE assets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('Avatar', 'Outfit', 'Accessory', 'Texture', 'Hair', 'Miscellaneous')),
            thumbnail_url TEXT,
            gallery_urls TEXT,
            video_url TEXT,
            booth_link TEXT,
            nsfw INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    const copySql = `
        INSERT INTO assets_new (id, name, category, thumbnail_url, gallery_urls, video_url, booth_link, nsfw, created_at)
        SELECT id, name, category, thumbnail_url, gallery_urls, video_url, booth_link, nsfw, created_at FROM assets;
    `;

    db.transaction(() => {
        db.exec(createSql);
        db.exec(copySql);
        db.exec("DROP TABLE assets");
        db.exec("ALTER TABLE assets_new RENAME TO assets");
    })();
}

module.exports = { initDb };
