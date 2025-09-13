const { contextBridge, ipcRenderer } = require('electron');

// Notes API
contextBridge.exposeInMainWorld('notesAPI', {
  saveNote: (note) => ipcRenderer.invoke('save-note', note),
  getAllNotes: () => ipcRenderer.invoke('get-all-notes'),
  deleteNote: (title) => ipcRenderer.invoke('delete-note', title),
  moveNote: (noteTitle, targetFolder) => ipcRenderer.invoke('move-note', noteTitle, targetFolder),
});

// Folders API
contextBridge.exposeInMainWorld('foldersAPI', {
  getFolders: () => ipcRenderer.invoke('get-folders'),
  addFolder: (name) => ipcRenderer.invoke('add-folder', name),
  deleteFolder: (name) => ipcRenderer.invoke('delete-folder', name),
  renameFolder: (oldName, newName) => ipcRenderer.invoke('rename-folder', oldName, newName),
});

// Calendar API
contextBridge.exposeInMainWorld('calendarAPI', {
  getEvents: () => ipcRenderer.invoke('get-events'),
  saveEvents: (events) => ipcRenderer.invoke('save-events', events),
  importICS: () => ipcRenderer.invoke('import-ics'),
});

// System API for additional functionality
contextBridge.exposeInMainWorld('systemAPI', {
  // Platform detection
  platform: process.platform,
  
  // Window controls (if needed later)
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
});

// File system API for background images (using data URLs instead of file paths)
contextBridge.exposeInMainWorld('fileAPI', {
  // Convert file to data URL for backgrounds
  fileToDataUrl: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }
});