// Ensure all Electron and Node requires are at the very top
const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;
const path = require('path');
const fs = require('fs-extra');

let mainWindow;

// ====== Window Management ======
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    icon: path.join(__dirname, 'assets', 'icon.png'), // Add app icon if you have one
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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

// ====== Helper Functions ======
function sanitizeFilename(title) {
  if (!title || typeof title !== 'string') {
    return 'untitled.json';
  }
  
  return `${title
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100) // Limit length
    .toLowerCase()}.json`;
}

async function ensureDataDirectories() {
  const userDataPath = app.getPath('userData');
  const dirs = [
    path.join(userDataPath, 'notes'),
    path.join(userDataPath, 'backups')
  ];
  
  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }
}

async function getNotesDir() {
  const userDataPath = app.getPath('userData');
  const notesDir = path.join(userDataPath, 'notes');
  await fs.ensureDir(notesDir);
  return notesDir;
}

async function getCalendarPath() {
  const userDataPath = app.getPath('userData');
  const calPath = path.join(userDataPath, 'calendar.json');
  
  if (!(await fs.pathExists(calPath))) {
    await fs.writeJson(calPath, [], { spaces: 2 });
  }
  
  return calPath;
}

async function getFoldersPath() {
  const userDataPath = app.getPath('userData');
  const foldersPath = path.join(userDataPath, 'folders.json');
  
  if (!(await fs.pathExists(foldersPath))) {
    await fs.writeJson(foldersPath, ['General'], { spaces: 2 });
  }
  
  return foldersPath;
}

async function createBackup(data, type) {
  try {
    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');
    await fs.ensureDir(backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${type}-${timestamp}.json`);
    
    await fs.writeJson(backupPath, data, { spaces: 2 });
    
    // Keep only last 10 backups of each type
    const backups = await fs.readdir(backupDir);
    const typeBackups = backups
      .filter(file => file.startsWith(`${type}-`) && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (typeBackups.length > 10) {
      for (const oldBackup of typeBackups.slice(10)) {
        await fs.remove(path.join(backupDir, oldBackup));
      }
    }
  } catch (error) {
    console.error('Backup failed:', error);
  }
}

// ====== Notes IPC Handlers ======
ipcMain.handle('save-note', async (event, note) => {
  try {
    if (!note || typeof note.title !== 'string') {
      return { success: false, error: 'Invalid note data' };
    }

    const notesDir = await getNotesDir();
    const filename = sanitizeFilename(note.title);
    const filePath = path.join(notesDir, filename);

    const noteData = {
      title: note.title.trim(),
      content: note.content || '',
      lastModified: new Date().toISOString(),
      folder: note.folder || 'General',
      created: note.created || new Date().toISOString(),
    };

    // Validate content size (max 10MB)
    const contentSize = Buffer.byteLength(JSON.stringify(noteData), 'utf8');
    if (contentSize > 10 * 1024 * 1024) {
      return { success: false, error: 'Note content too large (max 10MB)' };
    }

    await fs.writeJson(filePath, noteData, { spaces: 2 });
    
    // Create backup periodically
    if (Math.random() < 0.1) { // 10% chance
      await createBackup(noteData, 'note');
    }

    return { success: true, filePath };
  } catch (error) {
    console.error('Save note error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-note', async (event, title) => {
  try {
    if (!title || typeof title !== 'string') {
      return { success: false, error: 'Invalid note title' };
    }

    const notesDir = await getNotesDir();
    const filename = sanitizeFilename(title);
    const filePath = path.join(notesDir, filename);

    if (!(await fs.pathExists(filePath))) {
      return { success: false, error: 'Note not found' };
    }

    // Backup before deletion
    const noteData = await fs.readJson(filePath);
    await createBackup(noteData, 'deleted-note');

    await fs.remove(filePath);
    return { success: true };
  } catch (error) {
    console.error('Delete note error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('move-note', async (event, noteTitle, targetFolder) => {
  try {
    if (!noteTitle || typeof noteTitle !== 'string') {
      return { success: false, error: 'Invalid note title' };
    }

    if (!targetFolder || typeof targetFolder !== 'string') {
      return { success: false, error: 'Invalid target folder' };
    }

    const notesDir = await getNotesDir();
    const filename = sanitizeFilename(noteTitle);
    const filePath = path.join(notesDir, filename);

    if (!(await fs.pathExists(filePath))) {
      return { success: false, error: 'Note not found' };
    }

    // Read the existing note
    const noteData = await fs.readJson(filePath);
    
    // Update the folder
    noteData.folder = targetFolder;
    noteData.lastModified = new Date().toISOString();

    // Save the updated note
    await fs.writeJson(filePath, noteData, { spaces: 2 });

    return { success: true, note: noteData };
  } catch (error) {
    console.error('Move note error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-notes', async () => {
  try {
    const notesDir = await getNotesDir();
    const files = await fs.readdir(notesDir);
    const notes = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const filePath = path.join(notesDir, file);
        const noteData = await fs.readJson(filePath);
        
        // Validate note structure
        if (typeof noteData.title === 'string') {
          notes.push({
            ...noteData,
            folder: noteData.folder || 'General',
            created: noteData.created || noteData.lastModified || new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Failed to load note ${file}:`, error);
        // Skip corrupted notes but don't fail the whole operation
      }
    }

    // Sort by last modified (newest first)
    notes.sort((a, b) => {
      const dateA = new Date(b.lastModified || 0);
      const dateB = new Date(a.lastModified || 0);
      return dateA - dateB;
    });

    return notes;
  } catch (error) {
    console.error('Get all notes error:', error);
    return [];
  }
});

