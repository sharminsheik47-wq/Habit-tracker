// --- Storage helpers ---

const STORAGE_KEY = "pastelButterflyHabitData_v3";
const ARCHIVE_KEY = "pastelButterflyArchive_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const today = new Date();
    return {
      startDate: today.toISOString(),
      totalDaysTracked: 0,
      currentStreak: 0,
      streakHistory: [],
      dayLogs: {},
      badges: [],
      rewards: [],
      lastInteractionDate: null,
      yearlyCycles: []
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    const today = new Date();
    return {
      startDate: today.toISOString(),
      totalDaysTracked: 0,
      currentStreak: 0,
      streakHistory: [],
      dayLogs: {},
      badges: [],
      rewards: [],
      lastInteractionDate: null,
      yearlyCycles: []
    };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadArchive() {
  const raw = localStorage.getItem(ARCHIVE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveArchive() {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
}

// --- Global state ---

let state = loadData();
let archive = loadArchive();

let currentMonth = new Date();
let selectedDate = new Date();
let touchStartX = null;

// DOM references
const app = document.getElementById("app");
const calendarGrid = document.getElementById("calendarGrid");
const monthYearLabel = document.getElementById("monthYearLabel");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const habitsList = document.getElementById("habitsList");
const daySummaryText = document.getElementById("daySummaryText");

const currentStreakText = document.getElementById("currentStreakText");
const totalDaysTrackedText = document.getElementById("totalDaysTrackedText");
const startDateText = document.getElementById("startDateText");

const butterflyStageText = document.getElementById("butterflyStageText");
const butterflyImage = document.getElementById("butterflyImage");
const streakProgressFill = document.getElementById("streakProgressFill");
const streakHintText = document.getElementById("streakHintText");
const badgeList = document.getElementById("badgeList");

const overlay = document.getElementById("overlay");

// Popups
const warningPopup = document.getElementById("warningPopup");
const resetPopup = document.getElementById("resetPopup");
const badgePopup = document.getElementById("badgePopup");
const rewardPopup = document.getElementById("rewardPopup");
const yearIntroPopup = document.getElementById("yearIntroPopup");
const yearSummaryPopup = document.getElementById("yearSummaryPopup");
const archivePopup = document.getElementById("archivePopup");

const yearStreakSummaryText = document.getElementById("yearStreakSummaryText");
const yearButterflySummaryText = document.getElementById("yearButterflySummaryText");
const yearStruggleSummaryText = document.getElementById("yearStruggleSummaryText");
const yearStrengthSummaryText = document.getElementById("yearStrengthSummaryText");

const swipeContainer = document.getElementById("swipeContainer");

// --- Utility functions ---

function formatDateHuman(d) {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function dateToISO(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split("T")[0];
}

function isoToDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDayLog(iso, create = false) {
  if (!state.dayLogs[iso] && create) {
    state.dayLogs[iso] = {
      habits: [],
      missedCount: 0,
      streakValue: 0,
      butterflyStage: "Egg",
      locked: false
    };
  }
  return state.dayLogs[iso] || null;
}

function computeMissedBetween(lastDateISO, currentDateISO) {
  if (!lastDateISO) return 0;
  const last = isoToDate(lastDateISO);
  const current = isoToDate(currentDateISO);
  last.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  const diffMs = current - last;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays - 1);
}

function daysBetween(startISO, endISO) {
  const a = isoToDate(startISO);
  const b = isoToDate(endISO);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function daysBetweenInclusive(startISO, endISO) {
  return daysBetween(startISO, endISO) + 1;
}

function hasCompletedYear() {
  if (!state.startDate) return false;
  const startISO = state.startDate.split("T")[0];
  const todayISO = dateToISO(new Date());
  const diffDays = daysBetweenInclusive(startISO, todayISO);
  return diffDays >= 365;
}

// --- Splash Screen to App transition ---

window.addEventListener("load", () => {
  setTimeout(() => {
    const splash = document.getElementById("splash-screen");
    splash.style.display = "none";
    app.classList.remove("hidden");
    app.style.opacity = "1";
  }, 2600);
});

// --- Calendar rendering (past / today / future visible) ---

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startIndex = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const monthName = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
  monthYearLabel.textContent = monthName;

  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  dayNames.forEach((dn) => {
    const nameEl = document.createElement("div");
    nameEl.className = "calendar-day-name";
    nameEl.textContent = dn;
    calendarGrid.appendChild(nameEl);
  });

  const cellsCount = 42;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < cellsCount; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    if (i < startIndex || i >= startIndex + totalDays) {
      cell.classList.add("disabled");
      calendarGrid.appendChild(cell);
      continue;
    }

    const dayNum = i - startIndex + 1;
    const thisDate = new Date(year, month, dayNum);
    thisDate.setHours(0, 0, 0, 0);
    const iso = dateToISO(thisDate);
    const log = getDayLog(iso, false);

    const inner = document.createElement("div");
    inner.className = "calendar-cell-inner";

    const header = document.createElement("div");
    header.className = "calendar-cell-header";

    const daySpan = document.createElement("div");
    daySpan.className = "calendar-cell-day";
    daySpan.textContent = dayNum;

    const marks = document.createElement("div");
    marks.className = "calendar-cell-marks";

    const isPast = thisDate < today;
    const isToday =
      thisDate.getFullYear() === today.getFullYear() &&
      thisDate.getMonth() === today.getMonth() &&
      thisDate.getDate() === today.getDate();
    const isFuture = thisDate > today;

    if (log) {
      if (log.streakValue > 0) {
        const m = document.createElement("div");
        m.className = "calendar-cell-mark streak-day";
        marks.appendChild(m);
        cell.classList.add("streak");
      }
      if (log.missedCount > 0) {
        const m = document.createElement("div");
        m.className = "calendar-cell-mark missed-day";
        marks.appendChild(m);
        cell.classList.add("missed");
      }
      const badgeOnThisDay = state.badges.some((b) => b.dateISO === iso);
      if (badgeOnThisDay) {
        const m = document.createElement("div");
        m.className = "calendar-cell-mark badge-day";
        marks.appendChild(m);
        cell.classList.add("badge");
      }
    }

    header.appendChild(daySpan);
    header.appendChild(marks);

    const footer = document.createElement("div");
    footer.className = "calendar-cell-footer";
    if (log && log.habits.length > 0) {
      const completedCount = log.habits.filter((h) => h.completed).length;
      footer.textContent = `${completedCount}/${log.habits.length} habits`;
    }

    inner.appendChild(header);
    inner.appendChild(footer);
    cell.appendChild(inner);

    if (isPast) {
      cell.classList.add("calendar-past");
    }
    if (isFuture) {
      cell.classList.add("calendar-future");
    }
    if (isToday) {
      cell.classList.add("calendar-today");
    }

    if (dateToISO(selectedDate) === iso) {
      cell.classList.add("selected");
    }

    cell.addEventListener("click", () => {
      selectedDate = thisDate;
      renderCalendar();
      renderHabitsForSelectedDate();
    });

    calendarGrid.appendChild(cell);
  }
}

// --- Habits UI (past & future read-only, today editable) ---

function renderHabitsForSelectedDate() {
  const iso = dateToISO(selectedDate);
  const log = getDayLog(iso, true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );
  selected.setHours(0, 0, 0, 0);

  const isPast = selected < today;
  const isToday =
    selected.getFullYear() === today.getFullYear() &&
    selected.getMonth() === today.getMonth() &&
    selected.getDate() === today.getDate();
  const isFuture = selected > today;

  selectedDateLabel.textContent = formatDateHuman(selectedDate);
  habitsList.innerHTML = "";

  const saveBtn = document.getElementById("saveDayBtn");
  const addInput = document.getElementById("newHabitInput");
  const addBtn = document.getElementById("addHabitBtn");

  if (isPast) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Past day (view only)";
    addInput.disabled = true;
    addBtn.disabled = true;
  } else if (isToday) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Day & Update Streak";
    addInput.disabled = false;
    addBtn.disabled = false;
  } else if (isFuture) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Future day (locked)";
    addInput.disabled = true;
    addBtn.disabled = true;
  }

  log.habits.forEach((habit) => {
    const item = document.createElement("div");
    item.className = "habit-item";

    const main = document.createElement("div");
    main.className = "habit-item-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = habit.completed;
    checkbox.disabled = !isToday;

    checkbox.addEventListener("change", () => {
      if (!isToday) return;
      habit.completed = checkbox.checked;
      saveData();
      updateDaySummaryLabel(log);
    });

    const label = document.createElement("label");
    label.textContent = habit.name;

    main.appendChild(checkbox);
    main.appendChild(label);

    const removeBtn = document.createElement("button");
    removeBtn.className = "habit-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = isToday
      ? "Remove habit only for this day"
      : "Cannot edit this day";
    removeBtn.disabled = !isToday;

    removeBtn.addEventListener("click", () => {
      if (!isToday) return;
      const dLog = getDayLog(iso, true);
      dLog.habits = dLog.habits.filter((h) => h.name !== habit.name);
      saveData();
      renderHabitsForSelectedDate();
      renderCalendar();
    });

    if (isPast || isFuture) {
      item.classList.add("habit-readonly");
    }

    item.appendChild(main);
    item.appendChild(removeBtn);
    habitsList.appendChild(item);
  });

  updateDaySummaryLabel(log);
}

