/* eslint-env browser */

//
// PUBLIC_INTERFACE
// Main container for QuickNote Organizer: Vanilla JS, Vite style, ES6+, self-contained, light-theme, card-based UI.
// Features: create, edit, delete, search, and categorize notes.
// Uses inline styles and templates for simplicity and Vite compatibility.
//

const COLORS = {
  primary: '#4A90E2',
  secondary: '#FFFFFF',
  accent: '#F5A623',
  text: '#213547',
  muted: '#f2f2f2',
  border: '#e6e6e6',
  cardShadow: 'rgba(74,144,226,0.10)'
};

// Internal helpers
function $(sel, el=document) { return el.querySelector(sel); }
function $$(sel, el=document) { return Array.from(el.querySelectorAll(sel)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function snippet(text, n=80) { return text.length > n ? text.slice(0, n-3) + '...' : text; }

// PUBLIC_INTERFACE
export function renderQuickNoteMain(el) {
  // State Definition
  let state = {
    notes: [],
    search: '',
    categories: ['General', 'Work', 'Personal', 'Ideas', 'Todo'],
    selectedCategory: 'All',
    nextId: 1,
    editingNoteId: null
  };

  // Persistent storage
  function saveNotes() {
    try {
      localStorage.setItem('quicknote_notes', JSON.stringify(state.notes));
      localStorage.setItem('quicknote_nextid', state.nextId);
    } catch { /* Fallback: ignore quota exceeded */ }
  }
  function loadNotes() {
    const notesRaw = localStorage.getItem('quicknote_notes');
    const nextIdRaw = localStorage.getItem('quicknote_nextid');
    if (notesRaw) state.notes = JSON.parse(notesRaw);
    if (nextIdRaw) state.nextId = Number(nextIdRaw);
  }

  // UI: Header (search + add)
  function headerTemplate() {
    return `
      <div class="qno-header">
        <input class="qno-search" type="text" placeholder="Search notes..." value="${escapeHtml(state.search)}" />
        <button class="qno-add-btn" title="Add Note">＋ Add Note</button>
      </div>
    `;
  }

  // UI: Category filters
  function categoryFilterTemplate() {
    return `
      <div class="qno-cat-filters">
        <button class="qno-cat-btn ${state.selectedCategory==='All'?'active':''}" data-cat="All">All</button>
        ${state.categories.map(cat =>
          `<button class="qno-cat-btn ${state.selectedCategory===cat?'active':''}" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
        ).join('')}
      </div>
    `;
  }

  // UI: Notes as cards
  function notesTemplate() {
    const filtered =
      state.notes
        .filter(note =>
          (!state.search || note.title.toLowerCase().includes(state.search.toLowerCase()) || note.content.toLowerCase().includes(state.search.toLowerCase()))
          && (state.selectedCategory === 'All' || note.category === state.selectedCategory)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);

    if (filtered.length === 0) {
      return `<div class="qno-empty">No notes found.</div>`;
    }

    return `<div class="qno-list">${filtered.map(note =>
      `<div class="qno-card" data-id="${note.id}">
        <div class="qno-card-tags">
          <span class="qno-tag" style="background:${COLORS.accent};color:#fff">${escapeHtml(note.category || 'General')}</span>
        </div>
        <div class="qno-card-title">${escapeHtml(note.title) || '<Untitled>'}</div>
        <div class="qno-card-snippet">${escapeHtml(snippet(note.content || ''))}</div>
        <div class="qno-card-actions">
            <button class="qno-edit-btn" title="Edit">✎</button>
            <button class="qno-del-btn" title="Delete">🗑️</button>
        </div>
        <div class="qno-card-time">${new Date(note.updatedAt).toLocaleString()}</div>
      </div>`
    ).join('')}</div>`;
  }

  // UI: Modal for add/edit
  function noteModalTemplate(note={}) {
    // `note` may be {} (add) or fully-populated (edit)
    return `
      <div class="qno-modal-overlay">
        <form class="qno-modal">
          <h2 style="color:${COLORS.primary};margin-top:0">${note.id ? 'Edit Note' : 'Add Note'}</h2>
          <label>Title</label>
          <input type="text" name="title" value="${escapeHtml(note.title || '')}" maxlength="100"/>
          <label>Content</label>
          <textarea name="content" rows="5" maxlength="1200">${escapeHtml(note.content || '')}</textarea>
          <label>Category</label>
          <select name="category">
            ${state.categories.map(cat =>
              `<option value="${escapeHtml(cat)}"${cat === (note.category || state.categories[0]) ? ' selected' : ''}>${escapeHtml(cat)}</option>`
            ).join('')}
          </select>
          <div class="qno-modal-actions">
            <button type="submit" class="qno-save-btn">${note.id ? 'Save' : 'Add'}</button>
            <button type="button" class="qno-cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  // Main render
  function render() {
    // Structure: header, filter, notes
    el.innerHTML = `
      <div class="qno-main">
        ${headerTemplate()}
        ${categoryFilterTemplate()}
        ${notesTemplate()}
      </div>
    `;
    bindEvents();
  }

  // Modal (outside of the root el to avoid re-render clear)
  function showModal(note) {
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = noteModalTemplate(note);
    modalDiv.className = 'qno-modal-root';
    document.body.appendChild(modalDiv);

    const overlay = $('.qno-modal-overlay', modalDiv);
    const form = $('.qno-modal', modalDiv);

    // Dismiss modal on overlay click (not on modal click)
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) {
        document.body.removeChild(modalDiv);
      }
    });

    // Cancel button
    $('.qno-cancel-btn', form).onclick = (e) => {
      e.preventDefault();
      document.body.removeChild(modalDiv);
    };

    // Save/Add button
    form.onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const title = f.get('title').trim();
      const content = f.get('content').trim();
      const category = f.get('category');
      if (!title && !content) {
        alert("Can't add an empty note.");
        return;
      }

      if (note && note.id) {
        // Edit
        const idx = state.notes.findIndex(n => n.id === note.id);
        if (idx !== -1) {
          state.notes[idx] = { ...state.notes[idx], title, content, category, updatedAt: Date.now() };
          saveNotes();
          render();
        }
      } else {
        // Add
        state.notes.push({
          id: state.nextId++,
          title,
          content,
          category,
          updatedAt: Date.now()
        });
        saveNotes();
        render();
      }
      document.body.removeChild(modalDiv);
    };
  }

  // Main interactions/events
  function bindEvents() {
    // Search bar input
    $('.qno-search', el).oninput = (e) => {
      state.search = e.target.value;
      render();
    };

    // Add Note button
    $('.qno-add-btn', el).onclick = () => {
      showModal({});
    };

    // Category filter buttons
    $$('.qno-cat-btn', el).forEach(btn => {
      btn.onclick = () => {
        state.selectedCategory = btn.getAttribute('data-cat');
        render();
      };
    });

    // Card actions (edit, delete, long-press for menu)
    $$('.qno-card', el).forEach(card => {
      const noteId = Number(card.getAttribute('data-id'));
      // Edit button
      $('.qno-edit-btn', card).onclick = () => {
        const note = state.notes.find(n => n.id === noteId);
        if (note) showModal(note);
      };

      // Delete button
      $('.qno-del-btn', card).onclick = () => {
        if (confirm('Delete this note?')) {
          state.notes = state.notes.filter(n => n.id !== noteId);
          saveNotes();
          render();
        }
      };

      // Long-press/touch (opens edit modal, simulates mobile behavior)
      let lpTimer = null;
      card.onmousedown = card.ontouchstart = () => {
        lpTimer = setTimeout(() => {
          const note = state.notes.find(n => n.id === noteId);
          if (note) showModal(note);
        }, 420); // 420ms for "long"
      };
      card.onmouseup = card.ontouchend = card.onmouseleave = () => {
        clearTimeout(lpTimer);
      }
    });
  }

  // Setup: load state, add styles, render
  function ensureInjectedStyles() {
    if ($('#qno-injected-styles')) return;
    const style = document.createElement('style');
    style.id = 'qno-injected-styles';
    style.innerHTML = `
    .qno-main {
      font-family: 'system-ui', Arial, sans-serif;
      background: ${COLORS.secondary};
      color:${COLORS.text};
      border-radius:16px;
      box-shadow: 0 0 18px 5px ${COLORS.cardShadow};
      max-width:750px;
      margin:2rem auto;
      padding:2rem 1.5rem 2rem 1.5rem;
      min-height:65vh;
    }
    .qno-header {
      display: flex;
      flex-wrap:wrap;
      gap: 1.3em;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .qno-search {
      flex: 1 1 300px;
      min-width: 210px;
      padding: .5em .8em;
      font-size: 1.04em;
      border: 1.4px solid ${COLORS.border};
      border-radius: 8px;
      background: #f5f8fa;
      color:${COLORS.text};
    }
    .qno-add-btn {
      background: ${COLORS.primary};
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: .7em 1.3em;
      font-weight:600;
      font-size:1.1em;
      box-shadow: 0 2px 10px #4A90E24A;
      cursor:pointer;
      transition:background .2s;
    }
    .qno-add-btn:hover { background: #357AC8; }
    .qno-cat-filters {
      display:flex;
      gap: 0.75em;
      margin-bottom: 1.2em;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .qno-cat-btn {
      background: #e7eefd;
      color: ${COLORS.primary};
      border: 1px solid #b3c8ec;
      border-radius: 18px;
      padding: .4em 1.2em;
      font-size:.98em;
      font-weight:500;
      cursor:pointer;
      outline:none;
      user-select:none;
      transition: background .18s;
    }
    .qno-cat-btn.active,
    .qno-cat-btn:hover {
      background: ${COLORS.primary};
      color:#fff;
      border-color:${COLORS.primary};
    }
    .qno-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.3em 1.8em;
    }
    .qno-card {
      background: #fff;
      box-shadow:0 2px 12px 1px ${COLORS.cardShadow};
      border-radius:10px;
      padding: 1.15em 1em .75em 1em;
      min-height: 165px;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: box-shadow .16s;
      border:1.2px solid ${COLORS.border};
      min-width: 0;
      cursor: pointer;
      overflow: hidden;
    }
    .qno-card:hover { box-shadow:0 7px 22px 2px #4A90E26c; z-index:1; }
    .qno-card-title {
      font-weight: bold;
      font-size: 1.1em;
      margin-bottom:0.2em;
      color: ${COLORS.primary};
      text-align: left;
      letter-spacing:.025em;
      line-height:1.17;
    }
    .qno-card-snippet {
      color: #3C4250;
      margin-bottom: .5em;
      font-size: .99em;
      word-break: break-word;
      text-align:left;
      min-height:38px;
      line-height:1.38;
    }
    .qno-card-tags { margin-bottom: .1em; }
    .qno-tag {
      font-size:.8em;
      color:#fff;
      background:${COLORS.accent};
      display:inline-block;
      padding:.2em .7em;
      border-radius:11px;
      font-weight:500;
      margin-right:.3em;
    }
    .qno-card-actions {
      position:absolute;
      top:7px; right:6px;
      z-index:3;
      display:flex; gap:.3em;
      opacity:.8;
    }
    .qno-card-actions button {
      border:none;
      background: none;
      font-size:1.16em;
      color:${COLORS.primary};
      cursor:pointer;
      padding: .15em .28em;
      border-radius:6px;
      transition:background .15s;
    }
    .qno-card-actions button:hover {
      background:${COLORS.muted}; color:#DB3939;
    }
    .qno-card-time {
      font-size:.77em;
      color:#899;
      margin-top:auto;
      margin-right:.1em;
      align-self: flex-end;
    }
    .qno-empty {
      text-align:center;
      color:#aaa;
      font-size:1.1em;
      margin:2.8em 0 1.6em 0;
      opacity:.71;
    }
    /* Modal styling */
    .qno-modal-root { z-index:1000; }
    .qno-modal-overlay {
      position:fixed; left:0; top:0; width:100vw; height:100vh;
      background:rgba(44,65,92,0.19);
      z-index:9000; display:flex; align-items:center; justify-content:center;
    }
    .qno-modal {
      background:${COLORS.secondary};
      box-shadow:0px 14px 44px 7px #4A90E229;
      border-radius:10px;
      padding:2.1em 2.3em 1.5em 2em; min-width:330px; max-width:99vw;
      display:flex; flex-direction:column;
      gap:.72em 0;
      max-width:410px;
      animation: qno-modal-pop-in .27s;
    }
    @keyframes qno-modal-pop-in {
      from { transform: scale(0.93); opacity:0; } to { transform:none; opacity:1; }
    }
    .qno-modal label {
      font-size:.92em; color:#596bb0; margin-bottom:.11em; font-weight:500;
      text-align:left;
    }
    .qno-modal input[type="text"],
    .qno-modal textarea {
      border:1.2px solid ${COLORS.primary}; border-radius:7px;
      font-size:1.04em; padding:.36em .8em;
      margin-bottom:.11em;
      color:${COLORS.text};
      background:#f5f8ff;
      font-family:inherit;
      box-sizing:border-box;
      outline:none;
      width:100%;
      resize:none;
      transition:border .18s;
    }
    .qno-modal textarea { font-size:.98em; min-height:80px;}
    .qno-modal input:focus,
    .qno-modal textarea:focus { border-color:${COLORS.accent}; }
    .qno-modal select {
      border:1.2px solid ${COLORS.primary};
      border-radius:7px; padding:.32em .9em; font-size:.98em;
      background:#f5f8ff; color:${COLORS.text};
      margin-bottom:.24em; outline:none;
      width:100%;
    }
    .qno-modal-actions {
      margin-top: 1.1em; gap:0 .3em; display:flex; justify-content:flex-end; align-items:center;
    }
    .qno-save-btn, .qno-cancel-btn {
      background: ${COLORS.primary}; color: #fff; border: none; border-radius: 8px;
      padding: .48em 1.25em; font-size:1em;
      font-weight:600; cursor:pointer; transition:background .16s;
      margin-left:.35em;
    }
    .qno-cancel-btn { background:#c7c7c7; color:#222;font-weight:400;}
    .qno-save-btn:hover { background:${COLORS.accent}; }
    .qno-cancel-btn:hover { background:#929292; }
    @media (max-width:600px) {
      .qno-main { padding: 0.5rem 0.2rem; }
      .qno-modal { min-width:95vw; padding:1.1em .8em; }
      .qno-card { min-height:110px; font-size:.99em; }
      .qno-list { gap:.5em .3em;}
    }
    `;
    document.head.appendChild(style);
  }

  ensureInjectedStyles();
  loadNotes();
  render();
}

// For autodetect or nth-time mounts in Vite dev, export a lazy init.
// Mount on window.app at startup in main.js or directly:
if (typeof window !== 'undefined') {
  window.renderQuickNoteMain = renderQuickNoteMain;
}