// ====== Folder IPC Handlers ======
ipcMain.handle('get-folders', async () => {
  try {
    const foldersPath = await getFoldersPath();
    const folders = await fs.readJson(foldersPath);
    
    if (!Array.isArray(folders)) {
      return ['General'];
    }
    
    // Ensure General folder exists
    if (!folders.includes('General')) {
      folders.unshift('General');
      await fs.writeJson(foldersPath, folders, { spaces: 2 });
    }
    
    return folders;
  } catch (error) {
    console.error('Get folders error:', error);
    return ['General'];
  }
});

ipcMain.handle('add-folder', async (event, name) => {
  try {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { success: false, error: 'Invalid folder name' };
    }

    const trimmedName = name.trim();
    
    // Validate folder name
    if (trimmedName.length > 50) {
      return { success: false, error: 'Folder name too long (max 50 characters)' };
    }
    
    if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmedName)) {
      return { success: false, error: 'Folder name contains invalid characters' };
    }

    const foldersPath = await getFoldersPath();
    let folders = await fs.readJson(foldersPath);

    if (!Array.isArray(folders)) {
      folders = ['General'];
    }

    // Case-insensitive check for existing folder
    if (folders.some(f => f.trim().toLowerCase() === trimmedName.toLowerCase())) {
      return { success: false, error: 'Folder already exists' };
    }

    folders.push(trimmedName);
    await fs.writeJson(foldersPath, folders, { spaces: 2 });

    return { success: true, folders };
  } catch (error) {
    console.error('Add folder error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-folder', async (event, name) => {
  try {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return { success: false, error: 'Invalid folder name' };
    }

    const trimmedName = name.trim();

    // Can't delete General folder
    if (trimmedName === 'General') {
      return { success: false, error: 'Cannot delete General folder' };
    }

    const foldersPath = await getFoldersPath();
    let folders = await fs.readJson(foldersPath);

    if (!Array.isArray(folders)) {
      return { success: false, error: 'No folders found' };
    }

    if (!folders.includes(trimmedName)) {
      return { success: false, error: 'Folder not found' };
    }

    // Move all notes in this folder to General
    const notesDir = await getNotesDir();
    const files = await fs.readdir(notesDir);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(notesDir, file);
        const noteData = await fs.readJson(filePath);
        
        if ((noteData.folder || 'General') === trimmedName) {
          noteData.folder = 'General';
          noteData.lastModified = new Date().toISOString();
          await fs.writeJson(filePath, noteData, { spaces: 2 });
        }
      } catch (e) {
        console.warn(`Failed to update note ${file}:`, e);
      }
    }

    // Remove folder from list
    folders = folders.filter(folder => folder !== trimmedName);
    await fs.writeJson(foldersPath, folders, { spaces: 2 });

    return { success: true, folders };
  } catch (error) {
    console.error('Delete folder error:', error);
    return { success: false, error: error.message };
  }
});

