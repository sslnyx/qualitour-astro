import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type ServiceCalendarProps = {
  lang: "en" | "zh";
  value: string;
  min: string;
  max: string;
  isDateEnabled: (date: string) => boolean;
  onChange: (date: string) => void;
};

type CalendarKey =
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "ArrowDown"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown";

const calendarKeys = new Set<CalendarKey>([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const pad = (value: number) => String(value).padStart(2, "0");

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO month: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function formatMonth(year: number, month: number) {
  return `${year}-${pad(month + 1)}`;
}

function toUtcDate(value: string) {
  const { year, month, day } = parseDate(value);
  return new Date(Date.UTC(year, month, day));
}

function addDays(value: string, amount: number) {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function shiftDateMonth(value: string, amount: number) {
  const { year, month, day } = parseDate(value);
  const monthIndex = year * 12 + month + amount;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = ((monthIndex % 12) + 12) % 12;
  return formatDate(
    nextYear,
    nextMonth,
    Math.min(day, getDaysInMonth(nextYear, nextMonth)),
  );
}

function shiftMonth(value: string, amount: number) {
  return shiftDateMonth(`${value}-01`, amount).slice(0, 7);
}

function clampMonth(value: string, min: string, max: string) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function getMonthGrid(monthValue: string) {
  const { year, month } = parseMonth(monthValue);
  const firstDate = formatDate(year, month, 1);
  const firstWeekday = toUtcDate(firstDate).getUTCDay();
  const gridStart = addDays(firstDate, -firstWeekday);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getKeyboardDate(value: string, key: string, shiftKey = false) {
  const weekday = toUtcDate(value).getUTCDay();
  switch (key) {
    case "ArrowLeft":
      return addDays(value, -1);
    case "ArrowRight":
      return addDays(value, 1);
    case "ArrowUp":
      return addDays(value, -7);
    case "ArrowDown":
      return addDays(value, 7);
    case "Home":
      return addDays(value, -weekday);
    case "End":
      return addDays(value, 6 - weekday);
    case "PageUp":
      return shiftDateMonth(value, shiftKey ? -12 : -1);
    case "PageDown":
      return shiftDateMonth(value, shiftKey ? 12 : 1);
    default:
      return value;
  }
}

export function getEnabledKeyboardDate({
  date,
  key,
  shiftKey = false,
  min,
  max,
  isDateEnabled,
}: {
  date: string;
  key: string;
  shiftKey?: boolean;
  min: string;
  max: string;
  isDateEnabled: (date: string) => boolean;
}) {
  const isSelectable = (candidate: string) =>
    candidate >= min && candidate <= max && isDateEnabled(candidate);
  const candidate = getKeyboardDate(date, key, shiftKey);

  if (key === "Home" || key === "End") {
    const direction = key === "Home" ? 1 : -1;
    for (let offset = 0; offset < 7; offset += 1) {
      const rowDate = addDays(candidate, direction * offset);
      if (isSelectable(rowDate)) return rowDate;
    }
    return date;
  }

  const direction =
    key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp" ? -1 : 1;
  let next = candidate < min ? min : candidate > max ? max : candidate;
  while (next >= min && next <= max) {
    if (isSelectable(next)) return next;
    const following = addDays(next, direction);
    if (following < min || following > max) break;
    next = following;
  }
  return date;
}

export function getMonthOptions(min: string, max: string) {
  const start = parseDate(min);
  const end = parseDate(max);
  const firstIndex = start.year * 12 + start.month;
  const lastIndex = end.year * 12 + end.month;
  if (lastIndex < firstIndex) return [];
  return Array.from({ length: lastIndex - firstIndex + 1 }, (_, offset) => {
    const index = firstIndex + offset;
    return formatMonth(Math.floor(index / 12), index % 12);
  });
}

export function getCalendarViewState({
  visibleMonth,
  focusedDate,
  min,
  max,
  isDateEnabled,
}: {
  visibleMonth: string;
  focusedDate: string;
  min: string;
  max: string;
  isDateEnabled: (date: string) => boolean;
}) {
  const nextMonth = clampMonth(visibleMonth, min.slice(0, 7), max.slice(0, 7));
  const isSelectable = (date: string) =>
    date.startsWith(`${nextMonth}-`) &&
    date >= min &&
    date <= max &&
    isDateEnabled(date);
  const nextFocusedDate = isSelectable(focusedDate)
    ? focusedDate
    : getMonthGrid(nextMonth).find(isSelectable);
  return { visibleMonth: nextMonth, focusedDate: nextFocusedDate };
}

function formatFullDate(value: string, lang: "en" | "zh") {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-Hant-CA" : "en-CA", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(toUtcDate(value));
}

function formatMonthLabel(value: string, lang: "en" | "zh") {
  const { year, month } = parseMonth(value);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-Hant-CA" : "en-CA", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month, 1)));
}

export function ServiceCalendar({
  lang,
  value,
  min,
  max,
  isDateEnabled,
  onChange,
}: ServiceCalendarProps) {
  const minMonth = min.slice(0, 7);
  const maxMonth = max.slice(0, 7);
  const initialMonth = clampMonth(
    (value || min).slice(0, 7),
    minMonth,
    maxMonth,
  );
  const initialView = getCalendarViewState({
    visibleMonth: initialMonth,
    focusedDate: value,
    min,
    max,
    isDateEnabled,
  });
  const [visibleMonth, setVisibleMonth] = useState(initialView.visibleMonth);
  const [focusedDate, setFocusedDate] = useState(
    initialView.focusedDate || min,
  );
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocusDay = useRef(false);
  const groupLabelId = useId();
  const monthSelectId = useId();
  const monthOptions = useMemo(() => getMonthOptions(min, max), [min, max]);
  const calendarView = getCalendarViewState({
    visibleMonth,
    focusedDate,
    min,
    max,
    isDateEnabled,
  });
  const displayMonth = calendarView.visibleMonth;
  const tabStop = calendarView.focusedDate;
  const days = useMemo(() => getMonthGrid(displayMonth), [displayMonth]);
  const weekdays =
    lang === "zh"
      ? ["日", "一", "二", "三", "四", "五", "六"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isSelectable = (date: string) =>
    date >= min && date <= max && isDateEnabled(date);

  const firstEnabledDate = (month: string) =>
    getMonthGrid(month).find(
      (date) => date.startsWith(`${month}-`) && isSelectable(date),
    );

  useEffect(() => {
    const requestedMonth =
      value && value >= min && value <= max ? value.slice(0, 7) : visibleMonth;
    const next = getCalendarViewState({
      visibleMonth: requestedMonth,
      focusedDate: value || focusedDate,
      min,
      max,
      isDateEnabled,
    });
    setVisibleMonth(next.visibleMonth);
    if (next.focusedDate) setFocusedDate(next.focusedDate);
  }, [max, maxMonth, min, minMonth, value]);

  useEffect(() => {
    if (!shouldFocusDay.current) return;
    shouldFocusDay.current = false;
    dayRefs.current.get(focusedDate)?.focus();
  }, [focusedDate, visibleMonth]);

  const changeMonth = (month: string) => {
    const nextMonth = clampMonth(month, minMonth, maxMonth);
    setVisibleMonth(nextMonth);
    const nextFocused = firstEnabledDate(nextMonth);
    if (nextFocused) setFocusedDate(nextFocused);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    date: string,
  ) => {
    if (!calendarKeys.has(event.key as CalendarKey)) return;
    event.preventDefault();
    const nextDate = getEnabledKeyboardDate({
      date,
      key: event.key,
      shiftKey: event.shiftKey,
      min,
      max,
      isDateEnabled,
    });
    if (nextDate === date) return;
    shouldFocusDay.current = true;
    setVisibleMonth(nextDate.slice(0, 7));
    setFocusedDate(nextDate);
  };

  return (
    <div className="qb-calendar" role="group" aria-labelledby={groupLabelId}>
      <span id={groupLabelId} className="qb-calendar__visually-hidden">
        {lang === "zh" ? "選擇服務日期" : "Choose service date"}
      </span>
      <div className="qb-calendar__head">
        <button
          type="button"
          className="qb-calendar__nav-button qb-calendar__nav-button--previous"
          aria-label={lang === "zh" ? "上一個月" : "Previous month"}
          disabled={displayMonth <= minMonth}
          onClick={() => changeMonth(shiftMonth(displayMonth, -1))}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <label htmlFor={monthSelectId} className="qb-calendar__month-label">
          <span className="qb-calendar__visually-hidden">
            {lang === "zh" ? "選擇月份" : "Choose month"}
          </span>
          <select
            id={monthSelectId}
            className="qb-calendar__month-select"
            value={displayMonth}
            onChange={(event) => changeMonth(event.currentTarget.value)}
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month, lang)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="qb-calendar__nav-button qb-calendar__nav-button--next"
          aria-label={lang === "zh" ? "下一個月" : "Next month"}
          disabled={displayMonth >= maxMonth}
          onClick={() => changeMonth(shiftMonth(displayMonth, 1))}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="qb-calendar__grid" role="grid">
        <div className="qb-calendar__weekdays" role="row">
          {weekdays.map((weekday) => (
            <span
              key={weekday}
              className="qb-calendar__weekday"
              role="columnheader"
              aria-label={weekday}
            >
              {weekday}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div className="qb-calendar__week" role="row" key={week}>
            {days.slice(week * 7, week * 7 + 7).map((date) => {
              const selected = date === value;
              const enabled = isSelectable(date);
              const outside = !date.startsWith(`${displayMonth}-`);
              const fullDate = formatFullDate(date, lang);
              return (
                <button
                  key={date}
                  ref={(node) => {
                    if (node) dayRefs.current.set(date, node);
                    else dayRefs.current.delete(date);
                  }}
                  type="button"
                  role="gridcell"
                  className={`qb-calendar__day${selected ? " qb-calendar__selected" : ""}${outside ? " qb-calendar__outside" : ""}`}
                  style={{ minHeight: 44, minWidth: 44 }}
                  disabled={!enabled}
                  tabIndex={enabled && date === tabStop ? 0 : -1}
                  aria-selected={selected}
                  aria-label={
                    selected
                      ? `${lang === "zh" ? "已選擇" : "Selected"}，${fullDate}`
                      : fullDate
                  }
                  onFocus={() => setFocusedDate(date)}
                  onKeyDown={(event) => handleKeyDown(event, date)}
                  onClick={() => {
                    setFocusedDate(date);
                    setVisibleMonth(date.slice(0, 7));
                    onChange(date);
                  }}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ServiceCalendar;
