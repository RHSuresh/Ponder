const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('foldersAPI', {
  getFolders: () => ipcRenderer.invoke('get-folders'),
  addFolder: (name) => ipcRenderer.invoke('add-folder', name),
  deleteFolder: (name) => ipcRenderer.invoke('delete-folder', name),
  renameFolder: (oldName, newName) => ipcRenderer.invoke('rename-folder', oldName, newName)
});

contextBridge.exposeInMainWorld('notesAPI', {
  getAllNotes: () => ipcRenderer.invoke('get-all-notes'),
  saveNote: (note) => ipcRenderer.invoke('save-note', note),
  deleteNote: (title) => ipcRenderer.invoke('delete-note', title),
  moveNote: (noteTitle, targetFolder) => ipcRenderer.invoke('move-note', noteTitle, targetFolder)
});