// ====== Rename Folder IPC Handler ======
ipcMain.handle('rename-folder', async (event, oldName, newName) => {
  try {
    if (!oldName || typeof oldName !== 'string' || !oldName.trim()) {
      return { success: false, error: 'Invalid old folder name' };
    }
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return { success: false, error: 'Invalid new folder name' };
    }
    
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    
    if (trimmedOld === 'General') {
      return { success: false, error: 'Cannot rename General folder' };
    }
    
    if (trimmedOld === trimmedNew) {
      return { success: false, error: 'New folder name is the same as old' };
    }
    
    if (trimmedNew.length > 50) {
      return { success: false, error: 'Folder name too long (max 50 characters)' };
    }
    
    if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmedNew)) {
      return { success: false, error: 'Folder name contains invalid characters' };
    }
    
    const foldersPath = await getFoldersPath();
    let folders = await fs.readJson(foldersPath);
    
    if (!Array.isArray(folders)) {
      folders = ['General'];
    }
    
    // Case-insensitive check for existing folder
    if (folders.some(f => f.trim().toLowerCase() === trimmedNew.toLowerCase())) {
      return { success: false, error: 'Folder already exists' };
    }
    
    // Update folder name in folders list
    const idx = folders.indexOf(trimmedOld);
    if (idx === -1) {
      return { success: false, error: 'Folder not found' };
    }
    
    folders[idx] = trimmedNew;
    await fs.writeJson(foldersPath, folders, { spaces: 2 });
    
    // Update all notes in this folder
    const notesDir = await getNotesDir();
    const files = await fs.readdir(notesDir);
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(notesDir, file);
        const noteData = await fs.readJson(filePath);
        
        if ((noteData.folder || 'General') === trimmedOld) {
          noteData.folder = trimmedNew;
          noteData.lastModified = new Date().toISOString();
          await fs.writeJson(filePath, noteData, { spaces: 2 });
        }
      } catch (e) {
        console.warn(`Failed to update note ${file}:`, e);
      }
    }
    
    return { success: true, folders };
  } catch (error) {
    console.error('Rename folder error:', error);
    return { success: false, error: error.message };
  }
});

// ====== Calendar IPC Handlers ======
ipcMain.handle('get-events', async () => {
  try {
    const calPath = await getCalendarPath();
    const events = await fs.readJson(calPath);
    
    if (!Array.isArray(events)) {
      return [];
    }
    
    // Validate and clean up events
    return events.filter(event => {
      return event && 
             typeof event.id === 'string' && 
             typeof event.title === 'string' && 
             event.start;
    });
  } catch (error) {
    console.error('Get events error:', error);
    return [];
  }
});