function updateDaySummaryLabel(log) {
  if (!log || !log.habits.length) {
    daySummaryText.textContent = "";
    return;
  }
  const completedCount = log.habits.filter((h) => h.completed).length;
  const total = log.habits.length;
  daySummaryText.textContent = `${completedCount}/${total} habits completed.`;
}

// --- Streak and day save logic ---

function getStageForStreak(streak) {
  if (streak >= 40) return "Butterfly";
  if (streak >= 25) return "Cocoon";
  if (streak >= 15) return "Chrysalis";
  if (streak >= 7) return "Caterpillar";
  return "Egg";
}

function saveCurrentDay() {
  const iso = dateToISO(selectedDate);
  const todayRealISO = dateToISO(new Date());
  if (iso > todayRealISO) {
    alert("You can’t log future days.");
    return;
  }

  const todayLog = getDayLog(iso, true);
  const totalHabits = todayLog.habits.length;
  const completedCount = todayLog.habits.filter((h) => h.completed).length;
  const allComplete = totalHabits > 0 && completedCount === totalHabits;

  const missedBetween = computeMissedBetween(state.lastInteractionDate, iso);

  if (allComplete) {
    if (!state.lastInteractionDate || missedBetween === 0) {
      state.currentStreak += 1;
    } else if (missedBetween === 1) {
      state.currentStreak += 1;
    } else {
      state.currentStreak = 1;
    }
  }

  todayLog.streakValue = state.currentStreak;
  todayLog.missedCount = totalHabits === 0 ? 0 : totalHabits - completedCount;
  todayLog.butterflyStage = getStageForStreak(state.currentStreak);

  const alreadyTracked = state.streakHistory.some((e) => e.dateISO === iso);
  if (!alreadyTracked) {
    state.streakHistory.push({ dateISO: iso, streakValue: state.currentStreak });
  }

  state.lastInteractionDate = iso;

  // lifetime days tracked from start date
  const startISO = state.startDate.split("T")[0];
  const todayISO = dateToISO(new Date());
  state.totalDaysTracked = daysBetweenInclusive(startISO, todayISO);

  checkButterflyBadges(iso);
  checkYearlySummaryTrigger();

  saveData();
  renderStats();
  renderCalendar();
  renderButterfly();
  renderBadges();
  renderHabitsForSelectedDate();
}

