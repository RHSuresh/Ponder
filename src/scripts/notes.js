// DOM Elements
const notesList = document.getElementById('notes-list');
const newNoteBtn = document.getElementById('new-note-btn');
const saveNoteBtn = document.getElementById('save-note-btn');
const noteTitle = document.getElementById('note-title');
const noteContent = document.getElementById('note-content');

// Current note being edited
let currentNote = null;
let allNotes = [];

// Initialize app
async function initApp() {
  await loadNotes();
  
  // Event listeners
  newNoteBtn.addEventListener('click', createNewNote);
  saveNoteBtn.addEventListener('click', saveCurrentNote);
  
  // Create a default note if no notes exist
  if (allNotes.length === 0) {
    createNewNote();
  } else {
    // Load the first note
    loadNote(allNotes[0]);
  }
}

// Load all notes from storage
async function loadNotes() {
  allNotes = await window.notesAPI.getAllNotes();
  renderNotesList();
}

// Render the list of notes in the sidebar
function renderNotesList() {
  notesList.innerHTML = '';
  
  allNotes.forEach(note => {
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