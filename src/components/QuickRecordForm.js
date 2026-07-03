// QuickRecordForm Component
import { BIBLE_BOOKS } from '../constants/bibleData.js';
import { getHistoricalNames } from '../config/firebase.js';

export class QuickRecordForm {
  constructor(containerId, { onSubmitRecord }) {
    this.container = document.getElementById(containerId);
    this.onSubmitRecord = onSubmitRecord;
    this.hasReadBible = false;
    this.hasReadBook = false;
    this.selectedBook = "馬太福音";
    this.bookRecordName = "";

    // 依據預設選取的書卷判斷新舊約
    const currentBookMeta = BIBLE_BOOKS.find(b => b.name === this.selectedBook);
    this.selectedTestament = currentBookMeta ? currentBookMeta.testament : "NT";

    // Set default date to today in Asia/Taipei timezone YYYY-MM-DD
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(today);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    this.selectedDate = `${year}-${month}-${day}`;

    this.init();
  }

  init() {
    // Form elements listeners using event delegation
    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'record-date') {
        this.selectedDate = e.target.value;
      }

      if (e.target.id === 'record-book') {
        this.selectedBook = e.target.value;
      }

      if (e.target.id === 'record-book-name') {
        this.bookRecordName = e.target.value;
      }
    });

    this.container.addEventListener('click', (e) => {
      // 點擊「舊約」按鈕
      const otBtn = e.target.closest('#btn-testament-ot');
      if (otBtn) {
        this.selectedTestament = 'OT';
        this.selectedBook = '創世記';
        this.updateTestamentUI();
        this.updateBooksDropdown();
        return;
      }

      // 點擊「新約」按鈕
      const ntBtn = e.target.closest('#btn-testament-nt');
      if (ntBtn) {
        this.selectedTestament = 'NT';
        this.selectedBook = '馬太福音';
        this.updateTestamentUI();
        this.updateBooksDropdown();
        return;
      }

      // 點擊「讀經」按鈕
      const bibleBtn = e.target.closest('#btn-checkbox-bible');
      if (bibleBtn) {
        this.hasReadBible = !this.hasReadBible;
        if (this.hasReadBible) {
          this.hasReadBook = false; // 互斥：取消選取書報
        }
        this.syncCheckboxUI();
        return;
      }

      // 點擊「書報」按鈕
      const bookBtn = e.target.closest('#btn-checkbox-book');
      if (bookBtn) {
        this.hasReadBook = !this.hasReadBook;
        if (this.hasReadBook) {
          this.hasReadBible = false; // 互斥：取消選取讀經
        }
        this.syncCheckboxUI();
        return;
      }

      // Submit record
      const submitBtn = e.target.closest('#submit-record-btn');
      if (submitBtn) {
        e.preventDefault();
        this.handleSubmit();
      }
    });
  }

  setDate(dateStr) {
    this.selectedDate = dateStr;
    const dateInput = document.getElementById('record-date');
    if (dateInput) {
      dateInput.value = dateStr;
    }
  }

  // 統一控管 UI 的顯示隱藏與選取狀態
  syncCheckboxUI() {
    const chkBible = document.getElementById('chk-bible');
    const chkBook = document.getElementById('chk-book');
    const btnBible = document.getElementById('btn-checkbox-bible');
    const btnBook = document.getElementById('btn-checkbox-book');
    const bibleDetailsBlock = document.getElementById('bible-details-select');
    const bookDetailsBlock = document.getElementById('book-details-select');

    // 同步真實 checkbox 狀態
    if (chkBible) chkBible.checked = this.hasReadBible;
    if (chkBook) chkBook.checked = this.hasReadBook;

    // 同步按鈕高亮樣式
    if (btnBible) btnBible.classList.toggle('checked-bible', this.hasReadBible);
    if (btnBook) btnBook.classList.toggle('checked-book', this.hasReadBook);

    // 同步詳細輸入區塊的顯示與隱藏
    if (bibleDetailsBlock) bibleDetailsBlock.style.display = this.hasReadBible ? 'block' : 'none';
    if (bookDetailsBlock) bookDetailsBlock.style.display = this.hasReadBook ? 'block' : 'none';
  }

  updateTestamentUI() {
    const otBtn = document.getElementById('btn-testament-ot');
    const ntBtn = document.getElementById('btn-testament-nt');
    if (otBtn && ntBtn) {
      if (this.selectedTestament === 'OT') {
        otBtn.classList.add('active');
        ntBtn.classList.remove('active');
      } else {
        otBtn.classList.remove('active');
        ntBtn.classList.add('active');
      }
    }
  }

  updateBooksDropdown() {
    const bookSelect = document.getElementById('record-book');
    if (!bookSelect) return;

    const filteredBooks = BIBLE_BOOKS.filter(book => book.testament === this.selectedTestament);
    bookSelect.innerHTML = filteredBooks.map(book => `
      <option value="${book.name}" ${book.name === this.selectedBook ? 'selected' : ''}>${book.name}</option>
    `).join('');
  }



  async handleSubmit() {
    if (this.container.querySelector('.record-form-container.readonly-mode')) {
      alert("唯讀模式：您只能修改自己的追求紀錄！");
      return;
    }

    if (!this.hasReadBible && !this.hasReadBook) {
      alert("請選擇「讀經」或「讀書報」其中一項！");
      return;
    }

    const submitBtn = document.getElementById('submit-record-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = "儲存中...";

    try {
      const data = {
        date: this.selectedDate,
        hasReadBible: this.hasReadBible,
        hasReadBook: this.hasReadBook,
        bookRecordName: this.hasReadBook ? this.bookRecordName : "",
        bibleRecordName: this.hasReadBible ? this.selectedBook : ""
      };

      await this.onSubmitRecord(data);

      // Reset form states but keep date
      this.resetForm();
    } catch (e) {
      console.error("Submit record failed:", e);
      alert("儲存紀錄失敗！");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-check"><path d="m22 2-10 11-4-4"/><path d="m22 10-7.5 7.5L13 16"/><path d="m14 17-2.5 2.5-4-4"/></svg>
        快速新增紀錄
      `;
    }
  }

  resetForm() {
    this.hasReadBible = false;
    this.hasReadBook = false;
    this.bookRecordName = "";
    this.selectedTestament = "NT";
    this.selectedBook = "馬太福音";

    // 透過統一的 UI 同步函式來重置所有隱藏區塊與狀態
    this.syncCheckboxUI();
    this.updateTestamentUI();
    this.updateBooksDropdown();

    const bookNameInput = document.getElementById('record-book-name');
    if (bookNameInput) bookNameInput.value = "";
  }

  async loadHistoricalNames(userId) {
    if (!userId) return;
    try {
      const historicalNames = await getHistoricalNames(userId);
      const datalist = document.getElementById('book-history-list');
      if (datalist && historicalNames.books) {
        datalist.innerHTML = historicalNames.books
          .map(book => `<option value="${book}">`)
          .join('');
      }
    } catch (e) {
      console.error('Failed to load historical names:', e);
    }
  }

  render({ isReadOnly = false } = {}) {
    const filteredBooks = BIBLE_BOOKS.filter(book => book.testament === this.selectedTestament);
    const bookOptions = filteredBooks.map(book => `
      <option value="${book.name}" ${book.name === this.selectedBook ? 'selected' : ''}>${book.name}</option>
    `).join('');

    this.container.innerHTML = `
      <div class="record-form-container glass-panel ${isReadOnly ? 'readonly-mode' : ''}" style="height: 100%;">
        <h3 class="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          新增追求紀錄
        </h3>
        
        <div class="form-group">
          <label for="record-date">追求日期</label>
          <input type="date" id="record-date" class="input-control" value="${this.selectedDate}">
        </div>

        <div class="checkbox-group">
          <div id="btn-checkbox-bible" class="checkbox-btn">
            <input type="checkbox" id="chk-bible">
            <span>📖 讀經</span>
          </div>
          <div id="btn-checkbox-book" class="checkbox-btn">
            <input type="checkbox" id="chk-book">
            <span>📚 書報</span>
          </div>
        </div>

        <!-- Book Details Selector (Visible only when '書報' is checked) -->
        <div id="book-details-select" style="display: none; animation: fadeIn 0.2s ease; margin-bottom: 12px;">
          <div class="form-group">
            <label for="record-book-name">書報名稱</label>
            <input type="text" id="record-book-name" list="book-history-list" class="input-control" placeholder="請輸入書報名稱..." value="${this.bookRecordName}">
            <datalist id="book-history-list">
              <!-- Options populated by JS -->
            </datalist>
          </div>
        </div>

        <!-- Bible Book Details (Visible only when '讀經' is checked) -->
        <div id="bible-details-select" style="display: none; animation: fadeIn 0.2s ease;">
          <div class="form-group">
            <label>選擇約別</label>
            <div class="testament-selector-group">
              <button type="button" id="btn-testament-ot" class="testament-btn ${this.selectedTestament === 'OT' ? 'active' : ''}">舊約</button>
              <button type="button" id="btn-testament-nt" class="testament-btn ${this.selectedTestament === 'NT' ? 'active' : ''}">新約</button>
            </div>
          </div>
          <div class="form-group">
            <label for="record-book">讀經卷書</label>
            <select id="record-book" class="input-control">
              ${bookOptions}
            </select>
          </div>
        </div>

        <button id="submit-record-btn" class="submit-btn" style="margin-top: auto;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-check"><path d="m22 2-10 11-4-4"/><path d="m22 10-7.5 7.5L13 16"/><path d="m14 17-2.5 2.5-4-4"/></svg>
          快速新增紀錄
        </button>
      </div>
    `;
  }
}