// On app load, detect missed days and auto‑reset after 2 days

function checkDailyMissedOnLoad() {
  const todayISO = dateToISO(new Date());
  const lastISO = state.lastInteractionDate;

  if (!lastISO) {
    state.lastInteractionDate = todayISO;
    const startISO = state.startDate.split("T")[0];
    state.totalDaysTracked = daysBetweenInclusive(startISO, todayISO);
    saveData();
    return;
  }

  const diffDays = computeMissedBetween(lastISO, todayISO);

  if (diffDays === 1) {
    showPopup(warningPopup);
  } else if (diffDays >= 2) {
    state.currentStreak = 0;
    saveData();
    renderStats();
    renderButterfly();
    showPopup(resetPopup);
  }

  state.lastInteractionDate = todayISO;

  const startISO = state.startDate.split("T")[0];
  state.totalDaysTracked = daysBetweenInclusive(startISO, todayISO);

  saveData();
}

// --- Butterfly visual and progress ---

function renderStats() {
  currentStreakText.textContent = `${state.currentStreak} day${state.currentStreak === 1 ? "" : "s"}`;
  totalDaysTrackedText.textContent = state.totalDaysTracked.toString();
  const start = new Date(state.startDate);
  startDateText.textContent = formatDateHuman(start);

  const yearLockState = document.getElementById("yearLockState");
  const archiveLockIcon = document.getElementById("archiveLockIcon");

  if (hasCompletedYear()) {
    if (yearLockState) {
      yearLockState.querySelector(".lock-icon").textContent = "🔓";
      yearLockState.querySelector(".soft-label").textContent =
        "Your 365-day reflection is ready.";
    }
    if (archiveLockIcon) {
      archiveLockIcon.textContent = "🔓";
    }
  } else {
    if (yearLockState) {
      yearLockState.querySelector(".lock-icon").textContent = "🔒";
      yearLockState.querySelector(".soft-label").textContent =
        "Unlocks after 365 days from your first tracked day.";
    }
    if (archiveLockIcon) {
      archiveLockIcon.textContent = "🔒";
    }
  }
}

