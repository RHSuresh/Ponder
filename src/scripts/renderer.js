// ====== DOM Elements ======
const notesList = document.getElementById('notes-list');
const newNoteBtn = document.getElementById('new-note-btn');
const saveNoteBtn = document.getElementById('save-note-btn');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const deleteNoteBtn = document.getElementById('delete-note-btn');

// Folder modal elements
const folderModal = document.getElementById('folder-modal');
const folderModalInput = document.getElementById('folder-modal-input');
const folderModalOk = document.getElementById('folder-modal-ok');
const folderModalCancel = document.getElementById('folder-modal-cancel');

// DEBUG: Check if foldersAPI is available
if (!window.foldersAPI) {
  console.error('window.foldersAPI is undefined! The preload script may not be loaded or contextBridge is not working.');
  document.addEventListener('DOMContentLoaded', () => {
    const err = document.createElement('div');
    err.style.cssText = 'position:fixed;top:60px;right:20px;background:#e74c3c;color:white;padding:16px 20px;border-radius:8px;z-index:2000;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.25)';
    err.textContent = 'Critical Error: window.foldersAPI is not available. Check preload.js and Electron config.';
    document.body.appendChild(err);
  });
} else {
  console.log('window.foldersAPI is available:', window.foldersAPI);
}

const fontFamilySelect = document.getElementById('font-family');
const fontSizeSelect = document.getElementById('font-size');
const boldBtn = document.getElementById('bold-btn');
const italicBtn = document.getElementById('italic-btn');
const underlineBtn = document.getElementById('underline-btn');
const alignLeftBtn = document.getElementById('align-left-btn');
const alignCenterBtn = document.getElementById('align-center-btn');
const alignRightBtn = document.getElementById('align-right-btn');
const textColorInput = document.getElementById('text-color');
const bgColorInput = document.getElementById('bg-color');
const bulletListBtn = document.getElementById('bullet-list-btn');
const numberListBtn = document.getElementById('number-list-btn');

const tabButtons = document.querySelectorAll('.tab-btn');
const folderListEl = document.getElementById('folder-list');
const newFolderBtn = document.getElementById('new-folder-btn');

// Calendar elements
const calendarTab = document.getElementById('calendar-tab');
const calendarEl = document.getElementById('calendar');
const importIcsBtn = document.getElementById('import-ics-btn');

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');

// ====== State ======
let currentNote = null;
let allNotes = [];
let currentFolder = 'General';
let folders = ['General'];
let calendar = null;
let calendarBootstrapped = false;
let autoSaveTimeout = null;
let draggedNote = null;

// Performance optimization: Debounced functions
const debouncedSave = debounce(saveCurrentNote, 2000);
const debouncedUpdateButtonState = debounce(updateButtonState, 100);

// ====== Initialization ======
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  try {
    // Show loading state
    showLoadingState();
    
    // Load data concurrently
    await Promise.all([loadNotes(), loadFolders()]);
    
    // Initialize UI
    renderFolders();
    initTheme();
    setupEventListeners();
    setupFormattingControls();
    setupTabHandling();
    setupDragAndDrop();
    
    // Load initial note
    if (allNotes.length === 0) {
      createNewNote();
    } else {
      const generalNotes = allNotes.filter(n => (n.folder || 'General') === 'General');
      if (generalNotes.length > 0) {
        loadNote(generalNotes[0]);
      } else {
        loadNote(allNotes[0]);
      }
    }
    
    hideLoadingState();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to initialize the application');
  }
}

function showLoadingState() {
  document.body.style.cursor = 'wait';
}

function hideLoadingState() {
  document.body.style.cursor = 'default';
}

