const { app, BrowserWindow, ipcMain, protocol, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { initDb } = require('./database');

// Global error handling to exit the app on unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Critical Error', `A critical error occurred and the application must close.\n\n${error.message}`);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    dialog.showErrorBox('Critical Error', `An unhandled promise rejection occurred and the application must close.\n\n${reason}`);
    app.quit();
});

let mainWindow;
let db;

// Determination of portable mode
const appPath = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const portableIniPath = path.join(appPath, 'portable.ini');
const isPortable = fs.existsSync(portableIniPath);

let portableAssetsRelativePath = 'assets';
if (isPortable) {
    // Specify a dedicated folder for userData to keep the root clean
    const userDataPath = path.join(appPath, 'data');
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });

        // Migrate existing config.json if found in root
        const oldConfigPath = path.join(appPath, 'config.json');
        if (fs.existsSync(oldConfigPath)) {
            try {
                fs.renameSync(oldConfigPath, path.join(userDataPath, 'config.json'));
            } catch (err) {
                console.error('Migration of config.json failed:', err);
            }
        }
    }
    app.setPath('userData', userDataPath);
    
    // Read relative path from portable.ini
    try {
        const iniContent = fs.readFileSync(portableIniPath, 'utf8').trim();
        if (iniContent) {
            portableAssetsRelativePath = iniContent;
        } else {
            // If empty, write default back
            fs.writeFileSync(portableIniPath, portableAssetsRelativePath);
        }
    } catch (err) {
        console.error('Error reading portable.ini:', err);
    }
}

// App configuration management
const configPath = path.join(app.getPath('userData'), 'config.json');
const defaultAssetsPath = isPortable ? path.join(appPath, portableAssetsRelativePath) : path.join(app.getPath('userData'), 'assets');
const defaultDbPath = path.join(defaultAssetsPath, 'assets.db');

// Ensure assets directory exists in portable mode
if (isPortable && !fs.existsSync(defaultAssetsPath)) {
    try {
        fs.mkdirSync(defaultAssetsPath, { recursive: true });
        console.log('Auto-generated assets folder at:', defaultAssetsPath);
    } catch (err) {
        console.error('Failed to auto-generate assets folder:', err);
    }
}

let config = {
    assetsPath: defaultAssetsPath,
    dbPath: defaultDbPath,
    theme: 'dark',
    accentColor: '#6366f1',
    firstRun: !isPortable // Skip setup in portable mode
};

function normalizeConfigPaths() {
    if (!config.assetsPath || typeof config.assetsPath !== 'string') {
        config.assetsPath = defaultAssetsPath;
    }
    if (!config.dbPath || typeof config.dbPath !== 'string') {
        config.dbPath = defaultDbPath;
    }
    if (!path.isAbsolute(config.assetsPath)) {
        config.assetsPath = path.isAbsolute(config.assetsPath) ? config.assetsPath : path.join(isPortable ? appPath : app.getPath('userData'), config.assetsPath);
    }
    if (!path.isAbsolute(config.dbPath)) {
        config.dbPath = path.isAbsolute(config.dbPath) ? config.dbPath : path.join(isPortable ? appPath : app.getPath('userData'), config.dbPath);
    }

    const dbDir = path.dirname(config.dbPath);
    const assetsDb = path.join(dbDir, 'assets.db');
    if (path.basename(config.dbPath) === 'database.sqlite' && !fs.existsSync(config.dbPath) && fs.existsSync(assetsDb)) {
        config.dbPath = assetsDb;
    }

    if (config.dbPath.startsWith(__dirname) && !fs.existsSync(config.dbPath)) {
        config.dbPath = defaultDbPath;
    }
}

function loadConfig() {
    if (fs.existsSync(configPath)) {
        try {
            const data = fs.readFileSync(configPath, 'utf8');
            config = { ...config, ...JSON.parse(data) };
            if (typeof config.firstRun !== 'boolean') {
                config.firstRun = false;
            }
            normalizeConfigPaths();
            console.log('Configuration loaded:', config);
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    } else {
        config.firstRun = !isPortable;
        normalizeConfigPaths();
        saveConfig();
        console.log('Default configuration saved (Portable:', isPortable, ')');
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Error saving config:', err);
    }
}

// Load config early
loadConfig();

// Helper to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
    if (!fs.existsSync(dirPath)) return [];
    
    const files = fs.readdirSync(dirPath);
    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}

// Initialize database
function initializeDatabase() {
    try {
        // Ensure directory for DB exists
        const dbDir = path.dirname(config.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        db = initDb(config.dbPath);

        console.log('Database initialized successfully at:', config.dbPath);
    } catch (err) {
        console.error('Failed to initialize database:', err);
        app.quit();
    }
}


function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}

