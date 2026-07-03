// UserSelector Component
export class UserSelector {
  constructor(containerId, { onSelectUser, onEditUser }) {
    this.container = document.getElementById(containerId);
    this.onSelectUser = onSelectUser;
    this.onEditUser = onEditUser; // 新增編輯回呼
    this.selectedUserId = null;
    this.users = [];
    this.selectedAvatar = "🧑";
    this.editingUserId = null; // 紀錄正在編輯哪位使用者

    this.init();
  }

  init() {
    this.container.addEventListener('click', (e) => {
      // 點擊編輯按鈕
      const editBtn = e.target.closest('.edit-profile-btn');
      if (editBtn) {
        e.stopPropagation(); // 阻止觸發卡片的點擊選取
        const card = editBtn.closest('.user-card');
        const userId = card.dataset.id;
        const user = this.users.find(u => u.id === userId);
        if (user) this.openEditModal(user);
        return;
      }

      // 點擊切換使用者
      const card = e.target.closest('.user-card');
      if (card) {
        const userId = card.dataset.id;
        if (userId !== this.selectedUserId) {
          this.onSelectUser(userId);
        }
        return;
      }
    });

    this.createEditModal();
  }

  createEditModal() {
    if (document.getElementById('edit-user-modal-overlay')) return;

    const modalHTML = `
      <div id="edit-user-modal-overlay" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3>編輯個人資料</h3>
            <button id="edit-user-close-btn" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="edit-user-name">姓名</label>
              <input type="text" id="edit-user-name" class="input-control" placeholder="請輸入姓名..." maxlength="10">
            </div>
            <div class="form-group" style="margin-top: 16px;">
              <label>選擇頭像</label>
              <div id="edit-avatar-picker-grid" class="avatar-grid">
                </div>
            </div>
          </div>
          <div class="modal-footer">
            <button id="edit-user-cancel-btn" class="btn btn-secondary">取消</button>
            <button id="edit-user-submit-btn" class="btn btn-primary">儲存變更</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const emojis = ["🐨", "🐥", "🐧", "🐱", "🐶", "🐰", "🐷", "🐭", "🐻‍❄️", "🕊️", "🦄", "🦁", "🐼", "🥞", "☕", "☀️", "🌙", "⭐", "🍀", "🎃", "🧚", "🫧", "☁️", "❄️"];
    const pickerGrid = document.getElementById('edit-avatar-picker-grid');
    pickerGrid.innerHTML = emojis.map((emoji) => `
      <div class="avatar-option" data-emoji="${emoji}">${emoji}</div>
    `).join('');

    const overlay = document.getElementById('edit-user-modal-overlay');
    const closeBtn = document.getElementById('edit-user-close-btn');
    const cancelBtn = document.getElementById('edit-user-cancel-btn');
    const submitBtn = document.getElementById('edit-user-submit-btn');
    const nameInput = document.getElementById('edit-user-name');

    const closeModal = () => {
      overlay.classList.remove('open');
      this.editingUserId = null;
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    pickerGrid.addEventListener('click', (e) => {
      const option = e.target.closest('.avatar-option');
      if (option) {
        pickerGrid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedAvatar = option.dataset.emoji;
      }
    });

    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("姓名不能為空！");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "儲存中...";

      try {
        await this.onEditUser(this.editingUserId, {
          name: name,
          avatar: this.selectedAvatar
        });
        closeModal();
      } catch (err) {
        console.error("Failed to edit user:", err);
        alert("儲存失敗！");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "儲存變更";
      }
    });
  }

  openEditModal(user) {
    this.editingUserId = user.id;
    this.selectedAvatar = user.avatar || "🧑";
    const overlay = document.getElementById('edit-user-modal-overlay');
    const nameInput = document.getElementById('edit-user-name');

    if (overlay) {
      nameInput.value = user.name;

      // 更新 Emoji 選取狀態
      const options = overlay.querySelectorAll('.avatar-option');
      options.forEach((el) => {
        if (el.dataset.emoji === this.selectedAvatar) {
          el.classList.add('selected');
        } else {
          el.classList.remove('selected');
        }
      });

      overlay.classList.add('open');
      nameInput.focus();
    }
  }

  render({ users, selectedUserId, currentAuthUid }) {
    this.users = users;
    this.selectedUserId = selectedUserId;

    const cardsHTML = users.map(user => {
      const isActive = user.id === selectedUserId;
      const isMe = user.id === currentAuthUid;

      // 只有在是「自己」的卡片上，才會渲染編輯按鈕 (鉛筆 icon)
      const editBtnHTML = isMe ? `<div class="edit-profile-btn" title="編輯個人資料">✎</div>` : '';

      return `
        <div class="user-card ${isActive ? 'active' : ''} ${isMe ? 'me' : ''}" data-id="${user.id}">
          ${editBtnHTML}
          <div class="user-avatar">${user.avatar || '🧑'}</div>
          <div class="user-name">${user.name}</div>
          <div class="user-role">${user.role === 'admin' ? '管理者' : '成員'}</div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="user-list-scroll">
        ${cardsHTML}
      </div>
    `;
  }
}