function renderButterfly() {
  const streak = state.currentStreak;
  const stage = getStageForStreak(streak);
  butterflyStageText.textContent = stage;

  let img = "assets/butterfly-egg.png";
  let scale = 0.9;
  let progress = 0;

  if (stage === "Egg") {
    img = "assets/butterfly-egg.png";
    scale = 0.85 + Math.min(streak, 6) * 0.02;
    progress = Math.min((streak / 7) * 20, 20);
  } else if (stage === "Caterpillar") {
    img = "assets/butterfly-caterpillar.png";
    const relative = Math.min(streak - 7, 8);
    scale = 1.0 + relative * 0.03;
    progress = 20 + Math.min((relative / 8) * 20, 20);
  } else if (stage === "Chrysalis") {
    img = "assets/butterfly-chrysalis.png";
    const relative = Math.min(streak - 15, 9);
    scale = 1.1 + relative * 0.03;
    progress = 40 + Math.min((relative / 9) * 20, 20);
  } else if (stage === "Cocoon") {
    img = "assets/butterfly-cocoon.png";
    const relative = Math.min(streak - 25, 14);
    scale = 1.2 + relative * 0.03;
    progress = 60 + Math.min((relative / 14) * 20, 20);
  } else if (stage === "Butterfly") {
    img = "assets/butterfly-adult.png";
    const relative = Math.min(streak - 40, 40);
    scale = 1.4 + relative * 0.01;
    progress = 80 + Math.min((relative / 40) * 20, 20);
  }

  butterflyImage.src = img;
  butterflyImage.style.transform = `scale(${scale})`;
  streakProgressFill.style.width = `${Math.min(progress, 100)}%`;

  if (streak === 0) {
    streakHintText.textContent = "Each fully completed day grows your butterfly.";
  } else {
    streakHintText.textContent = `Keep going—${30 - (streak % 30 || 30)} days until your next butterfly badge.`;
  }
}