function showError(message) {
  // Simple error notification
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #e74c3c;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    z-index: 1000;
    font-size: 14px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--button-bg);
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    z-index: 1000;
    font-size: 14px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  `;
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.parentNode.removeChild(successDiv);
    }
  }, 3000);
}

function setupEventListeners() {
  console.log('Setting up event listeners...');
  console.log('newFolderBtn:', newFolderBtn);
  console.log('window.foldersAPI:', window.foldersAPI);
  
  // Main buttons
  newNoteBtn.addEventListener('click', createNewNote);
  saveNoteBtn.addEventListener('click', saveCurrentNote);
  deleteNoteBtn.addEventListener('click', deleteCurrentNote);
  newFolderBtn.addEventListener('click', onCreateFolder);
  
  // Theme toggle
  themeToggle.addEventListener('change', toggleTheme);
  
  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Calendar import
  importIcsBtn.addEventListener('click', onImportIcs);
  
  // Auto-save on content change
  noteTitle.addEventListener('input', debouncedSave);
  noteContent.addEventListener('input', debouncedSave);
  
  // Update toolbar state on selection change
  document.addEventListener('selectionchange', () => {
    if (isEditorFocused()) {
      debouncedUpdateButtonState();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
  if (!isEditorFocused()) return;
  
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentNote();
  }
  
  // Ctrl/Cmd + N for new note
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    createNewNote();
  }
  
  // Ctrl/Cmd + B for bold
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    toggleBold();
  }
  
  // Ctrl/Cmd + I for italic
  if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
    e.preventDefault();
    toggleItalic();
  }
}

function isEditorFocused() {
  return document.activeElement === noteContent || document.activeElement === noteTitle;
}

// ====== Theme Management ======
function initTheme() {
  // Don't use localStorage in artifacts - use session storage alternative
  const savedTheme = sessionStorage.getItem('ponder-theme') || 'light';
  const isDark = savedTheme === 'dark';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.checked = isDark;
}

function toggleTheme() {
  const isDark = themeToggle.checked;
  const theme = isDark ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', theme);
  sessionStorage.setItem('ponder-theme', theme);
  
  // Update calendar colors if it's loaded
  if (calendar) {
    setTimeout(() => calendar.render(), 100);
  }
}

// ====== Tab Management ======
function switchTab(tabName) {
  // Update tab buttons
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  const targetTab = document.getElementById(`${tabName}-tab`);
  if (targetTab) {
    targetTab.classList.remove('hidden');
    
    // Load calendar on first access
    if (tabName === 'calendar' && !calendarBootstrapped) {
      // Small delay to ensure DOM is ready
      setTimeout(() => mountCalendar(), 100);
    }
  }
}

// ====== Notes Management ======
async function loadNotes() {
  try {
    const loaded = await window.notesAPI.getAllNotes();
    allNotes = loaded.map(note => ({
      ...note,
      folder: note.folder || 'General'
    }));
    renderNotesList();
  } catch (error) {
    console.error('Failed to load notes:', error);
    allNotes = [];
  }
}

function renderNotesList() {
  const fragment = document.createDocumentFragment();
  const filtered = allNotes.filter(note => (note.folder || 'General') === currentFolder);
  
  // Clear existing notes
  notesList.innerHTML = '';
  
  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No notes in this folder';
    emptyState.style.cssText = 'padding: 20px; text-align: center; color: var(--text-secondary); font-style: italic;';
    notesList.appendChild(emptyState);
    return;
  }
  
  filtered.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.draggable = true;
    item.dataset.noteTitle = note.title;
    
    if (currentNote && currentNote.title === note.title) {
      item.classList.add('active');
    }
    
    item.textContent = note.title;
    item.addEventListener('click', () => loadNote(note));
    
    // Drag and drop events
    item.addEventListener('dragstart', handleNoteDragStart);
    item.addEventListener('dragend', handleNoteDragEnd);
    
    fragment.appendChild(item);
  });
  
  notesList.appendChild(fragment);
}

function loadNote(note) {
  if (currentNote && hasUnsavedChanges()) {
    if (!confirm('You have unsaved changes. Continue without saving?')) {
      return;
    }
  }
  
  currentNote = note;
  noteTitle.value = note.title;
  noteContent.innerHTML = note.content || '';
  
  // Update active note in sidebar
  document.querySelectorAll('.note-item').forEach(el => {
    el.classList.toggle('active', el.textContent === note.title);
  });
  
  // Clear auto-save timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
}

function createNewNote() {
  const newNote = {
    title: 'Untitled Note',
    content: '',
    lastModified: new Date().toISOString(),
    folder: currentFolder || 'General'
  };
  
  allNotes.unshift(newNote);
  renderNotesList();
  loadNote(newNote);
  
  // Focus title for immediate editing
  setTimeout(() => {
    noteTitle.focus();
    noteTitle.select();
  }, 100);
}

async function saveCurrentNote() {
  if (!currentNote) return;
  
  const title = noteTitle.value.trim() || 'Untitled Note';
  const content = noteContent.innerHTML;
  
  // Skip save if nothing changed
  if (title === currentNote.title && content === currentNote.content) {
    return;
  }
  
  const updatedNote = {
    title,
    content,
    lastModified: new Date().toISOString(),
    folder: currentNote.folder || 'General',
    created: currentNote.created
  };
  
  try {
    // Show saving state
    const originalText = saveNoteBtn.textContent;
    saveNoteBtn.textContent = 'Saving...';
    saveNoteBtn.disabled = true;
    
    const result = await window.notesAPI.saveNote(updatedNote);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save note');
    }
    
    // Update local data
    const idx = allNotes.findIndex(n => n.title === currentNote.title);
    if (idx !== -1) {
      allNotes[idx] = updatedNote;
    } else {
      allNotes.unshift(updatedNote);
    }
    
    currentNote = updatedNote;
    renderNotesList();
    
    // Show success feedback
    saveNoteBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveNoteBtn.textContent = originalText;
      saveNoteBtn.disabled = false;
    }, 1500);
    
  } catch (error) {
    console.error('Save failed:', error);
    saveNoteBtn.textContent = 'Save Failed';
    saveNoteBtn.disabled = false;
    showError('Failed to save note: ' + error.message);
    
    setTimeout(() => {
      saveNoteBtn.textContent = 'Save';
    }, 2000);
  }
}

async function deleteCurrentNote() {
  if (!currentNote) return;
  
  if (!confirm(`Delete "${currentNote.title}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const result = await window.notesAPI.deleteNote(currentNote.title);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete note');
    }
    
    // Remove from local array
    allNotes = allNotes.filter(n => n.title !== currentNote.title);
    renderNotesList();
    
    // Load next note or create new one
    if (allNotes.length > 0) {
      const filtered = allNotes.filter(n => n.folder === currentFolder);
      loadNote(filtered[0] || allNotes[0]);
    } else {
      createNewNote();
    }
    
  } catch (error) {
    console.error('Delete failed:', error);
    showError('Failed to delete note: ' + error.message);
  }
}

