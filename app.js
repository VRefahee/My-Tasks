/**
 * تقویم شمسی جلالی دقیق (الگوریتم دقیق تبدیل میلادی به شمسی بدون نیاز به کتابخانه خارجی)
 */
const JalaliDate = {
  gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
      Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy, jm, jd };
  },

  jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) +
      78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    const gd_m = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    while (gm < 12 && days > gd_m[gm]) {
      days -= gd_m[gm];
      gm++;
    }
    return { gy, gm, gd: days };
  },

  getTodayJalali() {
    const now = new Date();
    return this.gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  },

  formatJalali(jObj) {
    const m = String(jObj.jm).padStart(2, '0');
    const d = String(jObj.jd).padStart(2, '0');
    return `${jObj.jy}/${m}/${d}`;
  },

  getMonthName(monthNum) {
    const months = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    return months[monthNum - 1] || '';
  },

  getDaysInMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    // محاسبه کبیسه شمسی
    const g = this.jalaliToGregorian(jy, 12, 29);
    const nextG = new Date(g.gy, g.gm - 1, g.gd + 1);
    const nextJ = this.gregorianToJalali(nextG.getFullYear(), nextG.getMonth() + 1, nextG.getDate());
    return nextJ.jm === 12 ? 30 : 29;
  },

  getFirstDayOfMonthWeekday(jy, jm) {
    const g = this.jalaliToGregorian(jy, jm, 1);
    const date = new Date(g.gy, g.gm - 1, g.gd);
    // روز شنبه = 0 در تقویم ایرانی (در جاوااسکریپت یکشنبه=0 است)
    const day = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    return (day + 1) % 7; // شنبه = 0, یکشنبه = 1, ... جمعه = 6
  }
};

/**
 * مدیریت ذخیره‌سازی آفلاین و دیتابیس کارهای روزانه و تاریخچه
 */