// --- Badges and rewards ---

function checkButterflyBadges(todayISO) {
  const streak = state.currentStreak;
  if (streak > 0 && streak % 30 === 0) {
    const badgeId = `badge-${todayISO}`;
    if (!state.badges.some((b) => b.id === badgeId)) {
      const variantIndex = Math.floor(streak / 30) - 1;
      state.badges.push({
        id: badgeId,
        dateISO: todayISO,
        variantIndex
      });
      showPopup(badgePopup);
    }
  }

  if (state.badges.length > 0 && state.badges.length % 6 === 0) {
    const rewardId = `reward-${todayISO}`;
    if (!state.rewards.some((r) => r.id === rewardId)) {
      state.rewards.push({
        id: rewardId,
        dateISO: todayISO
      });
      showPopup(rewardPopup);
    }
  }
}

function renderBadges() {
  badgeList.innerHTML = "";
  if (state.badges.length === 0) {
    const empty = document.createElement("div");
    empty.className = "soft-label";
    empty.textContent = "Your future butterflies will rest here.";
    badgeList.appendChild(empty);
    return;
  }

  state.badges.forEach((badge, index) => {
    const pill = document.createElement("div");
    pill.className = "badge-pill";

    const img = document.createElement("img");
    img.src = "assets/butterfly-badge.png";
    img.alt = "Butterfly Badge";

    const text = document.createElement("div");
    text.innerHTML = `<strong>Badge ${index + 1}</strong><br><span>${formatDateHuman(
      isoToDate(badge.dateISO)
    )}</span>`;

    pill.appendChild(img);
    pill.appendChild(text);
    badgeList.appendChild(pill);
  });
}

// --- Popup helpers ---

function showPopup(popupEl) {
  overlay.classList.remove("hidden");
  popupEl.classList.remove("hidden");
}

function hidePopup(popupEl) {
  popupEl.classList.add("hidden");
  if (
    warningPopup.classList.contains("hidden") &&
    resetPopup.classList.contains("hidden") &&
    badgePopup.classList.contains("hidden") &&
    rewardPopup.classList.contains("hidden") &&
    yearIntroPopup.classList.contains("hidden") &&
    yearSummaryPopup.classList.contains("hidden") &&
    archivePopup.classList.contains("hidden")
  ) {
    overlay.classList.add("hidden");
  }
}

document.querySelectorAll(".popup-close").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const targetId = e.currentTarget.getAttribute("data-popup-close");
    if (targetId) {
      const popupEl = document.getElementById(targetId);
      hidePopup(popupEl);
    }
  });
});

// --- Yearly summary logic ---

function checkYearlySummaryTrigger() {
  const todayISO = state.lastInteractionDate;
  if (!todayISO || !state.startDate) return;
  const diff = daysBetween(state.startDate.split("T")[0], todayISO);
  if (diff >= 365) {
    const alreadyClosed = state.yearlyCycles.some((cycle) => cycle.endISO === todayISO);
    if (!alreadyClosed) {
      showPopup(yearIntroPopup);
    }
  }
}

