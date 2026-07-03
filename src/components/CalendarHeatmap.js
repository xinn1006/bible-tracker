// CalendarHeatmap Component
export class CalendarHeatmap {
  constructor(containerId, { onSelectDate }) {
    this.container = document.getElementById(containerId);
    this.onSelectDate = onSelectDate;
    this.tooltip = null;
    this.weeksToShow = 18; // Render ~5 months of grid cells
    this.init();
  }

  init() {
    this.createTooltip();

    // Bind click events on calendar days to fill form date
    this.container.addEventListener('click', (e) => {
      const dayCell = e.target.closest('.heatmap-day');
      if (dayCell && !dayCell.classList.contains('future')) {
        const dateStr = dayCell.dataset.date;
        if (this.onSelectDate) {
          this.onSelectDate(dateStr);
        }
      }
    });

    // Handle tooltip mouse moves
    this.container.addEventListener('mouseover', (e) => {
      const dayCell = e.target.closest('.heatmap-day');
      if (dayCell) {
        this.showTooltip(dayCell, e);
      }
    });

    this.container.addEventListener('mouseout', (e) => {
      if (e.target.closest('.heatmap-day')) {
        this.hideTooltip();
      }
    });
  }

  createTooltip() {
    this.tooltip = document.getElementById('heatmap-tooltip');
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'heatmap-tooltip';
      this.tooltip.className = 'tooltip';
      document.body.appendChild(this.tooltip);
    }
  }

  showTooltip(element, event) {
    const dateStr = element.dataset.date;
    const status = element.dataset.status;
    const isCollective = element.dataset.collective === 'true';
    const bookTitle = element.dataset.bookTitle || '';
    const bibleTitle = element.dataset.bibleTitle || '';

    const bibleTag = bibleTitle ? `<span style="color:#000000;">📖 ${bibleTitle}</span>` : '';
    const bookTag = bookTitle ? `<span style="color:#000000;">📚 ${bookTitle}</span>` : '';

    let statusText = "無填寫紀錄";
    if (status === 'both') {
      statusText = `${bibleTag}<br/>${bookTag}`;
    } else if (status === 'bible') {
      statusText = `${bibleTag}`;
    } else if (status === 'book') {
      statusText = `${bookTag}`;
    } else if (status === 'alert') {
      statusText = "集體追求日（未填寫）⚠️";
    }

    const collectiveLabel = isCollective ? " <span style='color: #f97316; font-weight:bold;'>(集體追求日)</span>" : "";

    this.tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 2px;">${dateStr}${collectiveLabel}</div>
      <div style="color: var(--text-secondary);">${statusText}</div>
    `;

    // Position tooltip above the cell
    const rect = element.getBoundingClientRect();
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    this.tooltip.style.top = `${rect.top + window.scrollY - 8}px`;
  }

  hideTooltip() {
    this.tooltip.style.display = 'none';
  }

  getDatesGrid() {
    const grid = [];
    const today = new Date();
    const todayStr = this.formatDate(today);

    // Set range ending on Saturday of the current week
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - dayOfWeek)); // Roll forward to Saturday (6)

    const totalDays = this.weeksToShow * 7;
    const startDate = new Date(endDate.getTime() - (totalDays - 1) * 24 * 60 * 60 * 1000);

    const runner = new Date(startDate);
    const todayCompare = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    for (let i = 0; i < totalDays; i++) {
      const runnerStr = this.formatDate(runner);
      const runnerDayOfWeek = runner.getDay();

      const isToday = runnerStr === todayStr;
      const isFuture = runner.getTime() > todayCompare;

      grid.push({
        dateStr: runnerStr,
        dayOfWeek: runnerDayOfWeek,
        isCollectiveDay: false,
        isToday,
        isFuture,
        month: runner.getMonth(),
        year: runner.getFullYear(),
        dayOfMonth: runner.getDate()
      });

      runner.setDate(runner.getDate() + 1);
    }
    return grid;
  }

  formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  render({ dailyRecords }) {
    // Organize records into hash map for quick lookups
    const recordsMap = {};
    dailyRecords.forEach(rec => {
      recordsMap[rec.date] = rec;
    });

    const datesGrid = this.getDatesGrid();

    // Group dates by week to render column-by-column
    const columns = [];
    for (let i = 0; i < datesGrid.length; i += 7) {
      columns.push(datesGrid.slice(i, i + 7));
    }

    // Generate Month Labels
    const monthLabelsHTML = [];
    let prevMonth = -1;
    const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

    columns.forEach((week, weekIdx) => {
      // Pick Wednesday of the week to place month label
      const midDay = week[3];
      if (midDay.month !== prevMonth) {
        monthLabelsHTML.push(`
          <span class="month-label" style="left: ${weekIdx * 18 + 32}px;">
            ${months[midDay.month]}
          </span>
        `);
        prevMonth = midDay.month;
      }
    });

    // Render Grid Cells
    const gridColumnsHTML = columns.map(week => {
      const cellsHTML = week.map(day => {
        let stateClass = 'state-none';
        let status = 'none';
        let bookRecordName = '';
        let bibleRecordName = '';

        if (day.isFuture) {
          stateClass = 'future';
        } else {
          const rec = recordsMap[day.dateStr];
          const hasReadBible = rec ? rec.hasReadBible : false;
          const hasReadBook = rec ? rec.hasReadBook : false;
          bookRecordName = rec && rec.bookRecordName ? rec.bookRecordName : '';
          bibleRecordName = rec && rec.bibleRecordName ? rec.bibleRecordName : '';

          if (hasReadBible && hasReadBook) {
            stateClass = 'state-both';
            status = 'both';
          } else if (hasReadBible) {
            stateClass = 'state-bible';
            status = 'bible';
          } else if (hasReadBook) {
            stateClass = 'state-book';
            status = 'book';
          }
        }

        const borderStyle = day.isToday ? 'border: 1.5px solid var(--accent-color);' : '';

        return `
          <div class="heatmap-day ${stateClass}" 
               data-date="${day.dateStr}" 
               data-status="${status}" 
               data-collective="${day.isCollectiveDay}"
               data-book-title="${bookRecordName}"
               data-bible-title="${bibleRecordName}"
               style="${borderStyle}">
          </div>
        `;
      }).join('');

      return `<div class="heatmap-week-column">${cellsHTML}</div>`;
    }).join('');

    this.container.innerHTML = `
      <div class="heatmap-container glass-panel">
        <h3 class="panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
          個人每日追求
        </h3>
        
        <div class="heatmap-wrapper">
          <div class="heatmap-header-months">
            ${monthLabelsHTML.join('')}
          </div>
          <div class="heatmap-body-container">
            <div class="heatmap-weekdays">
              <span>日</span>
              <span>一</span>
              <span>二</span>
              <span>三</span>
              <span>四</span>
              <span>五</span>
              <span>六</span>
            </div>
            <div class="heatmap-grid">
              ${gridColumnsHTML}
            </div>
          </div>
        </div>

        <div class="heatmap-legend">
          <span>少</span>
          <div class="legend-item"><div class="legend-box" style="background-color: var(--color-none)"></div><span>無紀錄</span></div>
          <div class="legend-item"><div class="legend-box" style="background-color: var(--color-bible)"></div><span>讀經</span></div>
          <div class="legend-item"><div class="legend-box" style="background-color: var(--color-book)"></div><span>書報</span></div>
          <div class="legend-item"><div class="legend-box" style="background-color: var(--color-both)"></div><span>雙追求</span></div>
          <span>多</span>
        </div>
      </div>
    `;
  }
}