const StorageManager = {
  KEY_TASKS: 'dayflow_v2_current_tasks',
  KEY_LAST_DATE: 'dayflow_v2_last_active_date',
  KEY_HISTORY: 'dayflow_v2_history_archive',

  getTasks() {
    try {
      const data = localStorage.getItem(this.KEY_TASKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveTasks(tasks) {
    localStorage.setItem(this.KEY_TASKS, JSON.stringify(tasks));
  },

  getHistory() {
    try {
      const data = localStorage.getItem(this.KEY_HISTORY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  saveHistory(history) {
    localStorage.setItem(this.KEY_HISTORY, JSON.stringify(history));
  },

  /**
   * چک کردن عبور از ساعت 12 شب و بایگانی خودکار کارهای روز قبل
   */
  checkAndArchiveDayTransition() {
    const todayStr = JalaliDate.formatJalali(JalaliDate.getTodayJalali());
    const lastDate = localStorage.getItem(this.KEY_LAST_DATE);

    if (!lastDate) {
      localStorage.setItem(this.KEY_LAST_DATE, todayStr);
      return;
    }

    if (lastDate !== todayStr) {
      // روز عوض شده است -> کارهای روز قبل را به تاریخچه منتقل کن
      const currentTasks = this.getTasks();
      if (currentTasks.length > 0) {
        const history = this.getHistory();
        history[lastDate] = currentTasks.map(t => ({
          ...t,
          isLocked: true // در تاریخچه همه قفل هستند
        }));
        this.saveHistory(history);
      }
      // خالی کردن تسک‌ها برای روز جدید
      this.saveTasks([]);
      localStorage.setItem(this.KEY_LAST_DATE, todayStr);
    }
  }
};

/**
 * وضعیت اپلیکیشن و رابط کاربری
 */
let currentView = 'today'; // 'today' | 'history'
let historySelectedDate = null;
let currentCalYear = 1405;
let currentCalMonth = 7;

// راه‌اندازی اولیه
document.addEventListener('DOMContentLoaded', () => {
  // بررسی روز جدید
  StorageManager.checkAndArchiveDayTransition();

  const today = JalaliDate.getTodayJalali();
  currentCalYear = today.jy;
  currentCalMonth = today.jm;
  historySelectedDate = JalaliDate.formatJalali(today);

  setupEventListeners();
  updateLiveClock();
  updateFabVisibility();
  renderApp();

  // بروزرسانی زنده ثانیه‌ای برای ساعت و خط زمان گوشی
  setInterval(() => {
    updateLiveClock();
    StorageManager.checkAndArchiveDayTransition();
    if (currentView === 'today') {
      renderTimeline();
    }
  }, 1000);

  // بررسی وضعیت و قفل شدن کارت‌های وظایف هر 10 ثانیه
  setInterval(() => {
    if (currentView === 'today') {
      renderTaskList();
    }
  }, 10000);
});

function populateTimePickerOptions() {
  const startHour = document.getElementById('start-hour');
  const startMin = document.getElementById('start-minute');
  const endHour = document.getElementById('end-hour');
  const endMin = document.getElementById('end-minute');
  if (!startHour || !startMin || !endHour || !endMin) return;

  startHour.innerHTML = '';
  for (let h = 6; h < 24; h++) {
    const val = String(h).padStart(2, '0');
    startHour.add(new Option(val, val));
  }

  endHour.innerHTML = '';
  for (let h = 6; h <= 24; h++) {
    const val = String(h).padStart(2, '0');
    endHour.add(new Option(val, val));
  }

  startMin.innerHTML = '';
  endMin.innerHTML = '';
  // گام‌های ۵ دقیقه‌ای شیک و تمیز
  for (let m = 0; m < 60; m += 5) {
    const val = String(m).padStart(2, '0');
    startMin.add(new Option(val, val));
    endMin.add(new Option(val, val));
  }

  // مقادیر پیش‌فرض هوشمند (ساعت فعلی در بازه ۶ تا ۲۴ یا حداقل ۶ صبح)
  const now = new Date();
  let currentH = Math.max(6, Math.min(23, now.getHours()));
  let nextH = Math.min(24, currentH + 1);
  startHour.value = String(currentH).padStart(2, '0');
  startMin.value = '00';
  endHour.value = String(nextH).padStart(2, '0');
  endMin.value = '00';

  const updateRangeSummary = () => {
    const st = `${startHour.value}:${startMin.value}`;
    const et = `${endHour.value}:${endMin.value}`;
    const summaryEl = document.getElementById('summary-range-text');
    if (summaryEl) {
      summaryEl.textContent = `از ساعت ${st} تا ${et}`;
    }
  };

  startHour.addEventListener('change', updateRangeSummary);
  startMin.addEventListener('change', updateRangeSummary);
  endHour.addEventListener('change', updateRangeSummary);
  endMin.addEventListener('change', updateRangeSummary);
  updateRangeSummary();
}

function setupEventListeners() {
  populateTimePickerOptions();

  // تب‌های ناوبری
  document.getElementById('nav-today').addEventListener('click', () => switchView('today'));
  document.getElementById('nav-history').addEventListener('click', () => switchView('history'));

  // دکمه باز کردن مدال افزودن
  document.getElementById('btn-add-task').addEventListener('click', () => {
    document.getElementById('task-modal').classList.remove('hidden');
    // به‌روزرسانی ساعت پیش‌فرض به ساعت فعلی هنگام باز شدن مدال (در بازه ۶ تا ۲۴)
    const now = new Date();
    const curH = Math.max(6, Math.min(23, now.getHours()));
    const nxtH = Math.min(24, curH + 1);
    const sh = document.getElementById('start-hour');
    const eh = document.getElementById('end-hour');
    if (sh && eh) {
      sh.value = String(curH).padStart(2, '0');
      eh.value = String(nxtH).padStart(2, '0');
      const summaryEl = document.getElementById('summary-range-text');
      const sm = document.getElementById('start-minute').value;
      const em = document.getElementById('end-minute').value;
      if (summaryEl) summaryEl.textContent = `از ساعت ${sh.value}:${sm} تا ${eh.value}:${em}`;
    }
    document.getElementById('task-title').focus();
  });

  // بستن مدال
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', closeModal);

  // سابمیت فرم
  document.getElementById('task-form').addEventListener('submit', handleAddTask);

  // پاکسازی کامل اطلاعات برنامه
  const resetBtn = document.getElementById('btn-reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('آیا از پاکسازی تمام کارها و اطلاعات تاریخچه اطمینان دارید؟')) {
        localStorage.removeItem(StorageManager.KEY_TASKS);
        localStorage.removeItem(StorageManager.KEY_HISTORY);
        StorageManager.saveTasks([]);
        StorageManager.saveHistory({});
        renderTimeline();
        renderTaskList();
        if (currentView === 'history') {
          renderCalendar();
          renderHistoryTasks();
        }
        alert('تمام داده‌های برنامه با موفقیت پاکسازی شد.');
      }
    });
  }

  // ناوبری ماه‌های تقویم
  document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
}

function closeModal() {
  document.getElementById('task-modal').classList.add('hidden');
  document.getElementById('task-form').reset();
}

function updateFabVisibility() {
  const fab = document.getElementById('btn-add-task');
  if (!fab) return;
  const todayStr = JalaliDate.formatJalali(JalaliDate.getTodayJalali());
  
  if (currentView === 'today') {
    fab.classList.remove('hidden');
  } else if (currentView === 'history') {
    // در تاریخچه: فقط اگر تاریخ انتخاب شده همان تاریخ امروز باشد دکمه نمایش داده شود
    if (historySelectedDate === todayStr) {
      fab.classList.remove('hidden');
    } else {
      fab.classList.add('hidden');
    }
  }
}

function switchView(view) {
  currentView = view;
  const navToday = document.getElementById('nav-today');
  const navHistory = document.getElementById('nav-history');
  const viewToday = document.getElementById('view-today');
  const viewHistory = document.getElementById('view-history');

  if (view === 'today') {
    navToday.classList.add('active');
    navHistory.classList.remove('active');
    viewToday.classList.remove('hidden');
    viewHistory.classList.add('hidden');
    renderTimeline();
    renderTaskList();
  } else {
    navToday.classList.remove('active');
    navHistory.classList.add('active');
    viewToday.classList.add('hidden');
    viewHistory.classList.remove('hidden');
    renderCalendar();
    renderHistoryTasks();
  }
  updateFabVisibility();
}

function updateLiveClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const today = JalaliDate.getTodayJalali();
  const dateStr = `${today.jd} ${JalaliDate.getMonthName(today.jm)} ${today.jy}`;

  const clockEl = document.getElementById('live-time');
  const dateEl = document.getElementById('live-date');
  if (clockEl) clockEl.textContent = `${hours}:${minutes}:${seconds}`;
  if (dateEl) dateEl.textContent = dateStr;
}

function handleAddTask(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const sh = document.getElementById('start-hour').value;
  const sm = document.getElementById('start-minute').value;
  const eh = document.getElementById('end-hour').value;
  const em = document.getElementById('end-minute').value;

  const startTime = `${sh}:${sm}`;
  const endTime = `${eh}:${em}`;

  if (!title) return;

  if (startTime >= endTime) {
    alert('ساعت پایان باید بعد از ساعت شروع باشد.');
    return;
  }

  const tasks = StorageManager.getTasks();
  const newTask = {
    id: 'task_' + Date.now(),
    title,
    startTime,
    endTime,
    completed: false,
    createdAt: Date.now()
  };

  tasks.push(newTask);
  // مرتب‌سازی بر اساس ساعت شروع
  tasks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  StorageManager.saveTasks(tasks);

  closeModal();
  if (currentView === 'today') {
    renderTimeline();
    renderTaskList();
  } else if (currentView === 'history') {
    renderCalendar();
    renderHistoryTasks();
  }
}

/**
 * تعیین وضعیت کار با توجه به زمان فعلی گوشی
 * 'future' | 'passed-done' | 'passed-missed'
 */
function getTaskState(task) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [endH, endM] = task.endTime.split(':').map(Number);
  const taskEndMinutes = endH * 60 + endM;

  // اگر حتی 1 دقیقه از زمان پایان کار گذشته باشد
  const hasPassed = currentMinutes > taskEndMinutes;

  if (!hasPassed) {
    return {
      status: 'pending',
      badgeClass: 'badge-pending',
      badgeText: task.completed ? 'آماده (تیک خورده)' : 'در انتظار انجام',
      canDelete: true,
      canToggle: true
    };
  } else {
    // از زمان کار گذشته است: قفل شده و غیرقابل حذف
    if (task.completed) {
      return {
        status: 'passed-done',
        badgeClass: 'badge-done',
        badgeText: 'انجام شد ✓',
        canDelete: false,
        canToggle: false // پس از گذشت زمان تغییر نمی‌کند
      };
    } else {
      return {
        status: 'passed-missed',
        badgeClass: 'badge-missed',
        badgeText: 'انجام نشد ✕',
        canDelete: false,
        canToggle: false
      };
    }
  }
}

function toggleTaskComplete(taskId) {
  const tasks = StorageManager.getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const state = getTaskState(task);
  if (!state.canToggle) {
    alert('زمان این کار گذشته است و وضعیت آن تثبیت شده و قابل تغییر نیست.');
    return;
  }

  task.completed = !task.completed;
  StorageManager.saveTasks(tasks);
  renderTimeline();
  renderTaskList();
}

function deleteTask(taskId) {
  const tasks = StorageManager.getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const state = getTaskState(task);
  if (!state.canDelete) {
    alert('از ساعت این کار گذشته است و دیگر امکان حذف آن وجود ندارد.');
    return;
  }

  if (confirm(`آیا از حذف کار "${task.title}" مطمئن هستید؟`)) {
    const updated = tasks.filter(t => t.id !== taskId);
    StorageManager.saveTasks(updated);
    renderTimeline();
    renderTaskList();
  }
}

/**
 * رسم نمودار زمانی ۲۴ ساعته افقی و نشانگر ساعت زنده
 */
function renderTimeline() {
  const container = document.getElementById('timeline-chart');
  if (!container) return;

  const tasks = StorageManager.getTasks();
  const now = new Date();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const totalSeconds = 24 * 3600;
  const nowPercent = (nowSeconds / totalSeconds) * 100;
  const totalMinutes = 24 * 60;

  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // پاک کردن و بازسازی
  container.innerHTML = `
    <div class="timeline-now-line" style="left: ${nowPercent}%" title="ساعت فعلی: ${timeLabel}">
      <div class="now-pin">${timeLabel}</div>
    </div>
  `;

  // افزودن تسک‌ها به روی نمودار
  tasks.forEach(task => {
    const [sh, sm] = task.startTime.split(':').map(Number);
    const [eh, em] = task.endTime.split(':').map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    const left = (startM / totalMinutes) * 100;
    const width = Math.max(((endM - startM) / totalMinutes) * 100, 1.5);

    const state = getTaskState(task);
    let colorClass = 'block-pending';
    if (state.status === 'passed-done') colorClass = 'block-done';
    if (state.status === 'passed-missed') colorClass = 'block-missed';
    if (state.status === 'pending' && task.completed) colorClass = 'block-done';

    const block = document.createElement('div');
    block.className = `timeline-task-block ${colorClass}`;
    block.style.left = `${left}%`;
    block.style.width = `${width}%`;
    block.title = `${task.title} (${task.startTime} تا ${task.endTime})`;
    block.innerHTML = `<span class="timeline-block-label">${task.title}</span>`;
    container.appendChild(block);
  });
}

/**
 * ساختن ردیف‌های جدول ۲۴ ساعته برای هر ساعت شبانه‌روز
 */
function buildScheduleTableHTML(tasks, isInteractive) {
  const now = new Date();
  const currentHour = now.getHours();

  // تفکیک تسک‌ها برای تمام ساعات تحت پوشش در بازه ۶ صبح تا ۱۲ شب (ساعت ۶ تا ۲۳)
  // مثلا کاری از ساعت 8 تا 14 در تمام ساعات 8, 9, 10, 11, 12, 13, 14 ثبت و نمایش داده می‌شود
  const tasksByHour = {};
  for (let h = 6; h < 24; h++) {
    tasksByHour[h] = [];
  }

  tasks.forEach(task => {
    const [startH, startM] = task.startTime.split(':').map(Number);
    const [endH, endM] = task.endTime.split(':').map(Number);
    const taskStartMin = startH * 60 + startM;
    const taskEndMin = endH * 60 + endM;

    for (let h = 6; h < 24; h++) {
      const slotStartMin = h * 60;
      const slotEndMin = (h + 1) * 60;

      // یک کار در بازه ساعتی h (از h:00 تا (h+1):00) قرار می‌گیرد اگر بخشی از کار در این بازه انجام شود.
      // بنابراین اگر کار ساعت ۱۰:۰۰ پایان یابد، در ساعت‌های ۷، ۸ و ۹ نمایش داده می‌شود و در ساعت ۱۰ نوشته نمی‌شود
      const isOccurringInHour = (taskStartMin < slotEndMin && taskEndMin > slotStartMin);

      if (isOccurringInHour) {
        tasksByHour[h].push(task);
      }
    }
  });

  let html = '';

  for (let h = 6; h < 24; h++) {
    const hourStr = String(h).padStart(2, '0') + ':00';
    const isCurrent = isInteractive && (h === currentHour);
    const hourTasks = tasksByHour[h];

    let contentHtml = '';
    if (hourTasks.length === 0) {
      contentHtml = `<div class="schedule-empty-slot"><span>—</span> بدون برنامه</div>`;
    } else {
      contentHtml = hourTasks.map(task => {
        if (isInteractive) {
          const state = getTaskState(task);
          return `
            <div class="schedule-task-item ${state.status}">
              <div class="task-checkbox-wrap">
                <input type="checkbox" id="chk-sched-${h}-${task.id}" class="chk-sched-task" data-task-id="${task.id}" ${task.completed ? 'checked' : ''} ${!state.canToggle ? 'disabled' : ''}>
                <label for="chk-sched-${h}-${task.id}"></label>
              </div>
              <div class="schedule-task-info">
                <div class="schedule-task-title ${task.completed ? 'strikethrough' : ''}">${task.title}</div>
                <div class="schedule-task-time-badge">
                  <span class="task-time">⏰ ${task.startTime} تا ${task.endTime}</span>
                  <span class="task-badge ${state.badgeClass}">${state.badgeText}</span>
                </div>
              </div>
              <div class="task-actions">
                ${state.canDelete ? `
                  <button class="btn-icon btn-sched-delete" data-task-id="${task.id}" title="حذف">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                ` : `
                  <span class="locked-icon" title="قفل شده">🔒</span>
                `}
              </div>
            </div>
          `;
        } else {
          // در تاریخچه
          const isDone = task.completed;
          return `
            <div class="schedule-task-item ${isDone ? 'passed-done' : 'passed-missed'}">
              <div class="history-status-icon ${isDone ? 'icon-done' : 'icon-missed'}" style="width: 26px; height: 26px; font-size: 13px;">
                ${isDone ? '✓' : '✕'}
              </div>
              <div class="schedule-task-info">
                <div class="schedule-task-title">${task.title}</div>
                <div class="schedule-task-time-badge">
                  <span class="task-time">⏰ ${task.startTime} تا ${task.endTime}</span>
                  <span class="task-badge ${isDone ? 'badge-done' : 'badge-missed'}">
                    ${isDone ? 'انجام شد' : 'انجام نشد'}
                  </span>
                </div>
              </div>
            </div>
          `;
        }
      }).join('');
    }

    let timeLabel = 'صبح';
    if (h >= 12 && h < 17) timeLabel = 'ظهر/عصر';
    else if (h >= 17 && h < 20) timeLabel = 'غروب';
    else if (h >= 20) timeLabel = 'شب';

    html += `
      <div class="schedule-hour-row ${isCurrent ? 'is-current-hour' : ''}" id="${isInteractive ? 'hour-row-' + h : ''}">
        <div class="schedule-hour-header">
          <span class="schedule-hour-number">${hourStr}</span>
          <span class="schedule-hour-label">${timeLabel}</span>
        </div>
        <div class="schedule-hour-content">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * نمایش جدول زمانبندی ۲۴ ساعته روز جاری
 */
function renderTaskList() {
  const container = document.getElementById('today-schedule-table');
  if (!container) return;

  const tasks = StorageManager.getTasks();
  container.innerHTML = buildScheduleTableHTML(tasks, true);

  // افزودن رویدادهای تیک زدن و حذف به موارد جدول
  const chkBoxes = container.querySelectorAll('.chk-sched-task');
  chkBoxes.forEach(chk => {
    const taskId = chk.getAttribute('data-task-id');
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const state = getTaskState(task);
      if (state.canToggle) {
        chk.addEventListener('change', () => toggleTaskComplete(taskId));
      }
    }
  });

  const delBtns = container.querySelectorAll('.btn-sched-delete');
  delBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = btn.getAttribute('data-task-id');
      if (taskId) deleteTask(taskId);
    });
  });

  // اسکرول نرم به ساعت فعلی روز برای تجربه کاربری عالی
  const now = new Date();
  const curRow = document.getElementById('hour-row-' + now.getHours());
  if (curRow && !container.dataset.scrolled) {
    setTimeout(() => {
      curRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      container.dataset.scrolled = 'true';
    }, 150);
  }
}

/**
 * نمایش کارهای تاریخ انتخابی به صورت جدول زمانبندی
 */
function renderHistoryTasks() {
  const titleEl = document.getElementById('history-selected-date-text');
  const container = document.getElementById('history-schedule-table');
  if (!container || !titleEl) return;

  titleEl.textContent = `جدول زمانبندی: ${historySelectedDate}`;

  const history = StorageManager.getHistory();
  const todayStr = JalaliDate.formatJalali(JalaliDate.getTodayJalali());

  let tasks = [];
  const isTodaySelected = (historySelectedDate === todayStr);

  if (isTodaySelected) {
    tasks = StorageManager.getTasks();
  } else if (history[historySelectedDate]) {
    tasks = history[historySelectedDate];
  }

  container.innerHTML = buildScheduleTableHTML(tasks, isTodaySelected);

  if (isTodaySelected) {
    const chkBoxes = container.querySelectorAll('.chk-sched-task');
    chkBoxes.forEach(chk => {
      const taskId = chk.getAttribute('data-task-id');
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const state = getTaskState(task);
        if (state.canToggle) {
          chk.addEventListener('change', () => toggleTaskComplete(taskId));
        }
      }
    });

    const delBtns = container.querySelectorAll('.btn-sched-delete');
    delBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const taskId = btn.getAttribute('data-task-id');
        if (taskId) deleteTask(taskId);
      });
    });
  }
}

/**
 * تقویم شمسی ماهانه
 */
function changeMonth(delta) {
  currentCalMonth += delta;
  if (currentCalMonth > 12) {
    currentCalMonth = 1;
    currentCalYear++;
  } else if (currentCalMonth < 1) {
    currentCalMonth = 12;
    currentCalYear--;
  }
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('calendar-title');
  const gridEl = document.getElementById('calendar-days-grid');
  titleEl.textContent = `${JalaliDate.getMonthName(currentCalMonth)} ${currentCalYear}`;

  gridEl.innerHTML = '';

  const totalDays = JalaliDate.getDaysInMonth(currentCalYear, currentCalMonth);
  const startDayWeekday = JalaliDate.getFirstDayOfMonthWeekday(currentCalYear, currentCalMonth);
  const history = StorageManager.getHistory();
  const todayStr = JalaliDate.formatJalali(JalaliDate.getTodayJalali());

  // پر کردن خانه‌های خالی اول ماه
  for (let i = 0; i < startDayWeekday; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day empty';
    gridEl.appendChild(emptyCell);
  }

  // پر کردن روزهای ماه
  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement('div');
    const dayStr = `${currentCalYear}/${String(currentCalMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    
    cell.className = 'cal-day';
    if (dayStr === todayStr) cell.classList.add('today');
    if (dayStr === historySelectedDate) cell.classList.add('selected');

    // چک کردن داده‌ها در تاریخچه یا امروز
    let dayTasks = [];
    if (dayStr === todayStr) {
      dayTasks = StorageManager.getTasks();
    } else if (history[dayStr]) {
      dayTasks = history[dayStr];
    }

    let dotHtml = '';
    if (dayTasks.length > 0) {
      const doneCount = dayTasks.filter(t => t.completed).length;
      const missedCount = dayTasks.length - doneCount;
      dotHtml = `
        <div class="cal-dots">
          ${doneCount > 0 ? '<span class="dot-done"></span>' : ''}
          ${missedCount > 0 ? '<span class="dot-missed"></span>' : ''}
        </div>
      `;
    }

    cell.innerHTML = `
      <span class="day-num">${d}</span>
      ${dotHtml}
    `;

    cell.addEventListener('click', () => {
      historySelectedDate = dayStr;
      renderCalendar();
      renderHistoryTasks();
      updateFabVisibility();
    });

    gridEl.appendChild(cell);
  }
}

function renderApp() {
  renderTimeline();
  renderTaskList();
}