function buildYearSummaryStats() {
  const startISO = state.startDate.split("T")[0];
  const endISO = state.lastInteractionDate || startISO;

  const logs = Object.entries(state.dayLogs).filter(
    ([iso]) => iso >= startISO && iso <= endISO
  );

  const summary = {
    totalDays: daysBetweenInclusive(startISO, endISO),
    daysWithStreak: 0,
    longestStreak: 0,
    totalBadges: state.badges.length,
    totalRewards: state.rewards.length,
    habitCounts: {},
    habitCompletedCounts: {}
  };

  let currentRun = 0;
  const streakSorted = [...state.streakHistory].sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO)
  );
  streakSorted.forEach((entry, index) => {
    if (entry.streakValue > 0) {
      summary.daysWithStreak += 1;
      if (index === 0 || entry.streakValue === streakSorted[index - 1].streakValue + 1) {
        currentRun += 1;
      } else {
        currentRun = 1;
      }
      summary.longestStreak = Math.max(summary.longestStreak, currentRun);
    }
  });

  logs.forEach(([, log]) => {
    log.habits.forEach((h) => {
      summary.habitCounts[h.name] = (summary.habitCounts[h.name] || 0) + 1;
      if (h.completed) {
        summary.habitCompletedCounts[h.name] =
          (summary.habitCompletedCounts[h.name] || 0) + 1;
      }
    });
  });

  let weakestHabit = null;
  let weakestRatio = Infinity;
  let strongestHabit = null;
  let strongestRatio = -1;

  Object.keys(summary.habitCounts).forEach((name) => {
    const total = summary.habitCounts[name];
    const completed = summary.habitCompletedCounts[name] || 0;
    const ratio = total === 0 ? 0 : completed / total;
    if (total > 3 && ratio < weakestRatio) {
      weakestRatio = ratio;
      weakestHabit = name;
    }
    if (total > 3 && ratio > strongestRatio) {
      strongestRatio = ratio;
      strongestHabit = name;
    }
  });

  const daysWithStreakPct =
    summary.totalDays > 0
      ? Math.round((summary.daysWithStreak / summary.totalDays) * 100)
      : 0;

  yearStreakSummaryText.textContent = `You kept a streak on about ${daysWithStreakPct}% of your days and your longest gentle run was ${summary.longestStreak} days.`;
  yearButterflySummaryText.textContent = `You welcomed ${summary.totalBadges} butterfly badges and celebrated ${summary.totalRewards} garden rewards.`;

  if (weakestHabit) {
    const pct = Math.round(weakestRatio * 100);
    yearStruggleSummaryText.textContent = `You seemed to struggle most with “${weakestHabit}”, completing it about ${pct}% of the times you planned it.`;
  } else {
    yearStruggleSummaryText.textContent =
      "Your habits stayed quite balanced; no single activity clearly stood out as a struggle.";
  }

  if (strongestHabit) {
    const pct = Math.round(strongestRatio * 100);
    yearStrengthSummaryText.textContent = `Your most anchored habit was “${strongestHabit}”, which you completed about ${pct}% of the time.`;
  } else {
    yearStrengthSummaryText.textContent =
      "You experimented gently; no single habit dominated your daily pattern yet.";
  }

  return { startISO, endISO, summary };
}

function openYearSummary() {
  hidePopup(yearIntroPopup);
  showPopup(yearSummaryPopup);
  setActiveSummaryCard(0);
}

function finalizeYearArchive() {
  const todayISO = state.lastInteractionDate || dateToISO(new Date());
  const startISO = state.startDate.split("T")[0];
  const diffDays = daysBetweenInclusive(startISO, todayISO);

  if (diffDays < 365) {
    hidePopup(yearSummaryPopup);
    return;
  }

  const { startISO: sISO, endISO: eISO, summary } = buildYearSummaryStats();
  archive.push({
    startISO: sISO,
    endISO: eISO,
    snapshot: summary
  });
  saveArchive();

  state.yearlyCycles.push({
    startISO: sISO,
    endISO: eISO
  });

  const nextStartISO = todayISO;
  state.startDate = nextStartISO + "T00:00:00.000Z";
  state.streakHistory = [];
  state.dayLogs = {};
  state.badges = [];
  state.rewards = [];
  state.currentStreak = 0;
  state.totalDaysTracked = 0;

  saveData();
  hidePopup(yearSummaryPopup);
  renderAll();
}

// --- Swipeable cards (year summary) ---

const summaryCards = Array.from(
  document.querySelectorAll("#swipeContainer .summary-card")
);