function createWindow() {
    console.log('Creating main window...');
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        frame: false,
        backgroundColor: '#09090b'
    });

    // Register protocol for serving local files
    protocol.handle('app', (request) => {
        const urlPath = request.url.slice('app://'.length);
        // Serve from configured assets path if it's an upload
        if (urlPath.startsWith('uploads/')) {
            const relativePath = urlPath.slice('uploads/'.length);
            const fullPath = path.resolve(config.assetsPath, relativePath);
            const basePath = path.resolve(config.assetsPath) + path.sep;
            if (!fullPath.startsWith(basePath)) {
                return net.fetch('data:text/plain,Invalid%20path');
            }
            return net.fetch(`file://${fullPath}`);
        }
        // Fallback to app root
        const fullPath = path.resolve(__dirname, urlPath);
        const basePath = path.resolve(__dirname) + path.sep;
        if (!fullPath.startsWith(basePath)) {
            return net.fetch('data:text/plain,Invalid%20path');
        }
        return net.fetch(`file://${fullPath}`);
    });

    // Load the app - React build output
    const reactIndexPath = path.join(__dirname, 'dist-react', 'index.html');
    
    if (fs.existsSync(reactIndexPath)) {
        mainWindow.loadFile(reactIndexPath);
    } else {
        console.error('React build not found at:', reactIndexPath);
    }
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`Failed to load: ${errorCode} - ${errorDescription}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Main window finished loading');
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        const levelStr = levels[level] || 'LOG';
        console.log(`[RENDERER ${levelStr}] ${message} (${sourceId}:${line})`);
    });

    mainWindow.show();
    console.log('Main window shown');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle renderer process crashes
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error('Renderer process gone:', details);
        if (details.reason !== 'clean-exit') {
            dialog.showErrorBox('Renderer Process Error', `The renderer process has crashed (${details.reason}). The application will now close.`);
            app.quit();
        }
    });

    // Handle child process crashes
    app.on('child-process-gone', (event, details) => {
        console.error('Child process gone:', details);
        if (details.reason !== 'clean-exit') {
            dialog.showErrorBox('Process Error', `A child process has crashed (${details.reason}). The application will now close.`);
            app.quit();
        }
    });
}

// Helper functions for synchronous database operations
function dbRun(sql, params = []) {
    const result = db.prepare(sql).run(params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
}

function dbGet(sql, params = []) {
    return db.prepare(sql).get(params);
}

function dbAll(sql, params = []) {
    return db.prepare(sql).all(params);
}

function dbExec(sql) {
    db.exec(sql);
}

// Auto-link assets to a new avatar
function autoLinkAvatars(avatarName, avatarId) {
    if (!avatarName || !avatarId) return;
    
    console.log(`Auto-linking assets to avatar: ${avatarName} (ID: ${avatarId})`);
    dbRun(
        'UPDATE file_links SET target_asset_id = ?, manual_name = NULL WHERE LOWER(manual_name) = LOWER(?) AND target_asset_id IS NULL',
        [avatarId, avatarName]
    );
}

// Utility for notifications (disabled - use in-app only)
function showAppNotification(title, body, type = 'info') {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-toast', { title, body, type });
    } else {
        console.log('Toast suppressed (no window):', title, body);
    }
}

// Utility for path resolution respecting assetsPath
function getFullPath(dbRelativePath) {
    if (!dbRelativePath) return '';
    if (dbRelativePath.startsWith('/uploads/')) {
        const relativePath = dbRelativePath.slice('/uploads/'.length);
        return path.resolve(config.assetsPath, relativePath);
    }
    return path.resolve(__dirname, dbRelativePath);
}

function isWithinBase(targetPath, basePath) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath) + path.sep;
    return resolvedTarget.startsWith(resolvedBase);
}

// Window Controls
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// IPC Handlers for API functionality

// App Info
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('open-external', async (event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
});

ipcMain.handle('get-latest-version', async () => {
    try {
        const response = await fetch('https://api.github.com/repos/asna-1st/VRC-Asset-Manager/releases/latest');
        if (!response.ok) throw new Error('GitHub API request failed');
        const data = await response.json();
        return {
            tag: data.tag_name.replace(/^v/, ''),
            url: data.html_url
        };
    } catch (err) {
        console.error('Error fetching latest version:', err);
        return null;
    }
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select Asset File'
    });
    
    if (result.canceled) return null;
    const filePath = result.filePaths[0];
    return {
        path: filePath,
        name: path.basename(filePath)
    };
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Assets Data Folder'
    });
    
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('validate-assets-folder', async (event, folderPath) => {
    try {
        if (!folderPath) return { ok: false, error: 'Folder path is required.' };
        if (!fs.existsSync(folderPath)) return { ok: false, error: 'Folder does not exist.' };
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) return { ok: false, error: 'Path is not a directory.' };

        const testFile = path.join(folderPath, `.vrcassetmanager_write_test_${Date.now()}`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);

        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message || 'Folder is not writable.' };
    }
});

// Config Handlers
ipcMain.handle('get-config', () => config);
ipcMain.handle('set-config', (event, newConfig) => {
    config = { ...config, ...newConfig };
    saveConfig();
    return config;
});

ipcMain.handle('notify', (event, { title, body }) => {
    showAppNotification(title, body);
});

// Assets Location Change & Migration
ipcMain.handle('change-assets-location', async (event, { newPath, mode }) => {
    console.log(`IPC: change-assets-location to ${newPath} mode: ${mode}`);
    
    try {
        
        const newAssetsPath = newPath;
        const newDbPath = path.join(newPath, 'assets.db');

        if (mode === 'migrate') {
            const oldPath = config.assetsPath;
            const oldDbPath = config.dbPath;
            const files = getAllFiles(oldPath);
            let migratedCount = 0;

            closeDatabase();

            // Move the database file first if it exists in the old path
            if (fs.existsSync(oldDbPath)) {
                if (!fs.existsSync(newAssetsPath)) {
                    fs.mkdirSync(newAssetsPath, { recursive: true });
                }
                fs.copyFileSync(oldDbPath, newDbPath);
                fs.unlinkSync(oldDbPath);
            }

            for (const oldFilePath of files) {
                // Skip the database file if it was already moved
                if (oldFilePath === oldDbPath) continue;

                const relativePath = path.relative(oldPath, oldFilePath);
                const newFilePath = path.join(newAssetsPath, relativePath);
                
                // Ensure directory exists
                const newFileDir = path.dirname(newFilePath);
                if (!fs.existsSync(newFileDir)) {
                    fs.mkdirSync(newFileDir, { recursive: true });
                }

                // Copy file asynchronously
                await fs.promises.copyFile(oldFilePath, newFilePath);
                // Delete original after successful copy
                await fs.promises.unlink(oldFilePath);
                
                migratedCount++;
                const progress = Math.round((migratedCount / files.length) * 100);
                mainWindow.webContents.send('migration-progress', {
                    progress,
                    status: `Moving: ${path.basename(oldFilePath)} (${migratedCount}/${files.length})`
                });
            }

            // Cleanup old empty directories
            const cleanupDirs = (dir) => {
                if (!fs.existsSync(dir)) return;
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        cleanupDirs(fullPath);
                    }
                }
                if (fs.readdirSync(dir).length === 0 && dir !== oldPath) {
                    fs.rmdirSync(dir);
                }
            };
            cleanupDirs(oldPath);

            config.assetsPath = newAssetsPath;
            config.dbPath = newDbPath;
            saveConfig();
            
            if (isPortable) {
                const relativePath = path.relative(appPath, newAssetsPath);
                if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                    fs.writeFileSync(portableIniPath, relativePath);
                } else {
                    fs.writeFileSync(portableIniPath, newAssetsPath);
                }
            }
            
            initializeDatabase();
            
            showAppNotification('Migration Complete', 'Your library has been successfully moved.');
            return { success: true };
        }

        if (mode === 'fresh') {
            closeDatabase();
            
            // Just update paths and re-init
            if (!fs.existsSync(newAssetsPath)) {
                fs.mkdirSync(newAssetsPath, { recursive: true });
            }
            config.assetsPath = newAssetsPath;
            config.dbPath = newDbPath;
            saveConfig();
            
            if (isPortable) {
                const relativePath = path.relative(appPath, newAssetsPath);
                if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                    fs.writeFileSync(portableIniPath, relativePath);
                } else {
                    fs.writeFileSync(portableIniPath, newAssetsPath);
                }
            }
            
            initializeDatabase();
            
            showAppNotification('Storage Updated', 'Application is now using a new storage location.');
            return { success: true };
        }
    } catch (err) {
        console.error('Migration failed:', err);
        // Try to recover if possible (re-init old DB)
        if (!db) initializeDatabase();
        throw err;
    }
});

// Import assets from another library folder
ipcMain.handle('import-library', async (event, { sourcePath, mode }) => {
    console.log(`IPC: import-library from ${sourcePath} mode: ${mode}`);
    
    let sourceDb;
    try {
        const sourceDbPath = path.join(sourcePath, 'assets.db');
        if (!fs.existsSync(sourceDbPath)) {
            throw new Error('Source folder does not contain an assets.db file.');
        }

        // Open source DB as read-only
        sourceDb = new Database(sourceDbPath, { readonly: true });
        
        const sourceAssets = sourceDb.prepare('SELECT * FROM assets').all();
        const totalAssets = sourceAssets.length;
        let processedAssets = 0;
        
        // Mapping to maintain links within the imported batch
        const idMapping = new Map();

        dbExec('BEGIN TRANSACTION');

        for (const asset of sourceAssets) {
            // 1. Insert asset
            const assetResult = dbRun(
                'INSERT INTO assets (name, category, thumbnail_url, gallery_urls, video_url, booth_link, nsfw, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [asset.name, asset.category, asset.thumbnail_url, asset.gallery_urls, asset.video_url, asset.booth_link, asset.nsfw, asset.created_at]
            );
            const newAssetId = assetResult.lastID;
            idMapping.set(asset.id, newAssetId);

            // 2. Process files
            const sourceFiles = sourceDb.prepare('SELECT * FROM asset_files WHERE asset_id = ?').all(asset.id);
            for (const file of sourceFiles) {
                const relativePath = file.file_path.startsWith('/uploads/') ? file.file_path.slice('/uploads/'.length) : file.file_path;
                const srcFilePath = path.join(sourcePath, relativePath);
                
                let savedPath = file.file_path;
                
                if (fs.existsSync(srcFilePath)) {
                    const uploadsDir = path.join(config.assetsPath, asset.category);
                    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                    
                    const filename = `${Date.now()}_${path.basename(srcFilePath)}`;
                    const targetPath = path.join(uploadsDir, filename);
                    
                    if (mode === 'move') {
                        await fs.promises.rename(srcFilePath, targetPath);
                    } else {
                        await fs.promises.copyFile(srcFilePath, targetPath);
                    }
                    savedPath = `/uploads/${asset.category}/${filename}`;
                }

                const fileResult = dbRun(
                    'INSERT INTO asset_files (asset_id, file_path, is_resource, resource_name) VALUES (?, ?, ?, ?)',
                    [newAssetId, savedPath, file.is_resource, file.resource_name]
                );
                const newFileId = fileResult.lastID;

                // 3. Process links
                const sourceLinks = sourceDb.prepare('SELECT * FROM file_links WHERE file_id = ?').all(file.id);
                for (const link of sourceLinks) {
                    const newTargetId = link.target_asset_id ? idMapping.get(link.target_asset_id) : null;
                    dbRun(
                        'INSERT INTO file_links (file_id, target_asset_id, manual_name) VALUES (?, ?, ?)',
                        [newFileId, newTargetId || null, link.manual_name]
                    );
                }
            }

            processedAssets++;
            const progress = Math.round((processedAssets / totalAssets) * 100);
            mainWindow.webContents.send('migration-progress', {
                progress,
                status: `Importing: ${asset.name} (${processedAssets}/${totalAssets})`
            });
        }

        dbExec('COMMIT');
        sourceDb.close();

        showAppNotification('Import Complete', `${totalAssets} assets have been successfully imported.`);
        return { success: true };

    } catch (err) {
        if (db && db.inTransaction) dbExec('ROLLBACK');
        if (sourceDb) sourceDb.close();
        console.error('Import failed:', err);
        throw err;
    }
});

// Get potential link targets (Avatars only)
ipcMain.handle('get-targets', async () => {
    console.log('IPC: get-targets called');
    try {
        const targets = dbAll(`
            SELECT id, name, category 
            FROM assets 
            WHERE category = 'Avatar'
            ORDER BY name ASC
        `);
        return targets;
    } catch (err) {
        console.error('Error getting targets:', err);
        throw err;
    }
});

// Get all assets with pagination and search
ipcMain.handle('get-assets', async (event, params) => {
    const safeParams = params || {};
    const { category, search, limit = 24, offset = 0 } = safeParams;
    console.log(`IPC: get-assets called with category: ${category}, search: ${search}`);
    try {
        let query = 'SELECT * FROM assets';
        const params = [];
        const conditions = [];

        if (category && category !== 'All') {
            conditions.push('category = ?');
            params.push(category);
        }

        if (typeof search === 'string') {
            const normalized = search.trim().replace(/\s+/g, ' ');
            if (normalized) {
                const tokens = normalized.toLowerCase().split(' ');
                const tokenConds = tokens.map(() => `(
                    LOWER(name) LIKE ?
                    OR EXISTS (
                        SELECT 1
                        FROM asset_files af
                        LEFT JOIN file_links fl ON fl.file_id = af.id
                        LEFT JOIN assets ta ON ta.id = fl.target_asset_id
                        WHERE af.asset_id = assets.id
                        AND (
                            LOWER(fl.manual_name) LIKE ?
                            OR LOWER(ta.name) LIKE ?
                            OR LOWER(af.resource_name) LIKE ?
                        )
                    )
                )`);
                conditions.push(`(${tokenConds.join(' AND ')})`);
                tokens.forEach(t => {
                    const like = `%${t}%`;
                    params.push(like, like, like, like);
                });
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const sort = safeParams.sort || 'newest';
        let orderBy = 'id DESC'; // newest
        if (sort === 'oldest') orderBy = 'id ASC';
        else if (sort === 'az') orderBy = 'LOWER(name) ASC';
        else if (sort === 'za') orderBy = 'LOWER(name) DESC';

        query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const assets = dbAll(query, params);
        console.log(`IPC: get-assets returning ${assets.length} assets`);

        // Get files for each asset
        const assetsWithFiles = assets.map((asset) => {
            const files = dbAll('SELECT * FROM asset_files WHERE asset_id = ?', [asset.id]);
            const filesWithLinks = files.map((file) => {
                const links = dbAll(`
                    SELECT l.*, a.name as target_name, a.category as target_category
                    FROM file_links l
                    LEFT JOIN assets a ON l.target_asset_id = a.id
                    WHERE l.file_id = ?
                `, [file.id]);
                return { ...file, links };
            });
            return { ...asset, files: filesWithLinks };
        });

        return assetsWithFiles;
    } catch (err) {
        console.error('Error getting assets:', err);
        throw err;
    }
});

// Get avatars list for selection
ipcMain.handle('get-avatars', () => {
    try {
        const avatars = dbAll("SELECT id, name FROM assets WHERE category = 'Avatar' ORDER BY name ASC");
        return avatars;
    } catch (err) {
        console.error('Error getting avatars:', err);
        throw err;
    }
});

// Get missing avatar names (manual links not associated with an asset)
ipcMain.handle('get-missing-avatars', () => {
    try {
        const missing = dbAll(`
            SELECT DISTINCT manual_name 
            FROM file_links 
            WHERE target_asset_id IS NULL AND manual_name IS NOT NULL 
            ORDER BY manual_name ASC
        `);
        return missing.map(m => m.manual_name);
    } catch (err) {
        console.error('Error getting missing avatars:', err);
        throw err;
    }
});

// Create new asset
ipcMain.handle('create-asset', async (event, { name, category, thumbnail_url, booth_link, nsfw, files, file_avatars }) => {
    console.log(`IPC: create-asset called for ${name}, files:`, files?.map(f => ({ name: f.name, path: f.path })));
    try {
        let avatarInfos;
        if (typeof file_avatars === 'string') {
            avatarInfos = JSON.parse(file_avatars || '[]');
        } else {
            avatarInfos = file_avatars || [];
        }

        dbExec('BEGIN TRANSACTION');

        const result = dbRun(
            'INSERT INTO assets (name, category, thumbnail_url, booth_link, nsfw) VALUES (?, ?, ?, ?, ?)',
            [name, category, thumbnail_url, booth_link, nsfw ? 1 : 0]
        );
        const assetId = result.lastID;

        if (files && files.length > 0) {
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                const info = avatarInfos[index] || {};
                
                let savedPath = '';
                const transferMode = file.transferMode || 'copy';
                const sourcePath = file.path || file.sourcePath;
                const originalName = file.name || (sourcePath ? path.basename(sourcePath) : 'file');
                if (sourcePath) {
                    // Strictly use native path - copy or move the file
                    const uploadsDir = path.join(config.assetsPath, category);
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const filename = `${Date.now()}_${originalName}`;
                    const targetPath = path.join(uploadsDir, filename);
                    
                    if (!fs.existsSync(sourcePath)) {
                        console.error(`Source file missing: ${sourcePath}`);
                        continue;
                    }

                    if (transferMode === 'move') {
                        await fs.promises.rename(sourcePath, targetPath);
                    } else {
                        await fs.promises.copyFile(sourcePath, targetPath);
                    }
                    savedPath = `/uploads/${category}/${filename}`;
                }

                if (savedPath) {
                    const fileResult = dbRun(
                        'INSERT INTO asset_files (asset_id, file_path, is_resource, resource_name) VALUES (?, ?, ?, ?)',
                        [assetId, savedPath, info.is_resource ? 1 : 0, info.resource_name || null]
                    );
                    const fileId = fileResult.lastID;
                    
                    if (info.avatar_links && Array.isArray(info.avatar_links)) {
                        for (const link of info.avatar_links) {
                            dbRun('INSERT INTO file_links (file_id, target_asset_id, manual_name) VALUES (?, ?, ?)',
                                [fileId, link.target_id || null, link.manual_name || null]
                            );
                        }
                    }
                }
            }
        }

        dbExec('COMMIT');

        // If this is an avatar, auto-link any manual entries
        if (category === 'Avatar') {
            autoLinkAvatars(name, assetId);
        }

        showAppNotification('Asset Created', `Successfully created asset: ${name}`);

        const newAsset = dbGet('SELECT * FROM assets WHERE id = ?', [assetId]);
        return newAsset;
    } catch (err) {
        dbExec('ROLLBACK');
        console.error('Error creating asset:', err);
        throw err;
    }
});

// Update asset
ipcMain.handle('update-asset', async (event, { id, name, category, thumbnail_url, booth_link, nsfw, files, file_avatars }) => {
    try {
        let avatarInfos;
        if (typeof file_avatars === 'string') {
            avatarInfos = JSON.parse(file_avatars || '[]');
        } else {
            avatarInfos = file_avatars || [];
        }

        dbExec('BEGIN TRANSACTION');

        // Basic info
        dbRun('UPDATE assets SET name = ?, category = ?, thumbnail_url = ?, booth_link = ?, nsfw = ? WHERE id = ?',
            [name, category, thumbnail_url || null, booth_link || null, nsfw ? 1 : 0, id]
        );

        // Add new files if any
        if (files && files.length > 0) {
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                const info = avatarInfos[index] || {};
                
                let savedPath = '';
                const transferMode = file.transferMode || 'copy';
                const sourcePath = file.path || file.sourcePath;
                const originalName = file.name || (sourcePath ? path.basename(sourcePath) : 'file');
                if (sourcePath) {
                    // Strictly use native path - copy or move the file
                    const uploadsDir = path.join(config.assetsPath, category);
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const filename = `${Date.now()}_${originalName}`;
                    const targetPath = path.join(uploadsDir, filename);

                    if (!fs.existsSync(sourcePath)) {
                        console.error(`Source file missing: ${sourcePath}`);
                        continue;
                    }

                    if (transferMode === 'move') {
                        await fs.promises.rename(sourcePath, targetPath);
                        savedPath = `/uploads/${category}/${filename}`;
                    } else if (sourcePath && sourcePath.startsWith('/uploads/')) {
                        // Already in uploads, likely just a reference
                        savedPath = sourcePath;
                    } else {
                        await fs.promises.copyFile(sourcePath, targetPath);
                        savedPath = `/uploads/${category}/${filename}`;
                    }
                }
                if (savedPath) {
                    const fileResult = dbRun(
                        'INSERT INTO asset_files (asset_id, file_path, is_resource, resource_name) VALUES (?, ?, ?, ?)',
                        [id, savedPath, info.is_resource ? 1 : 0, info.resource_name || null]
                    );
                    const fileId = fileResult.lastID;

                    if (info.avatar_links && Array.isArray(info.avatar_links)) {
                        for (const link of info.avatar_links) {
                            dbRun('INSERT INTO file_links (file_id, target_asset_id, manual_name) VALUES (?, ?, ?)',
                                [fileId, link.target_id || null, link.manual_name || null]
                            );
                        }
                    }
                }
            }
        }

        dbExec('COMMIT');

        // If this was an avatar update, re-run auto-link in case the name changed
        if (category === 'Avatar') {
            autoLinkAvatars(name, id);
        }

        showAppNotification('Asset Updated', `Successfully updated asset: ${name}`);
        return { message: 'Asset updated successfully' };
    } catch (err) {
        dbExec('ROLLBACK');
        console.error('Error updating asset:', err);
        throw err;
    }
});

// Delete asset
ipcMain.handle('delete-asset', async (event, id) => {
    try {
        const files = dbAll('SELECT file_path FROM asset_files WHERE asset_id = ?', [id]);

        files.forEach(f => {
            const fullPath = getFullPath(f.file_path);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        });

        dbRun('DELETE FROM assets WHERE id = ?', [id]);
        return { message: 'Asset deleted successfully' };
    } catch (err) {
        console.error('Error deleting asset:', err);
        throw err;
    }
});

// Delete specific file
ipcMain.handle('delete-asset-file', async (event, id) => {
    try {
        const file = dbGet('SELECT file_path FROM asset_files WHERE id = ?', [id]);
        if (file) {
            const fullPath = getFullPath(file.file_path);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            dbRun('DELETE FROM asset_files WHERE id = ?', [id]);
        }
        return { message: 'File deleted successfully' };
    } catch (err) {
        console.error('Error deleting asset file:', err);
        throw err;
    }
});

// Update specific file link
ipcMain.handle('update-asset-file', async (event, { id, is_resource, resource_name, avatar_links }) => {
    try {
        dbExec('BEGIN TRANSACTION');
        
        dbRun('UPDATE asset_files SET is_resource = ?, resource_name = ? WHERE id = ?',
            [is_resource ? 1 : 0, resource_name || null, id]
        );
        
        if (avatar_links && Array.isArray(avatar_links)) {
            // Remove old links and add new ones
            dbRun('DELETE FROM file_links WHERE file_id = ?', [id]);
            for (const link of avatar_links) {
                dbRun('INSERT INTO file_links (file_id, target_asset_id, manual_name) VALUES (?, ?, ?)',
                    [id, link.target_id || null, link.manual_name || null]
                );
            }
        }
        
        dbExec('COMMIT');
        return { message: 'File updated successfully' };
    } catch (err) {
        dbExec('ROLLBACK');
        console.error('Error updating asset file:', err);
        throw err;
    }
});

// Open file in local system
ipcMain.handle('open-file', async (event, file_path) => {
    try {
        const { shell } = require('electron');
        const fullPath = getFullPath(file_path);
        if (!isWithinBase(fullPath, config.assetsPath)) {
            throw new Error('Access denied');
        }
        await shell.openPath(fullPath);
        return { message: 'File opened successfully' };
    } catch (err) {
        console.error('Error opening file:', err);
        throw err;
    }
});

// Get assets linked to a specific avatar
ipcMain.handle('get-avatar-assets', async (event, { id, category, sort, limit = 50, offset = 0 }) => {
    try {
        const assetId = parseInt(id);
        // Get the avatar info
        const avatar = dbGet('SELECT * FROM assets WHERE id = ? AND category = ?', [assetId, 'Avatar']);
        if (!avatar) {
            throw new Error('Avatar not found');
        }

        // Base query to find linked assets
        let countQuery = `
            SELECT COUNT(DISTINCT af.asset_id) as total
            FROM file_links fl
            JOIN asset_files af ON fl.file_id = af.id
            JOIN assets a ON af.asset_id = a.id
            WHERE fl.target_asset_id = ?
        `;
        const countParams = [assetId];

        if (category && category !== 'All') {
            countQuery += ' AND a.category = ?';
            countParams.push(category);
        }

        const totalResult = dbGet(countQuery, countParams);
        const total = totalResult ? totalResult.total : 0;

        if (total === 0) {
            return {
                avatar,
                assets: [],
                total: 0
            };
        }

        // Get assets with sorting and filtering
        let orderClause = 'a.id DESC';
        if (sort === 'oldest') orderClause = 'a.id ASC';
        else if (sort === 'az') orderClause = 'LOWER(a.name) ASC';
        else if (sort === 'za') orderClause = 'LOWER(a.name) DESC';

        let assetsQuery = `
            SELECT DISTINCT a.*
            FROM assets a
            JOIN asset_files af ON a.id = af.asset_id
            JOIN file_links fl ON af.id = fl.file_id
            WHERE fl.target_asset_id = ?
        `;
        const assetsParams = [assetId];

        if (category && category !== 'All') {
            assetsQuery += ' AND a.category = ?';
            assetsParams.push(category);
        }

        assetsQuery += ` ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
        assetsParams.push(parseInt(limit), parseInt(offset));

        const assets = dbAll(assetsQuery, assetsParams);

        // Get files for each asset
        const assetsWithFiles = assets.map((asset) => {
            const files = dbAll('SELECT * FROM asset_files WHERE asset_id = ?', [asset.id]);
            const filesWithLinks = files.map((file) => {
                const links = dbAll(`
                    SELECT l.*, a.name as target_name, a.category as target_category
                    FROM file_links l
                    LEFT JOIN assets a ON l.target_asset_id = a.id
                    WHERE l.file_id = ?
                `, [file.id]);
                return { ...file, links };
            });
            return { ...asset, files: filesWithLinks };
        });

        return {
            avatar,
            assets: assetsWithFiles,
            total
        };
    } catch (err) {
        console.error('Error getting avatar assets:', err);
        throw err;
    }
});

