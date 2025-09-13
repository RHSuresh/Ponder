// ====== DOM Elements ======
const notesList = document.getElementById('notes-list');
const newNoteBtn = document.getElementById('new-note-btn');
const saveNoteBtn = document.getElementById('save-note-btn');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');
const deleteNoteBtn = document.getElementById('delete-note-btn');

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
  const savedTheme = localStorage.getItem('ponder-theme') || 'light';
  const isDark = savedTheme === 'dark';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.checked = isDark;
}

function toggleTheme() {
  const isDark = themeToggle.checked;
  const theme = isDark ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ponder-theme', theme);
  
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
    folder: 'General' // Always create new notes in General
  };
  
  allNotes.unshift(newNote);
  
  // Switch to General folder if not already there
  if (currentFolder !== 'General') {
    currentFolder = 'General';
    renderFolders();
  }
  
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
    }

    // Add drag and drop support for folders
    div.addEventListener('dragover', handleFolderDragOver);
    div.addEventListener('drop', handleFolderDrop);

    fragment.appendChild(div);
  });
// Rename folder handler
async function onRenameFolder(oldName) {
  const newName = prompt('Enter new folder name:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;

  const trimmedNew = newName.trim();
  // Case-insensitive, trimmed check for existing folders
  const exists = folders.some(f => f.trim().toLowerCase() === trimmedNew.toLowerCase());
  if (exists) {
    showError('Folder already exists');
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
    // If current folder was renamed, update
    if (currentFolder === oldName) currentFolder = trimmedNew;
    renderFolders();
    renderNotesList();
    showSuccess(`Folder renamed to "${trimmedNew}"`);
  } catch (error) {
    console.error('Error renaming folder:', error);
    showError('Failed to rename folder: ' + error.message);
  }
}
  
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
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  const trimmedName = name.trim();
  // Case-insensitive, trimmed check for existing folders
  const exists = folders.some(f => f.trim().toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    showError('Folder already exists');
    return;
  }

  try {
    const result = await window.foldersAPI.addFolder(trimmedName);
    if (!result.success) {
      throw new Error(result.error || 'Failed to create folder');
    }

    folders = result.folders || [...folders, trimmedName];
    renderFolders();
    showSuccess(`Folder "${trimmedName}" created successfully`);

  } catch (error) {
    console.error('Error creating folder:', error);
    showError('Failed to create folder: ' + error.message);
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
  e.target.classList.add('drag-over');
}

function handleFolderDrop(e) {
  e.preventDefault();
  e.target.classList.remove('drag-over');
  
  if (draggedNote) {
    const targetFolder = e.target.dataset.folderName;
    moveNoteToFolder(draggedNote, targetFolder);
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

// ====== Calendar Management ======
async function mountCalendar() {
  if (calendarBootstrapped || !window.FullCalendar) {
    if (!window.FullCalendar) {
      showError('FullCalendar failed to load. Please refresh the page.');
    }
    return;
  }
  
  try {
    calendar = new FullCalendar.Calendar(calendarEl, {
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
      dateClick: handleDateClick,
      select: handleDateSelect,
      
      // Event modification
      eventClick: handleEventClick,
      eventChange: persistCalendar,
      eventAdd: persistCalendar,
      eventRemove: persistCalendar,
      
      // Styling
      eventColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color').trim() || '#00403d',
    });
    
    // Load existing events
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
    
    calendar.render();
    calendarBootstrapped = true;
    
    console.log('Calendar initialized successfully');
    
  } catch (error) {
    console.error('Failed to mount calendar:', error);
    showError('Failed to initialize calendar: ' + error.message);
  }
}

function handleDateClick(info) {
  const title = prompt('Enter event title:');
  if (!title || !title.trim()) return;
  
  const eventData = {
    id: generateEventId(),
    title: title.trim(),
    start: info.dateStr,
    allDay: true
  };
  
  calendar.addEvent(eventData);
  persistCalendar();
}

function handleDateSelect(info) {
  const title = prompt('Enter event title:');
  if (!title || !title.trim()) {
    calendar.unselect();
    return;
  }
  
  const eventData = {
    id: generateEventId(),
    title: title.trim(),
    start: info.startStr,
    end: info.endStr,
    allDay: info.allDay
  };
  
  calendar.addEvent(eventData);
  calendar.unselect();
  persistCalendar();
}

function handleEventClick(info) {
  const action = prompt(
    `Event: "${info.event.title}"\n\nEnter new title (leave empty to delete):`,
    info.event.title
  );
  
  if (action === null) return; // Cancelled
  
  if (action.trim() === '') {
    // Delete event
    if (confirm('Delete this event?')) {
      info.event.remove();
      persistCalendar();
    }
  } else {
    // Update event
    info.event.setProp('title', action.trim());
    persistCalendar();
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