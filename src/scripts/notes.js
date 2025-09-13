// DOM Elements
const notesList = document.getElementById('notes-list');
const newNoteBtn = document.getElementById('new-note-btn');
const saveNoteBtn = document.getElementById('save-note-btn');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');

// Folder management UI
let folderListEl = document.getElementById('folder-list');
if (!folderListEl) {
  // If not present, create and insert before notesList
  folderListEl = document.createElement('div');
  folderListEl.id = 'folder-list';
  folderListEl.className = 'folder-list';
  notesList.parentNode.insertBefore(folderListEl, notesList);
}
let newFolderBtn = document.getElementById('new-folder-btn');
if (!newFolderBtn) {
  newFolderBtn = document.createElement('button');
  newFolderBtn.id = 'new-folder-btn';
  newFolderBtn.textContent = '+ New Folder';
  folderListEl.parentNode.insertBefore(newFolderBtn, folderListEl);
}

// Current note and folders
let currentNote = null;
let allNotes = [];
let folders = ['General'];
let currentFolder = 'General';

// Initialize app
async function initApp() {
  await loadFolders();
  await loadNotes();

  // Event listeners
  newNoteBtn.addEventListener('click', createNewNote);
  saveNoteBtn.addEventListener('click', saveCurrentNote);
  newFolderBtn.addEventListener('click', onCreateFolder);

  // Render folders
  renderFolders();

  // Load first note in current folder
  const filtered = allNotes.filter(n => (n.folder || 'General') === currentFolder);
  if (filtered.length > 0) {
    loadNote(filtered[0]);
  } else {
    createNewNote();
  }
}

// Load all notes from storage
async function loadNotes() {
  allNotes = await window.notesAPI.getAllNotes();
  renderNotesList();
}

// Load all folders from storage
async function loadFolders() {
  try {
    const list = await window.foldersAPI.getFolders();
    if (Array.isArray(list) && list.length) {
      folders = list;
      if (!folders.includes(currentFolder)) {
        currentFolder = folders[0];
      }
    } else {
      folders = ['General'];
      currentFolder = 'General';
    }
  } catch (error) {
    folders = ['General'];
    currentFolder = 'General';
  }
}

// Render the list of notes in the sidebar
function renderNotesList() {
  notesList.innerHTML = '';
  const filtered = allNotes.filter(note => (note.folder || 'General') === currentFolder);
  filtered.forEach(note => {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    if (currentNote && currentNote.title === note.title) {
      noteItem.classList.add('active');
    }
    noteItem.textContent = note.title;
    noteItem.addEventListener('click', () => loadNote(note));
    notesList.appendChild(noteItem);
  });
}

// Render folders in the sidebar
function renderFolders() {
  folderListEl.innerHTML = '';
  folders.forEach(folder => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.dataset.folderName = folder;
    if (folder === currentFolder) {
      div.classList.add('active');
    }
    // Folder name span
    const nameSpan = document.createElement('span');
    nameSpan.textContent = folder;
    nameSpan.style.flex = '1';
    nameSpan.style.cursor = 'pointer';
    nameSpan.addEventListener('click', () => switchFolder(folder));
    div.appendChild(nameSpan);
    // Rename button (not for General)
    if (folder !== 'General') {
      const renameBtn = document.createElement('button');
      renameBtn.textContent = '✏️';
      renameBtn.title = 'Rename folder';
      renameBtn.style.marginLeft = '8px';
      renameBtn.style.fontSize = '13px';
      renameBtn.style.background = 'none';
      renameBtn.style.border = 'none';
      renameBtn.style.cursor = 'pointer';
      renameBtn.style.color = 'var(--primary-color)';
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRenameFolder(folder);
      });
      div.appendChild(renameBtn);
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete folder';
      deleteBtn.style.marginLeft = '4px';
      deleteBtn.style.fontSize = '13px';
      deleteBtn.style.background = 'none';
      deleteBtn.style.border = 'none';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.color = '#e74c3c';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteFolder(folder);
      });
      div.appendChild(deleteBtn);
    }
    folderListEl.appendChild(div);
  });
}