// Get all files from uploads directory
ipcMain.handle('get-files', async () => {
    try {
        const files = [];
        const uploadsDir = config.assetsPath;

        // Read all category directories
        if (!fs.existsSync(uploadsDir)) return { files: [] };
        const categories = fs.readdirSync(uploadsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        categories.forEach(category => {
            const categoryPath = path.join(uploadsDir, category);
            const categoryFiles = fs.readdirSync(categoryPath, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .map(dirent => {
                    const filePath = path.join(categoryPath, dirent.name);
                    const stats = fs.statSync(filePath);
                    return {
                        name: dirent.name,
                        path: `/uploads/${category}/${dirent.name}`,
                        category: category,
                        size: stats.size,
                        modified: stats.mtime
                    };
                });
            files.push(...categoryFiles);
        });

        return { files };
    } catch (err) {
        console.error('Error getting files:', err);
        throw err;
    }
});

// Delete a file
ipcMain.handle('delete-file', async (event, file_path) => {
    try {
        const fullPath = getFullPath(file_path);
        if (!isWithinBase(fullPath, config.assetsPath)) {
            throw new Error('Access denied');
        }
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return { message: 'File deleted successfully' };
        } else {
            throw new Error('File not found');
        }
    } catch (err) {
        console.error('Error deleting file:', err);
        throw err;
    }
});

// Open file location in file explorer
ipcMain.handle('open-file-location', async (event, file_path) => {
    try {
        const { shell } = require('electron');
        const fullPath = getFullPath(file_path);
        if (!isWithinBase(fullPath, config.assetsPath)) {
            throw new Error('Access denied');
        }
        shell.showItemInFolder(fullPath);
        return { message: 'File highlighted in folder successfully' };
    } catch (err) {
        console.error('Error highlighting file:', err);
        throw err;
    }
});

// Fetch metadata from Booth.pm with advanced gallery/video extraction
ipcMain.handle('fetch-metadata', async (event, url) => {
    try {
        console.log(`Fetching Booth metadata for: ${url}`);
        
        // Step 1: Parse the Item ID
        const idMatch = url.match(/\/items\/(\d+)/);
        if (!idMatch) throw new Error('Invalid Booth URL. Could not find Item ID.');
        const itemId = idMatch[1];
        
        const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html'
        };

        let result = {
            item_id: itemId,
            images: [],
            video: null,
            thumbnail_url: null
        };

        // Step 2 & 3: Try JSON API first
        try {
            const jsonUrl = `https://booth.pm/en/items/${itemId}.json`;
            const response = await fetch(jsonUrl, { headers });
            
            if (response.ok) {
                const data = await response.json();
                
                // Extract images
                if (data.images && Array.isArray(data.images)) {
                    result.images = data.images.map(img => img.original).filter(Boolean);
                }
                
                // Extract video from embeds (can be array or object with items)
                const embeds = data.embeds && (Array.isArray(data.embeds) ? data.embeds : data.embeds.items);
                if (embeds && Array.isArray(embeds) && embeds.length > 0) {
                    const firstEmbed = embeds[0];
                    if (typeof firstEmbed === 'string') {
                        result.video_embed_html = firstEmbed;
                        const srcMatch = firstEmbed.match(/src="([^"]+)"/);
                        if (srcMatch) {
                            result.video = srcMatch[1];
                            console.log(`Extracted video URL from embeds: ${result.video}`);
                        }
                    }
                }
                
                // Fallback: check for video_embed_url or embed_video_url fields (legacy support)
                if (!result.video) {
                    result.video = data.video_embed_url || data.embed_video_url || null;
                }
                
                // Fallback: extract from description
                if (!result.video && data.description) {
                    const ytMatch = data.description.match(/https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+/);
                    if (ytMatch) result.video = ytMatch[0];
                }
            }
        } catch (jsonErr) {
            console.warn('JSON API fetch failed, falling back to HTML scraping', jsonErr);
        }

        // Step 4: Fallback to HTML if needed
        if (result.images.length === 0) {
            console.log(`JSON API returned no images, trying HTML scraping for item ${itemId}...`);
            const htmlResponse = await fetch(`https://booth.pm/en/items/${itemId}`, { headers });
            const html = await htmlResponse.text();

            // More liberal Images Regex to catch various patterns
            const imgRegex = /https:\/\/booth\.pximg\.net\/[a-f0-9-]+\/i\/\d+\/[a-f0-9-]+_base_resized\.jpg/g;
            const matches = html.match(imgRegex) || [];
            
            // Also try to look for og:image as a fallback
            const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
            if (ogImageMatch && !matches.includes(ogImageMatch[1])) {
                matches.unshift(ogImageMatch[1]);
            }

            // Deduplicate and clean resize prefixes
            const uniqueImages = [...new Set(matches.map(img => {
                // Remove resize prefixes like /c/72x72_a2_g5/ if they exist
                return img.replace(/\/c\/[^/]+\//, '/');
            }))];
            
            result.images = uniqueImages;
            console.log(`HTML scraping found ${result.images.length} images.`);

            // Video Regex
            const videoPatterns = [
                /https:\/\/www\.youtube\.com\/embed\/[a-zA-Z0-9_-]+/,
                /https:\/\/player\.vimeo\.com\/video\/[0-9]+/,
                /https:\/\/embed\.nicovideo\.jp\/watch\/[a-z0-9]+/
            ];

            for (const pattern of videoPatterns) {
                const vMatch = html.match(pattern);
                if (vMatch) {
                    result.video = vMatch[0];
                    break;
                }
            }

            // Fallback for thumbnail_url if still nothing (original logic)
            if (!result.thumbnail_url) {
                const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
                                   html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
                if (ogImageMatch) result.thumbnail_url = ogImageMatch[1];
            }
        }

        // Finalize
        if (result.images.length > 0) {
            result.thumbnail_url = result.images[0];
        }

        console.log(`Metadata fetched: found ${result.images.length} images, video: ${!!result.video}`);
        return result;
    } catch (err) {
        console.error('Error fetching Booth metadata:', err);
        throw err;
    }
});

// Save uploaded file
ipcMain.handle('save-file', async (event, { buffer, category, filename }) => {
    try {
        const uploadsDir = path.join(config.assetsPath, category);
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, Buffer.from(buffer));
        
        return { path: `/uploads/${category}/${filename}` };
    } catch (err) {
        console.error('Error saving file:', err);
        throw err;
    }
});

// App lifecycle
app.whenReady().then(() => {
    initializeDatabase();
    console.log('Database initialization finished, calling createWindow()');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