let summaryIndex = 0;

function setActiveSummaryCard(index) {
  summaryIndex = (index + summaryCards.length) % summaryCards.length;
  summaryCards.forEach((card, i) => {
    card.classList.remove("active", "left");
    if (i === summaryIndex) {
      card.classList.add("active");
    } else if (i === (summaryIndex - 1 + summaryCards.length) % summaryCards.length) {
      card.classList.add("left");
    }
  });
}

function nextSummaryCard() {
  setActiveSummaryCard(summaryIndex + 1);
}

function prevSummaryCard() {
  setActiveSummaryCard(summaryIndex - 1);
}

document.getElementById("swipeNextBtn").addEventListener("click", nextSummaryCard);
document.getElementById("swipePrevBtn").addEventListener("click", prevSummaryCard);

swipeContainer.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].clientX;
});

swipeContainer.addEventListener("touchend", (e) => {
  if (touchStartX == null) return;
  const endX = e.changedTouches[0].clientX;
  const diffX = endX - touchStartX;
  const threshold = 40;
  if (diffX > threshold) {
    prevSummaryCard();
  } else if (diffX < -threshold) {
    nextSummaryCard();
  }
  touchStartX = null;
});

// --- Archive rendering ---

function renderArchive() {
  const container = document.getElementById("archiveList");
  container.innerHTML = "";
  if (archive.length === 0) {
    const empty = document.createElement("div");
    empty.className = "soft-label";
    empty.textContent = "Your past yearly reflections will rest here.";
    container.appendChild(empty);
    return;
  }

  archive.forEach((entry, index) => {
    const div = document.createElement("div");
    div.className = "archive-entry";
    const start = formatDateHuman(isoToDate(entry.startISO));
    const end = formatDateHuman(isoToDate(entry.endISO));
    const summary = entry.snapshot;
    div.innerHTML = `<strong>Year ${index + 1}</strong> • ${start} → ${end}<br/>
      Longest streak: ${summary.longestStreak} days • Badges: ${summary.totalBadges} • Rewards: ${summary.totalRewards}`;
    container.appendChild(div);
  });
}

// --- Event listeners ---

document.getElementById("prevMonthBtn").addEventListener("click", () => {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});

document.getElementById("nextMonthBtn").addEventListener("click", () => {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

document.getElementById("addHabitBtn").addEventListener("click", () => {
  const input = document.getElementById("newHabitInput");
  const name = input.value.trim();
  if (!name) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );
  selected.setHours(0, 0, 0, 0);

  const isToday =
    selected.getFullYear() === today.getFullYear() &&
    selected.getMonth() === today.getMonth() &&
    selected.getDate() === today.getDate();

  if (!isToday) {
    alert("You can only add habits for today.");
    input.value = "";
    return;
  }

  const iso = dateToISO(selectedDate);
  const log = getDayLog(iso, true);
  if (!log.habits.some((h) => h.name === name)) {
    log.habits.push({ name, completed: false });
  }
  input.value = "";
  saveData();
  renderHabitsForSelectedDate();
});

document.getElementById("saveDayBtn").addEventListener("click", () => {
  saveCurrentDay();
});

document.getElementById("yearIntroContinueBtn").addEventListener("click", () => {
  buildYearSummaryStats();
  openYearSummary();
});

document.getElementById("yearSummaryDoneBtn").addEventListener("click", () => {
  finalizeYearArchive();
});

document.getElementById("openArchiveBtn").addEventListener("click", () => {
  if (!hasCompletedYear()) {
    alert("Past Year Archive will unlock after 365 days.");
    return;
  }
  renderArchive();
  showPopup(archivePopup);
});

// --- Initial render ---

function renderAll() {
  renderStats();
  renderCalendar();
  renderHabitsForSelectedDate();
  renderButterfly();
  renderBadges();
}

renderAll();
checkDailyMissedOnLoad();
