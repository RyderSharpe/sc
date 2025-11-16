// ============================================================================
// 1. CONSTANTS
// ============================================================================
const SHIFT_STATES = ["", "D", "E", "N"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const WEEKDAY_NAMES = ["S","M","T","W","T","F","S"];

const STORAGE_KEY = "ryder_shift_schedule_v1";

// ============================================================================
// 2. SCHEDULE STORE + PERSISTENCE
// ============================================================================
let scheduleStore = {}; // dateKey -> { shift, holiday, vacation }

function loadSchedule() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      scheduleStore = parsed;
    }
  } catch (err) {
    console.error("Failed to load schedule from localStorage:", err);
  }
}

function saveSchedule() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduleStore));
  } catch (err) {
    console.error("Failed to save schedule to localStorage:", err);
  }
}

// ============================================================================
// 3. DOM REFERENCES
// ============================================================================
const calendarEl   = document.getElementById("calendar");
const yearInput    = document.getElementById("yearInput");
const applyYearBtn = document.getElementById("applyYearBtn");
const statusEl     = document.getElementById("status");
const printBtn     = document.getElementById("printBtn");
const sizeSelect   = document.getElementById("sizeSelect");
const exportBtn    = document.getElementById("exportBtn");
const importBtn    = document.getElementById("importBtn");
const importFile   = document.getElementById("importFile");

// ============================================================================
// 4. DATE HELPERS
// ============================================================================
function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

const today = new Date();
const TODAY_KEY = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

function dateKey(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function getDayState(key) {
  if (!scheduleStore[key]) {
    scheduleStore[key] = { shift: "", holiday: false, vacation: false };
    saveSchedule();
  }
  return scheduleStore[key];
}

// ============================================================================
// 5. BUILDING THE CALENDAR
// ============================================================================
function buildMonthTable(year, monthIndex) {
  const monthCard = document.createElement("div");
  monthCard.className = "month-card";

  const title = document.createElement("div");
  title.className = "month-title";
  title.textContent = MONTH_NAMES[monthIndex] + " " + year;
  monthCard.appendChild(title);

  const table = document.createElement("table");
  table.className = "month-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  WEEKDAY_NAMES.forEach(d => {
    const th = document.createElement("th");
    th.textContent = d;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  let currentDay = 1;

  for (let week = 0; week < 6; week++) {
    const tr = document.createElement("tr");

    for (let wd = 0; wd < 7; wd++) {
      const td = document.createElement("td");

      if ((week === 0 && wd < firstDayOfWeek) || currentDay > daysInMonth) {
        td.classList.add("empty");
        tr.appendChild(td);
        continue;
      }

      const key = dateKey(year, monthIndex, currentDay);
      td.dataset.dateKey = key;

      if (key === TODAY_KEY) {
        td.classList.add("today");
      }

      const dayNumberDiv = document.createElement("div");
      dayNumberDiv.className = "day-number";
      dayNumberDiv.textContent = currentDay;

      const shiftCodeDiv = document.createElement("div");
      shiftCodeDiv.className = "shift-code";

      td.appendChild(dayNumberDiv);
      td.appendChild(shiftCodeDiv);

      td.addEventListener("click", (e) => onDayCellClick(td, e));

      td.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (td.classList.contains("empty")) return;
        toggleHoliday(key);
        updateCellFromStore(td);
      });

      updateCellFromStore(td);

      tr.appendChild(td);
      currentDay++;
    }

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  monthCard.appendChild(table);
  return monthCard;
}

function renderCalendar(year) {
  calendarEl.innerHTML = "";
  for (let m = 0; m < 12; m++) {
    const monthCard = buildMonthTable(year, m);
    calendarEl.appendChild(monthCard);
  }
}