ipcMain.handle('save-events', async (event, events) => {
  try {
    if (!Array.isArray(events)) {
      return { success: false, error: 'Invalid events data' };
    }

    // Validate events
    const validEvents = events.filter(event => {
      return event && 
             typeof event.id === 'string' && 
             typeof event.title === 'string' && 
             event.start;
    });

    const calPath = await getCalendarPath();
    await fs.writeJson(calPath, validEvents, { spaces: 2 });

    // Create backup occasionally
    if (Math.random() < 0.1) {
      await createBackup(validEvents, 'calendar');
    }

    return { success: true };
  } catch (error) {
    console.error('Save events error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-ics', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Calendar File',
      filters: [
        { name: 'Calendar Files', extensions: ['ics'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile'],
    });

    if (canceled || !filePaths || !filePaths[0]) {
      return { success: false, error: 'No file selected' };
    }

    const filePath = filePaths[0];
    const fileStats = await fs.stat(filePath);
    
    // Check file size (max 5MB)
    if (fileStats.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File too large (max 5MB)' };
    }

    const rawContent = await fs.readFile(filePath, 'utf8');
    const events = parseICS(rawContent);

    if (events.length === 0) {
      return { success: false, error: 'No valid events found in file' };
    }

    // Save imported events
    const calPath = await getCalendarPath();
    await fs.writeJson(calPath, events, { spaces: 2 });

    return { 
      success: true, 
      importedCount: events.length, 
      events 
    };
  } catch (error) {
    console.error('Import ICS error:', error);
    return { success: false, error: error.message };
  }
});

// ====== ICS Parser ======
function parseICS(content) {
  try {
    // Normalize line endings and unfold lines
    const lines = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    const unfolded = [];
    for (const line of lines) {
      if (/^[ \t]/.test(line) && unfolded.length > 0) {
        // Continuation line
        unfolded[unfolded.length - 1] += line.substring(1);
      } else {
        unfolded.push(line.trim());
      }
    }

    const events = [];
    let currentEvent = null;

    for (const line of unfolded) {
      if (!line) continue;

      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT' && currentEvent) {
        // Process completed event
        const event = processEvent(currentEvent);
        if (event) {
          events.push(event);
        }
        currentEvent = null;
      } else if (currentEvent) {
        // Parse property line
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const keyPart = line.substring(0, colonIndex);
          const value = line.substring(colonIndex + 1);
          const key = keyPart.split(';')[0].toUpperCase();
          
          currentEvent[key] = {
            value: value,
            params: keyPart
          };
        }
      }
    }

    return events;
  } catch (error) {
    console.error('ICS parsing error:', error);
    return [];
  }
}

function processEvent(eventData) {
  try {
    // Extract required fields
    const summary = eventData.SUMMARY?.value || 'Untitled Event';
    const dtstart = eventData.DTSTART;
    const dtend = eventData.DTEND;
    const uid = eventData.UID?.value || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!dtstart) {
      return null; // Skip events without start date
    }

    // Parse start date/time
    const startInfo = parseDatetime(dtstart.value, dtstart.params);
    if (!startInfo) {
      return null;
    }

    // Parse end date/time
    let endInfo = null;
    if (dtend) {
      endInfo = parseDatetime(dtend.value, dtend.params);
    }

    return {
      id: uid,
      title: summary.substring(0, 200), // Limit title length
      start: startInfo.datetime,
      end: endInfo?.datetime,
      allDay: startInfo.allDay,
    };
  } catch (error) {
    console.error('Event processing error:', error);
    return null;
  }
}

function parseDatetime(value, params) {
  try {
    if (!value) return null;

    const isAllDay = /VALUE=DATE/.test(params) || /^\d{8}$/.test(value);
    
    if (isAllDay) {
      // All-day event (YYYYMMDD)
      if (/^\d{8}$/.test(value)) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        return {
          datetime: `${year}-${month}-${day}`,
          allDay: true
        };
      }
    } else {
      // Date-time event (YYYYMMDDTHHMMSS[Z])
      if (/^\d{8}T\d{6}Z?$/.test(value)) {
        const year = value.substring(0, 4);
        const month = value.substring(4, 6);
        const day = value.substring(6, 8);
        const hour = value.substring(9, 11);
        const minute = value.substring(11, 13);
        const second = value.substring(13, 15);
        const utc = value.endsWith('Z') ? 'Z' : '';
        
        return {
          datetime: `${year}-${month}-${day}T${hour}:${minute}:${second}${utc}`,
          allDay: false
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Datetime parsing error:', error);
    return null;
  }
}

// ====== Error Handling ======
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox(
      'Application Error', 
      `An unexpected error occurred: ${error.message}\n\nThe application will continue running, but some features may not work correctly.`
    );
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ====== App Events ======
app.on('before-quit', async (event) => {
  // Perform cleanup if needed
  try {
    await ensureDataDirectories();
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// Initialize data directories on startup
app.whenReady().then(async () => {
  try {
    await ensureDataDirectories();
  } catch (error) {
    console.error('Failed to initialize data directories:', error);
  }
});