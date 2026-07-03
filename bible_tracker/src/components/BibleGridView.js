// BibleGridView Component
import { BIBLE_BOOKS } from '../constants/bibleData.js';

export class BibleGridView {
  constructor(containerId, { onToggleChapter, onToggleAllChapters }) {
    this.container = document.getElementById(containerId);
    this.onToggleChapter = onToggleChapter;
    this.onToggleAllChapters = onToggleAllChapters;

    this.activeTestament = "NT"; // Default to New Testament
    this.currentBookName = "馬太福音";
    this.bibleMatrixMap = {}; // Key: bookName -> readChapters array

    this.init();
  }

  init() {
    // Handle switching testament tabs and selecting books
    this.container.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        this.activeTestament = tabBtn.dataset.testament;
        this.renderLeftNavOnly();
        return;
      }

      const bookBtn = e.target.closest('.book-item-btn');
      if (bookBtn) {
        this.currentBookName = bookBtn.dataset.book;
        this.renderLeftNavOnly();
        this.renderRightBoardOnly();
        return;
      }

      // Toggle single chapter grid cell
      const chapterCell = e.target.closest('.chapter-cell');
      const isModification = chapterCell || e.target.closest('#btn-select-all') || e.target.closest('#btn-select-none');

      if (isModification) {
        if (this.container.querySelector('.chapters-board.readonly-mode')) {
          alert("唯讀模式：您只能修改自己的追求紀錄！");
          return;
        }
      }

      if (chapterCell) {
        this.handleToggleChapterCell(chapterCell);
        return;
      }

      // Batch toggle all chapters
      const allBtn = e.target.closest('#btn-select-all');
      if (allBtn) {
        this.handleToggleAll(true);
        return;
      }