function switchFolder(folder) {
  currentFolder = folder;
  renderFolders();
  renderNotesList();
  // Load first note in new folder
  const filtered = allNotes.filter(n => (n.folder || 'General') === currentFolder);
  if (filtered.length > 0) {
    loadNote(filtered[0]);
  } else {
    currentNote = null;
    noteTitle.value = '';
    noteContent.value = '';
  }
}

async function onCreateFolder() {
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;
  const trimmedName = name.trim();
  const exists = folders.some(f => f.trim().toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    alert('Folder already exists');
    return;
  }
  try {
    const result = await window.foldersAPI.addFolder(trimmedName);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create folder');
    }
    folders = result.folders || [...folders, trimmedName];
    renderFolders();
    alert(`Folder "${trimmedName}" created successfully`);
  } catch (error) {
    alert('Failed to create folder: ' + error.message);
  }
}

async function onRenameFolder(oldName) {
  const newName = prompt('Enter new folder name:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const trimmedNew = newName.trim();
  const exists = folders.some(f => f.trim().toLowerCase() === trimmedNew.toLowerCase());
  if (exists) {
    alert('Folder already exists');
    return;
  }
  try {
    const result = await window.foldersAPI.renameFolder(oldName, trimmedNew);
    if (!result.success) {
      throw new Error(result.error || 'Failed to rename folder');
    }
    folders = result.folders || folders.map(f => (f === oldName ? trimmedNew : f));
    // Update notes in this folder
    allNotes.forEach(n => {
      if ((n.folder || 'General') === oldName) n.folder = trimmedNew;
    });
    if (currentFolder === oldName) currentFolder = trimmedNew;
    renderFolders();
    renderNotesList();
    alert(`Folder renamed to "${trimmedNew}"`);
  } catch (error) {
    alert('Failed to rename folder: ' + error.message);
  }
}

async function onDeleteFolder(name) {
  if (!confirm(`Delete folder "${name}"? All notes in this folder will be moved to General.`)) return;
  try {
    const result = await window.foldersAPI.deleteFolder(name);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete folder');
    }
    folders = result.folders || folders.filter(f => f !== name);
    // Move notes in this folder to General
    allNotes.forEach(n => {
      if ((n.folder || 'General') === name) n.folder = 'General';
    });
    if (currentFolder === name) currentFolder = 'General';
    renderFolders();
    renderNotesList();
    alert(`Folder "${name}" deleted. Notes moved to General.`);
  } catch (error) {
    alert('Failed to delete folder: ' + error.message);
  }
}

// Load a note into the editor
function loadNote(note) {
  currentNote = note;
  noteTitle.value = note.title;
  noteContent.value = note.content;
  
  // Update the active note in the list
  document.querySelectorAll('.note-item').forEach(item => {
    item.classList.remove('active');
    if (item.textContent === note.title) {
      item.classList.add('active');
    }
  });
}

// Create a new note
function createNewNote() {
  const newNote = {
    title: 'Untitled Note',
    content: '',
    lastModified: new Date().toISOString()
  };
  
  allNotes.unshift(newNote);
  renderNotesList();
  loadNote(newNote);
  noteTitle.focus();
}

// Save the current note
async function saveCurrentNote() {
  if (!currentNote) return;
  
  const title = noteTitle.value.trim() || 'Untitled Note';
  const content = noteContent.value;
  
  const updatedNote = {
    title,
    content,
    lastModified: new Date().toISOString()
  };
  
  // Save to storage
  const result = await window.notesAPI.saveNote(updatedNote);
  
  if (result.success) {
    // Update the note in our array
    const index = allNotes.findIndex(note => note.title === currentNote.title);
    if (index !== -1) {
      allNotes[index] = updatedNote;
    } else {
      allNotes.unshift(updatedNote);
    }
    
    currentNote = updatedNote;
    renderNotesList();
    
    // Show a brief save confirmation
    const originalText = saveNoteBtn.textContent;
    saveNoteBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveNoteBtn.textContent = originalText;
    }, 1500);
  } else {
    alert('Failed to save note: ' + result.error);
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);