// ============================================================================
// 6. STATE UPDATES (SHIFT / HOLIDAY / VACATION)
// ============================================================================
function updateCellFromStore(td) {
  const key = td.dataset.dateKey;
  const state = getDayState(key);
  const shiftDiv = td.querySelector(".shift-code");
  const dayNumberDiv = td.querySelector(".day-number");

  td.classList.remove("shift-day", "shift-eve", "shift-night", "holiday-on");
  dayNumberDiv.classList.remove("vacation-on");

  shiftDiv.textContent = state.shift || "";

  if (state.shift === "D") {
    td.classList.add("shift-day");
  } else if (state.shift === "E") {
    td.classList.add("shift-eve");
  } else if (state.shift === "N") {
    td.classList.add("shift-night");
  }

  if (state.holiday) {
    td.classList.add("holiday-on");
  }

  if (state.vacation) {
    dayNumberDiv.classList.add("vacation-on");
  }
}

function onDayCellClick(td, event) {
  if (td.classList.contains("empty")) return;
  const key = td.dataset.dateKey;
  const state = getDayState(key);

  // Alt+click = toggle vacation
  if (event.altKey) {
    state.vacation = !state.vacation;
    saveSchedule();
    updateCellFromStore(td);
    statusEl.textContent = `${key} vacation: ${state.vacation ? "ON" : "OFF"}.`;
    return;
  }

  // normal click = cycle shift
  const currentShift = state.shift || "";
  let idx = SHIFT_STATES.indexOf(currentShift);
  if (idx === -1) idx = 0;
  idx = (idx + 1) % SHIFT_STATES.length;
  const newShift = SHIFT_STATES[idx];
  state.shift = newShift;
  saveSchedule();

  updateCellFromStore(td);
  statusEl.textContent = `${key} shift set to ${newShift || "empty"}.`;
}

function toggleHoliday(key) {
  const state = getDayState(key);
  state.holiday = !state.holiday;
  saveSchedule();
  statusEl.textContent = `${key} holiday: ${state.holiday ? "ON" : "OFF"}.`;
}

// ============================================================================
// 7. CONTROLS (YEAR, SIZE, PRINT)
// ============================================================================
let currentYear = new Date().getFullYear();

applyYearBtn.addEventListener("click", () => {
  const y = parseInt(yearInput.value, 10);
  if (Number.isNaN(y) || y < 1900 || y > 2100) {
    statusEl.textContent = "Enter a valid year between 1900 and 2100.";
    return;
  }
  currentYear = y;
  renderCalendar(currentYear);
  statusEl.textContent = "Showing year " + currentYear + ".";
});

sizeSelect.addEventListener("change", () => {
  document.body.classList.remove("size-small", "size-medium", "size-large");
  document.body.classList.add("size-" + sizeSelect.value);
});

printBtn.addEventListener("click", () => {
  window.print();
});

// ============================================================================
// 8. EXPORT / IMPORT (BACKUP)
// ============================================================================
exportBtn.addEventListener("click", () => {
  try {
    const dataStr = JSON.stringify(scheduleStore, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    const now = new Date();
    const fname = `ryder-shift-schedule-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
    a.download = fname;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusEl.textContent = "Schedule exported as JSON.";
  } catch (err) {
    console.error("Export failed:", err);
    statusEl.textContent = "Error: export failed.";
  }
});

importBtn.addEventListener("click", () => {
  importFile.value = "";
  importFile.click();
});

importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object") {
        statusEl.textContent = "Error: invalid schedule file.";
        return;
      }

      scheduleStore = parsed;
      saveSchedule();
      renderCalendar(currentYear);
      statusEl.textContent = "Schedule imported successfully.";
    } catch (err) {
      console.error("Import failed:", err);
      statusEl.textContent = "Error: import failed.";
    }
  };
  reader.readAsText(file);
});

// ============================================================================
// 9. INITIALIZATION
// ============================================================================
loadSchedule();
document.body.classList.add("size-medium");
yearInput.value = currentYear;
renderCalendar(currentYear);