      const noneBtn = e.target.closest('#btn-select-none');
      if (noneBtn) {
        this.handleToggleAll(false);
        return;
      }
    });
  }

  async handleToggleChapterCell(chapterCell) {
    const chapterNum = parseInt(chapterCell.dataset.chapter, 10);
    const isRead = !chapterCell.classList.contains('read');
    const bookName = this.currentBookName;

    // Optimistic UI updates - instantly toggle color
    chapterCell.classList.toggle('read', isRead);

    // Update local memory state before async operation
    if (!this.bibleMatrixMap[bookName]) {
      this.bibleMatrixMap[bookName] = [];
    }

    if (isRead) {
      if (!this.bibleMatrixMap[bookName].includes(chapterNum)) {
        this.bibleMatrixMap[bookName].push(chapterNum);
      }
    } else {
      this.bibleMatrixMap[bookName] = this.bibleMatrixMap[bookName].filter(c => c !== chapterNum);
    }
    this.bibleMatrixMap[bookName].sort((a, b) => a - b);

    // Update the book badge in the left navigation
    this.updateBookBadge(bookName);

    // Async write to database - MUST be awaited/caught so failures don't
    // silently leave the UI showing a state that was never actually saved.
    try {
      await this.onToggleChapter(bookName, chapterNum, isRead);
    } catch (err) {
      console.error("同步章節失敗:", err);

      // Revert optimistic UI update on failure
      chapterCell.classList.toggle('read', !isRead);
      if (isRead) {
        this.bibleMatrixMap[bookName] = this.bibleMatrixMap[bookName].filter(c => c !== chapterNum);
      } else {
        if (!this.bibleMatrixMap[bookName].includes(chapterNum)) {
          this.bibleMatrixMap[bookName].push(chapterNum);
        }
        this.bibleMatrixMap[bookName].sort((a, b) => a - b);
      }
      this.updateBookBadge(bookName);

      alert("同步失敗，請檢查網路連線或重新登入後再試一次！");
    }
  }

  async handleToggleAll(isRead) {
    const bookMeta = BIBLE_BOOKS.find(b => b.name === this.currentBookName);
    if (!bookMeta) return;

    const bookName = this.currentBookName;
    const chapters = [];
    for (let i = 1; i <= bookMeta.chapters; i++) {
      chapters.push(i);
    }

    // Keep a copy of the previous state in case we need to revert
    const previousChapters = this.bibleMatrixMap[bookName] ? [...this.bibleMatrixMap[bookName]] : [];

    // Dynamic UI update
    const cells = this.container.querySelectorAll('.chapter-cell');
    cells.forEach(cell => cell.classList.toggle('read', isRead));

    this.bibleMatrixMap[bookName] = isRead ? chapters : [];
    this.updateBookBadge(bookName);

    // Call state update
    try {
      await this.onToggleAllChapters(bookName, isRead);
    } catch (err) {
      console.error("同步整卷章節失敗:", err);

      // Revert optimistic UI update on failure
      cells.forEach(cell => {
        const chapterNum = parseInt(cell.dataset.chapter, 10);
        cell.classList.toggle('read', previousChapters.includes(chapterNum));
      });
      this.bibleMatrixMap[bookName] = previousChapters;
      this.updateBookBadge(bookName);

      alert("同步失敗，請檢查網路連線或重新登入後再試一次！");
    }
  }

  updateBookBadge(bookName) {
    const btn = this.container.querySelector(`.book-item-btn[data-book="${bookName}"]`);
    if (btn) {
      const badge = btn.querySelector('.book-progress-badge');
      const bookMeta = BIBLE_BOOKS.find(b => b.name === bookName);
      const readList = this.bibleMatrixMap[bookName] || [];
      badge.textContent = `${readList.length}/${bookMeta.chapters}`;
    }
  }

  renderLeftNavOnly() {
    const listContainer = this.container.querySelector('.books-list');
    if (!listContainer) return;

    // Filter books based on active testament tab
    const filteredBooks = BIBLE_BOOKS.filter(book => book.testament === this.activeTestament);

    listContainer.innerHTML = filteredBooks.map(book => {
      const isActive = book.name === this.currentBookName;
      const readChapters = this.bibleMatrixMap[book.name] || [];
      return `
        <button class="book-item-btn ${isActive ? 'active' : ''}" data-book="${book.name}">
          <span>${book.name}</span>
          <span class="book-progress-badge">${readChapters.length}/${book.chapters}</span>
        </button>
      `;
    }).join('');

    // Highlight the active tab
    const tabButtons = this.container.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.testament === this.activeTestament);
    });
  }

  renderRightBoardOnly() {
    const boardContainer = this.container.querySelector('.chapters-board');
    if (!boardContainer) return;

    const bookMeta = BIBLE_BOOKS.find(b => b.name === this.currentBookName);
    if (!bookMeta) return;

    const readChapters = this.bibleMatrixMap[this.currentBookName] || [];

    let cellsHTML = '';
    for (let i = 1; i <= bookMeta.chapters; i++) {
      const isRead = readChapters.includes(i);
      cellsHTML += `
        <div class="chapter-cell ${isRead ? 'read' : ''}" data-chapter="${i}">
          ${i}
        </div>
      `;
    }

    boardContainer.innerHTML = `
      <div class="board-header">
        <div class="board-title">
          <h2>${this.currentBookName}</h2>
          <span style="font-size: 13px; color: var(--text-secondary)">
            已讀完 ${readChapters.length} 章 / 共 ${bookMeta.chapters} 章
          </span>
        </div>
        <div class="board-actions">
          <button id="btn-select-all" class="action-btn primary">全選</button>
          <button id="btn-select-none" class="action-btn">清除</button>
        </div>
      </div>
      <div class="chapters-grid">
        ${cellsHTML}
      </div>
    `;
  }

  render({ bibleMatrix, currentBookName, isReadOnly = false }) {
    if (currentBookName) {
      this.currentBookName = currentBookName;
      const bookMeta = BIBLE_BOOKS.find(b => b.name === currentBookName);
      if (bookMeta) this.activeTestament = bookMeta.testament;
    }

    // Process array records to a mapped lookup lookup table
    this.bibleMatrixMap = {};
    bibleMatrix.forEach(record => {
      this.bibleMatrixMap[record.bookName] = record.readChapters || [];
    });

    this.container.innerHTML = `
      <div class="bible-grid-container glass-panel">
        <h3 class="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          聖經書卷
        </h3>
        
        <div class="bible-layout">
          <!-- Left side: book picker -->
          <div class="bible-books-nav">
            <div class="testament-tabs">
              <button class="tab-btn ${this.activeTestament === 'OT' ? 'active' : ''}" data-testament="OT">舊約</button>
              <button class="tab-btn ${this.activeTestament === 'NT' ? 'active' : ''}" data-testament="NT">新約</button>
            </div>
            <div class="books-list">
              <!-- Rendered via renderLeftNavOnly -->
            </div>
          </div>
          
          <!-- Right side: chapters cells board -->
          <div class="chapters-board ${isReadOnly ? 'readonly-mode' : ''}">
            <!-- Rendered via renderRightBoardOnly -->
          </div>
        </div>
      </div>
    `;

    this.renderLeftNavOnly();
    this.renderRightBoardOnly();
  }
}