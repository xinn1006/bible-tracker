// App Entry & State Orchestrator
import {
  initializeDatabase,
  getUsers,
  saveUser,
  updateUserProfile,
  getDailyRecords,
  saveDailyRecord,
  getBibleMatrix,
  updateBibleChapter,
  updateBibleChaptersBatch,
  signInWithGoogle,
  signOutUser,
  observeAuthState
} from './config/firebase.js';

import { UserSelector } from './components/UserSelector.js';
import { CalendarHeatmap } from './components/CalendarHeatmap.js';
import { QuickRecordForm } from './components/QuickRecordForm.js';
import { BibleGridView } from './components/BibleGridView.js';

class App {
  constructor() {
    this.state = {
      users: [],
      selectedUserId: null,
      dailyRecords: [],
      bibleMatrix: [],
      currentBookName: "馬太福音",
      currentAuthUid: null
    };

    this.components = {};
  }

  async start() {
    await initializeDatabase();

    const badge = document.getElementById('db-status-badge');
    if (badge) {
      badge.className = 'status-badge firebase';
      badge.innerHTML = `
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#10b981;"></span>
        已連線
      `;
    }

    this.setupAuthModal();

    // 實例化元件 (移除 onAddUser，加入 onEditUser)
    this.components.userSelector = new UserSelector('user-selector-root', {
      onSelectUser: (userId) => this.handleSelectUser(userId),
      onEditUser: (userId, userData) => this.handleEditUser(userId, userData)
    });

    this.components.calendarHeatmap = new CalendarHeatmap('calendar-heatmap-root', {
      onSelectDate: (dateStr) => this.handleSelectDate(dateStr)
    });

    this.components.quickRecordForm = new QuickRecordForm('quick-record-form-root', {
      onSubmitRecord: (recordData) => this.handleSubmitRecord(recordData)
    });

    this.components.bibleGridView = new BibleGridView('bible-grid-view-root', {
      onToggleChapter: (bookName, chapter, isRead) => this.handleToggleChapter(bookName, chapter, isRead),
      onToggleAllChapters: (bookName, isRead) => this.handleToggleAllChapters(bookName, isRead)
    });

    observeAuthState(async (user) => {
      await this.handleAuthStateChanged(user);
    });
  }

  async handleAuthStateChanged(user) {
    if (user) {
      this.state.currentAuthUid = user.uid;
      this.state.users = await getUsers();

      const exists = this.state.users.some(u => u.id === user.uid);
      if (!exists) {
        let name = user.displayName || "新成員";
        let avatar = "👶";
        await saveUser({
          id: user.uid,
          name: name,
          avatar: avatar,
          role: "user"
        });
        this.state.users = await getUsers();
      }

      document.getElementById('btn-login-trigger').style.display = 'none';
      document.getElementById('auth-user-info').style.display = 'inline-flex';

      const badge = document.getElementById('auth-user-badge');
      badge.innerHTML = `
        <span style="font-size:9px; background:rgba(0,0,0,0.05); padding:2px 5px; border-radius:6px; margin-right:4px;">
          帳號
        </span>
        <strong>${user.displayName || '成員'}</strong>
      `;

      this.state.selectedUserId = user.uid;
      await this.loadUserData(user.uid);
    } else {
      this.state.currentAuthUid = null;
      document.getElementById('btn-login-trigger').style.display = 'inline-block';
      document.getElementById('auth-user-info').style.display = 'none';

      this.state.users = await getUsers();
      if (this.state.users.length > 0) {
        this.state.selectedUserId = this.state.users[0].id;
        await this.loadUserData(this.state.selectedUserId);
      }
    }

    this.renderAll();
  }

  setupAuthModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    const closeBtn = document.getElementById('auth-modal-close-btn');
    const triggerBtn = document.getElementById('btn-login-trigger');
    const googleBtn = document.getElementById('btn-google-login');
    const logoutBtn = document.getElementById('btn-auth-logout');

    const openModal = () => overlay.classList.add('open');
    const closeModal = () => overlay.classList.remove('open');

    triggerBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    googleBtn.addEventListener('click', async () => {
      try {
        googleBtn.disabled = true;
        googleBtn.textContent = "登入中...";
        await signInWithGoogle();
        closeModal();
      } catch (err) {
        console.error("Google login failed", err);
        alert("Google 登入失敗！");
      } finally {
        googleBtn.disabled = false;
        googleBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Google 帳號快速登入
        `;
      }
    });

    logoutBtn.addEventListener('click', async () => {
      if (confirm("確定要登出嗎？")) {
        await signOutUser();
      }
    });
  }

  async loadUserData(userId) {
    try {
      this.state.dailyRecords = await getDailyRecords(userId);
      this.state.bibleMatrix = await getBibleMatrix(userId);
    } catch (e) {
      console.error(`Failed to load data for user ${userId}:`, e);
    }
  }

  renderAll() {
    const isReadOnly = this.state.selectedUserId !== this.state.currentAuthUid;

    this.components.userSelector.render({
      users: this.state.users,
      selectedUserId: this.state.selectedUserId,
      currentAuthUid: this.state.currentAuthUid
    });

    this.components.calendarHeatmap.render({
      dailyRecords: this.state.dailyRecords
    });

    this.components.quickRecordForm.render({
      isReadOnly: isReadOnly
    });
    this.components.quickRecordForm.loadHistoricalNames(this.state.selectedUserId);

    this.components.bibleGridView.render({
      bibleMatrix: this.state.bibleMatrix,
      currentBookName: this.state.currentBookName,
      isReadOnly: isReadOnly
    });
  }

  async handleSelectUser(userId) {
    this.state.selectedUserId = userId;
    const isReadOnly = userId !== this.state.currentAuthUid;

    this.components.userSelector.render({
      users: this.state.users,
      selectedUserId: userId,
      currentAuthUid: this.state.currentAuthUid
    });

    await this.loadUserData(userId);

    this.components.calendarHeatmap.render({ dailyRecords: this.state.dailyRecords });
    this.components.quickRecordForm.render({ isReadOnly: isReadOnly });
    this.components.quickRecordForm.loadHistoricalNames(userId);
    this.components.bibleGridView.render({
      bibleMatrix: this.state.bibleMatrix,
      currentBookName: this.state.currentBookName,
      isReadOnly: isReadOnly
    });
  }

  // 處理編輯個人資料
  async handleEditUser(userId, userData) {
    await updateUserProfile(userId, userData);
    // 更新本地狀態
    const idx = this.state.users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      this.state.users[idx] = { ...this.state.users[idx], ...userData };
    }
    // 重新渲染清單
    this.components.userSelector.render({
      users: this.state.users,
      selectedUserId: this.state.selectedUserId,
      currentAuthUid: this.state.currentAuthUid
    });
  }

  handleSelectDate(dateStr) {
    this.components.quickRecordForm.setDate(dateStr);
  }

  async handleSubmitRecord(recordData) {
    const userId = this.state.selectedUserId;
    if (!userId) return;

    if (userId !== this.state.currentAuthUid) {
      alert("唯讀模式：您只能修改自己的追求紀錄！");
      return;
    }

    await saveDailyRecord(userId, recordData.date, recordData.hasReadBible, recordData.hasReadBook, recordData.bookRecordName, recordData.bibleRecordName);

    if (recordData.hasReadBible && recordData.bibleProgress) {
      const { bookName, chapter } = recordData.bibleProgress;
      await updateBibleChapter(userId, bookName, chapter, true);
      this.state.currentBookName = bookName;
    }

    await this.loadUserData(userId);

    this.components.calendarHeatmap.render({ dailyRecords: this.state.dailyRecords });
    this.components.bibleGridView.render({
      bibleMatrix: this.state.bibleMatrix,
      currentBookName: this.state.currentBookName
    });
  }

  async syncTodayBibleFlag(userId) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const existing = this.state.dailyRecords.find(r => r.date === dateStr);
    const hasReadBook = existing ? existing.hasReadBook : false;
    const bookRecordName = existing ? existing.bookRecordName : "";
    const bibleRecordName = existing ? existing.bibleRecordName : "";

    await saveDailyRecord(userId, dateStr, true, hasReadBook, bookRecordName, bibleRecordName);
  }

  async handleToggleChapter(bookName, chapter, isRead) {
    const userId = this.state.selectedUserId;
    if (!userId) return;

    if (userId !== this.state.currentAuthUid) {
      alert("唯讀模式：您只能修改自己的追求紀錄！");
      throw new Error("Readonly mode: cannot modify another user's record.");
    }

    this.state.currentBookName = bookName;

    try {
      await updateBibleChapter(userId, bookName, chapter, isRead);
      if (isRead) {
        await this.syncTodayBibleFlag(userId);
      }
      await this.loadUserData(userId);
      this.components.calendarHeatmap.render({ dailyRecords: this.state.dailyRecords });
      this.components.bibleGridView.render({
        bibleMatrix: this.state.bibleMatrix,
        currentBookName: this.state.currentBookName
      });
    } catch (err) {
      console.error("Failed to sync chapter toggle:", err);
      throw err;
    }
  }

  async handleToggleAllChapters(bookName, isRead) {
    const userId = this.state.selectedUserId;
    if (!userId) return;

    if (userId !== this.state.currentAuthUid) {
      alert("唯讀模式：您只能修改自己的追求紀錄！");
      throw new Error("Readonly mode: cannot modify another user's record.");
    }

    this.state.currentBookName = bookName;

    try {
      const { BIBLE_BOOKS } = await import('./constants/bibleData.js');
      const bookMeta = BIBLE_BOOKS.find(b => b.name === bookName);
      if (!bookMeta) return;

      const chapters = Array.from({ length: bookMeta.chapters }, (_, i) => i + 1);
      await updateBibleChaptersBatch(userId, bookName, chapters, isRead);

      if (isRead) {
        await this.syncTodayBibleFlag(userId);
      }
      await this.loadUserData(userId);
      this.components.calendarHeatmap.render({ dailyRecords: this.state.dailyRecords });
      this.components.bibleGridView.render({
        bibleMatrix: this.state.bibleMatrix,
        currentBookName: this.state.currentBookName
      });
    } catch (err) {
      console.error("Failed to sync toggle-all chapters:", err);
      throw err;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});