function hasUnsavedChanges() {
  if (!currentNote) return false;
  
  const title = noteTitle.value.trim() || 'Untitled Note';
  const content = noteContent.innerHTML;
  
  return title !== currentNote.title || content !== (currentNote.content || '');
}

// ====== Folder Management ======
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
    console.error('Error loading folders:', error);
    folders = ['General'];
    currentFolder = 'General';
  }
}

function renderFolders() {
  const fragment = document.createDocumentFragment();
  
  folderListEl.innerHTML = '';
  
  folders.forEach(folder => {
    const div = document.createElement('div');
    div.className = 'folder-item';
    div.dataset.folderName = folder;
    div.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

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

    // Button container for non-General folders
    if (folder !== 'General') {
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 4px;';
      
      // Rename button
      const renameBtn = document.createElement('button');
      renameBtn.textContent = '✏️';
      renameBtn.title = 'Rename folder';
      renameBtn.style.cssText = `
        padding: 2px 4px;
        font-size: 12px;
        background: none;
        border: none;
        cursor: pointer;
        color: var(--primary-color);
        border-radius: 2px;
      `;
      renameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRenameFolder(folder);
      });
      buttonContainer.appendChild(renameBtn);
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete folder';
      deleteBtn.style.cssText = `
        padding: 2px 4px;
        font-size: 12px;
        background: none;
        border: none;
        cursor: pointer;
        color: #e74c3c;
        border-radius: 2px;
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteFolder(folder);
      });
      buttonContainer.appendChild(deleteBtn);
      
      div.appendChild(buttonContainer);
    }

    // Add drag and drop support for folders
    div.addEventListener('dragover', handleFolderDragOver);
    div.addEventListener('drop', handleFolderDrop);

    fragment.appendChild(div);
  });
  
  folderListEl.appendChild(fragment);
}

function switchFolder(folder) {
  if (currentNote && hasUnsavedChanges()) {
    if (!confirm('You have unsaved changes. Continue without saving?')) {
      return;
    }
  }
  
  currentFolder = folder;
  renderFolders();
  renderNotesList();
  
  // Load first note in new folder
  const filtered = allNotes.filter(n => (n.folder || 'General') === currentFolder);
  if (filtered.length > 0) {
    loadNote(filtered[0]);
  } else {
    // Clear editor if no notes in folder
    currentNote = null;
    noteTitle.value = '';
    noteContent.innerHTML = '';
  }
}

async function onCreateFolder() {
  // Show modal dialog for folder name
  folderModalInput.value = '';
  folderModal.style.display = 'flex';
  folderModalInput.focus();

  function closeModal() {
    folderModal.style.display = 'none';
    folderModalInput.value = '';
    folderModalOk.onclick = null;
    folderModalCancel.onclick = null;
    folderModalInput.onkeydown = null;
  }

  folderModalCancel.onclick = (e) => {
    e.preventDefault();
    closeModal();
  };

  folderModalOk.onclick = async (e) => {
    e.preventDefault();
    const name = folderModalInput.value;
    if (!name || !name.trim()) {
      showError('Folder name cannot be empty');
      return;
    }
    const trimmedName = name.trim();
    // Check if folder already exists (case-insensitive)
    const exists = folders.some(f => f.trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      showError('Folder already exists');
      return;
    }
    try {
      showLoadingState();
      const result = await window.foldersAPI.addFolder(trimmedName);
      if (!result || !result.success) {
        showError('Failed to create folder: ' + (result && result.error ? result.error : 'Unknown error'));
        return;
      }
      folders = result.folders || [...folders, trimmedName];
      currentFolder = trimmedName;
      renderFolders();
      renderNotesList();
      showSuccess(`Folder "${trimmedName}" created successfully`);
      closeModal();
    } catch (error) {
      showError('Failed to create folder: ' + error.message);
    } finally {
      hideLoadingState();
    }
  };

  // Allow Enter/Escape keys
  folderModalInput.onkeydown = (e) => {
    if (e.key === 'Enter') folderModalOk.onclick(e);
    if (e.key === 'Escape') folderModalCancel.onclick(e);
  };
}

async function onRenameFolder(oldName) {
  console.log('Rename folder clicked for:', oldName);
  const newName = prompt('Enter new folder name:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const trimmedNew = newName.trim();
  
  // Check if new name already exists (case-insensitive)
  const exists = folders.some(f => f.trim().toLowerCase() === trimmedNew.toLowerCase());
  if (exists) {
    showError('Folder already exists');
    return;
  }

  try {
    console.log('Calling foldersAPI.renameFolder with:', oldName, trimmedNew);
    const result = await window.foldersAPI.renameFolder(oldName, trimmedNew);
    console.log('Rename API result:', result);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to rename folder');
    }
    
    // Update local data
    folders = result.folders || folders.map(f => (f === oldName ? trimmedNew : f));
    
    // Update notes in this folder
    allNotes.forEach(n => {
      if ((n.folder || 'General') === oldName) {
        n.folder = trimmedNew;
      }
    });
    
    // Update current folder if it was renamed
    if (currentFolder === oldName) {
      currentFolder = trimmedNew;
    }
    
    renderFolders();
    renderNotesList();
    showSuccess(`Folder renamed to "${trimmedNew}"`);
    
  } catch (error) {
    console.error('Error renaming folder:', error);
    showError('Failed to rename folder: ' + error.message);
  }
}

async function onDeleteFolder(folder) {
  if (!confirm(`Delete folder "${folder}"? All notes in this folder will be moved to General.`)) {
    return;
  }

  try {
    const result = await window.foldersAPI.deleteFolder(folder);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete folder');
    }

    // Update local data
    folders = result.folders || folders.filter(f => f !== folder);
    
    // Move notes in this folder to General
    allNotes.forEach(n => {
      if ((n.folder || 'General') === folder) {
        n.folder = 'General';
      }
    });
    
    // Switch to General if current folder was deleted
    if (currentFolder === folder) {
      currentFolder = 'General';
    }
    
    renderFolders();
    renderNotesList();
    showSuccess(`Folder "${folder}" deleted. Notes moved to General.`);

  } catch (error) {
    console.error('Error deleting folder:', error);
    showError('Failed to delete folder: ' + error.message);
  }
}

// ====== Drag and Drop ======
function setupDragAndDrop() {
  // Prevent default drag behaviors on document
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function handleNoteDragStart(e) {
  draggedNote = e.target.dataset.noteTitle;
  e.target.style.opacity = '0.5';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', e.target.outerHTML);
}

function handleNoteDragEnd(e) {
  e.target.style.opacity = '';
  draggedNote = null;
}

function handleFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleFolderDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (draggedNote) {
    const targetFolder = e.currentTarget.dataset.folderName;
    if (targetFolder) {
      moveNoteToFolder(draggedNote, targetFolder);
    }
  }
}

async function moveNoteToFolder(noteTitle, targetFolder) {
  try {
    const result = await window.notesAPI.moveNote(noteTitle, targetFolder);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to move note');
    }
    
    // Update local data
    const noteIndex = allNotes.findIndex(n => n.title === noteTitle);
    if (noteIndex !== -1) {
      allNotes[noteIndex].folder = targetFolder;
      allNotes[noteIndex].lastModified = new Date().toISOString();
      
      // Update current note if it's the one being moved
      if (currentNote && currentNote.title === noteTitle) {
        currentNote.folder = targetFolder;
      }
    }
    
    renderNotesList();
    showSuccess(`Note moved to "${targetFolder}" folder`);
    
  } catch (error) {
    console.error('Error moving note:', error);
    showError('Failed to move note: ' + error.message);
  }
}

// ====== Formatting Controls ======
function setupFormattingControls() {
  // Enable inline CSS styling for better compatibility
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch (e) {
    console.warn('styleWithCSS not supported');
  }
  
  // Font family
  fontFamilySelect.addEventListener('change', () => {
    executeCommand('fontName', fontFamilySelect.value);
  });
  
  // Font size
  fontSizeSelect.addEventListener('change', () => {
    executeCommand('fontSize', '7');
    // Convert size="7" to actual pixel size
    document.querySelectorAll('font[size="7"]').forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = fontSizeSelect.value;
    });
  });
  
  // Text formatting
  boldBtn.addEventListener('click', toggleBold);
  italicBtn.addEventListener('click', toggleItalic);
  underlineBtn.addEventListener('click', toggleUnderline);
  
  // Text alignment
  alignLeftBtn.addEventListener('click', () => executeCommand('justifyLeft'));
  alignCenterBtn.addEventListener('click', () => executeCommand('justifyCenter'));
  alignRightBtn.addEventListener('click', () => executeCommand('justifyRight'));
  
  // Colors
  textColorInput.addEventListener('change', () => {
    executeCommand('foreColor', textColorInput.value);
  });
  
  bgColorInput.addEventListener('change', () => {
    executeCommand('hiliteColor', bgColorInput.value);
  });
  
  // Lists
  bulletListBtn.addEventListener('click', () => executeCommand('insertUnorderedList'));
  numberListBtn.addEventListener('click', () => executeCommand('insertOrderedList'));
  
  // Update button states on editor events
  noteContent.addEventListener('keyup', debouncedUpdateButtonState);
  noteContent.addEventListener('mouseup', debouncedUpdateButtonState);
  noteContent.addEventListener('focus', debouncedUpdateButtonState);
}

function executeCommand(command, value = null) {
  noteContent.focus();
  try {
    document.execCommand(command, false, value);
    updateButtonState();
  } catch (error) {
    console.warn('Command failed:', command, error);
  }
}

function toggleBold() {
  executeCommand('bold');
}

function toggleItalic() {
  executeCommand('italic');
}

function toggleUnderline() {
  executeCommand('underline');
}

function updateButtonState() {
  try {
    // Update format button states
    boldBtn.classList.toggle('active', document.queryCommandState('bold'));
    italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
    bulletListBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
    numberListBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));
    
    // Update font family
    const fontFamily = document.queryCommandValue('fontName');
    if (fontFamily) {
      fontFamilySelect.value = fontFamily;
    }
    
  } catch (error) {
    // Silently handle queryCommand errors in some browsers
  }
}

// ====== Tab Handling ======
function setupTabHandling() {
  noteContent.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;
      
      const range = selection.getRangeAt(0);
      
      // Insert tab character (or spaces)
      const tabNode = document.createTextNode('\t');
      range.deleteContents();
      range.insertNode(tabNode);
      
      // Move cursor after tab
      range.setStartAfter(tabNode);
      range.setEndAfter(tabNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  });
}

// ====== Event Dialog Management ======
function showEventDialog(eventData = {}, existingEvent = null) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-color, #ffffff);
    border-radius: 8px;
    padding: 24px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  `;
  
  // Parse dates
  const startDate = eventData.start ? new Date(eventData.start) : new Date();
  const endDate = eventData.end ? new Date(eventData.end) : new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
  
  // Format date for input
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };
  
  // Format time for input
  const formatTime = (date) => {
    return date.toTimeString().split(' ')[0].substring(0, 5);
  };
  
  dialog.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: var(--text-color, #333);">${existingEvent ? 'Edit Event' : 'Create Event'}</h3>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Event Title *</label>
      <input type="text" id="event-title" placeholder="Enter event title" 
             style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
             value="${eventData.title || ''}">
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: flex; align-items: center; margin-bottom: 8px;">
        <input type="checkbox" id="event-all-day" ${eventData.allDay ? 'checked' : ''} 
               style="margin-right: 8px;">
        All Day Event
      </label>
    </div>
    
    <div id="date-time-fields" style="margin-bottom: 16px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Start Date</label>
          <input type="date" id="event-start-date" value="${formatDate(startDate)}"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">End Date</label>
          <input type="date" id="event-end-date" value="${formatDate(endDate)}"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">Start Time</label>
          <input type="time" id="event-start-time" value="${formatTime(startDate)}"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">End Time</label>
          <input type="time" id="event-end-time" value="${formatTime(endDate)}"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description</label>
      <textarea id="event-description" placeholder="Add description (optional)"
                style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 60px; resize: vertical;"></textarea>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Repeat</label>
      <select id="event-repeat" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <option value="none">No Repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
        <option value="custom">Custom...</option>
      </select>
    </div>
    
    <div id="custom-repeat" style="display: none; margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 4px; font-weight: 500;">Custom Repeat</label>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <input type="number" id="repeat-interval" placeholder="Every" min="1" value="1"
               style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
        <select id="repeat-frequency" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="days">Day(s)</option>
          <option value="weeks">Week(s)</option>
          <option value="months">Month(s)</option>
          <option value="years">Year(s)</option>
        </select>
      </div>
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
      <button id="event-cancel" style="padding: 10px 20px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 4px; cursor: pointer;">
        Cancel
      </button>
      <button id="event-save" style="padding: 10px 20px; background: var(--primary-color, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;">
        ${existingEvent ? 'Update Event' : 'Save Event'}
      </button>
    </div>
  `;
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Get references to form elements
  const titleInput = dialog.querySelector('#event-title');
  const allDayCheckbox = dialog.querySelector('#event-all-day');
  const startDateInput = dialog.querySelector('#event-start-date');
  const endDateInput = dialog.querySelector('#event-end-date');
  const startTimeInput = dialog.querySelector('#event-start-time');
  const endTimeInput = dialog.querySelector('#event-end-time');
  const descriptionInput = dialog.querySelector('#event-description');
  const repeatSelect = dialog.querySelector('#event-repeat');
  const customRepeatDiv = dialog.querySelector('#custom-repeat');
  const repeatInterval = dialog.querySelector('#repeat-interval');
  const repeatFrequency = dialog.querySelector('#repeat-frequency');
  const cancelBtn = dialog.querySelector('#event-cancel');
  const saveBtn = dialog.querySelector('#event-save');
  
  // Handle all-day toggle
  allDayCheckbox.addEventListener('change', () => {
    const dateTimeFields = dialog.querySelector('#date-time-fields');
    if (allDayCheckbox.checked) {
      startTimeInput.style.display = 'none';
      endTimeInput.style.display = 'none';
      startTimeInput.previousElementSibling.style.display = 'none';
      endTimeInput.previousElementSibling.style.display = 'none';
    } else {
      startTimeInput.style.display = 'block';
      endTimeInput.style.display = 'block';
      startTimeInput.previousElementSibling.style.display = 'block';
      endTimeInput.previousElementSibling.style.display = 'block';
    }
  });
  
  // Handle repeat toggle
  repeatSelect.addEventListener('change', () => {
    if (repeatSelect.value === 'custom') {
      customRepeatDiv.style.display = 'block';
    } else {
      customRepeatDiv.style.display = 'none';
    }
  });
  
  // Handle cancel
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  // Handle save
  saveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    if (!title) {
      alert('Please enter an event title');
      return;
    }
    
    const isAllDay = allDayCheckbox.checked;
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (!isAllDay) {
      const [startHour, startMinute] = startTimeInput.value.split(':').map(Number);
      const [endHour, endMinute] = endTimeInput.value.split(':').map(Number);
      
      startDate.setHours(startHour, startMinute);
      endDate.setHours(endHour, endMinute);
    }
    
    const eventData = {
      id: existingEvent ? existingEvent.id : generateEventId(),
      title,
      start: isAllDay ? startDate.toISOString().split('T')[0] : startDate.toISOString(),
      end: isAllDay ? endDate.toISOString().split('T')[0] : endDate.toISOString(),
      allDay: isAllDay,
      description: descriptionInput.value.trim(),
      repeat: repeatSelect.value === 'none' ? null : {
        frequency: repeatSelect.value,
        interval: repeatSelect.value === 'custom' ? parseInt(repeatInterval.value) || 1 : 1,
        customFrequency: repeatSelect.value === 'custom' ? repeatFrequency.value : null
      }
    };
    
    console.log(existingEvent ? 'Updating event:' : 'Adding event:', eventData);
    
    if (existingEvent) {
      // Update existing event
      existingEvent.setProp('title', eventData.title);
      existingEvent.setStart(eventData.start);
      existingEvent.setEnd(eventData.end);
      existingEvent.setAllDay(eventData.allDay);
      existingEvent.setExtendedProp('description', eventData.description);
      existingEvent.setExtendedProp('repeat', eventData.repeat);
    } else {
      // Add new event
      calendar.addEvent(eventData);
    }
    
    persistCalendar();
    document.body.removeChild(overlay);
  });
  
  // Handle overlay click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  // Focus title input
  titleInput.focus();
}

// ====== Calendar Management ======
async function mountCalendar() {
  if (calendarBootstrapped) {
    return;
  }
  
  // Check if FullCalendar is loaded
  if (!window.FullCalendar) {
    console.error('FullCalendar not loaded');
    showError('Calendar library failed to load. Please refresh the page.');
    return;
  }
  
  try {
    const { Calendar } = window.FullCalendar;
    
    calendar = new Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listMonth'
      },
      selectable: true,
      editable: true,
      dayMaxEvents: 3,
      height: 'auto',
      eventDisplay: 'block',
      
      // Event creation
      dateClick: (info) => {
        console.log('Calendar dateClick triggered:', info);
        handleDateClick(info);
      },
      select: (info) => {
        console.log('Calendar select triggered:', info);
        handleDateSelect(info);
      },
      
      // Event modification
      eventClick: (info) => {
        console.log('Calendar eventClick triggered:', info);
        handleEventClick(info);
      },
      eventChange: persistCalendar,
      eventAdd: persistCalendar,
      eventRemove: persistCalendar,
      
      // Styling
      eventColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color').trim() || '#00403d',
    });
    
    // Load existing events
    try {
      const existingEvents = await window.calendarAPI.getEvents();
      if (Array.isArray(existingEvents)) {
        existingEvents.forEach(event => {
          try {
            calendar.addEvent(event);
          } catch (error) {
            console.warn('Failed to add event:', event, error);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load existing events:', error);
    }
    
    calendar.render();
    calendarBootstrapped = true;
    
    console.log('Calendar initialized successfully');
    console.log('Calendar object:', calendar);
    console.log('Calendar element:', calendarEl);
    
  } catch (error) {
    console.error('Failed to mount calendar:', error);
    showError('Failed to initialize calendar: ' + error.message);
  }
}

function handleDateClick(info) {
  console.log('Date clicked:', info);
  showEventDialog({
    start: info.dateStr,
    allDay: true
  });
}

function handleDateSelect(info) {
  console.log('Date select triggered:', info);
  showEventDialog({
    start: info.startStr,
    end: info.endStr,
    allDay: info.allDay
  });
  calendar.unselect();
}

function handleEventClick(info) {
  console.log('Event clicked:', info);
  
  // Show context menu or edit dialog
  const action = confirm(`Event: "${info.event.title}"\n\nClick OK to edit, Cancel to delete`);
  
  if (action) {
    // Edit event - show dialog with current event data
    const eventData = {
      title: info.event.title,
      start: info.event.startStr || info.event.start.toISOString(),
      end: info.event.endStr || (info.event.end ? info.event.end.toISOString() : null),
      allDay: info.event.allDay,
      description: info.event.extendedProps?.description || ''
    };
    
    showEventDialog(eventData, info.event);
  } else {
    // Delete event
    if (confirm('Delete this event?')) {
      info.event.remove();
      persistCalendar();
    }
  }
}

async function persistCalendar() {
  if (!calendar) return;
  
  try {
    const events = calendar.getEvents().map(event => ({
      id: event.id,
      title: event.title,
      start: event.startStr || (event.start ? event.start.toISOString() : undefined),
      end: event.endStr || (event.end ? event.end.toISOString() : undefined),
      allDay: Boolean(event.allDay)
    }));
    
    const result = await window.calendarAPI.saveEvents(events);
    if (!result.success) {
      console.error('Failed to save calendar events:', result.error);
    }
    
  } catch (error) {
    console.error('Error persisting calendar:', error);
  }
}

async function onImportIcs() {
  try {
    const result = await window.calendarAPI.importICS();
    
    if (!result.success) {
      if (result.error) {
        showError('Import failed: ' + result.error);
      }
      return;
    }
    
    // Ensure calendar is loaded
    if (!calendarBootstrapped) {
      await mountCalendar();
    }
    
    // Clear existing events and add imported ones
    if (calendar) {
      calendar.getEvents().forEach(event => event.remove());
      
      (result.events || []).forEach(event => {
        try {
          calendar.addEvent(event);
        } catch (error) {
          console.warn('Failed to add imported event:', event, error);
        }
      });
      
      await persistCalendar();
    }
    
    const count = result.importedCount || 0;
    showSuccess(`Successfully imported ${count} event${count !== 1 ? 's' : ''}`);
    
  } catch (error) {
    console.error('Import error:', error);
    showError('Import failed: ' + error.message);
  }
}

// ====== Utility Functions ======
function generateEventId() {
  return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ====== Cleanup ======
window.addEventListener('beforeunload', (e) => {
  if (currentNote && hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
});