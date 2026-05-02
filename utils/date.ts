'use strict';
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthTitle(date: Date): string {
  const year = date.getFullYear();
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const month = date.getMonth();
  return `${year}年 ${monthNames[month]}`;
}

function getWeekOfMonth(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayWeek = firstDayOfMonth.getDay();
  const firstMonday = new Date(firstDayOfMonth);
  firstMonday.setDate(firstDayOfMonth.getDate() - ((firstDayWeek + 6) % 7));

  const currentDay = date.getDate();
  const currentWeekMonday = new Date(firstDayOfMonth);
  currentWeekMonday.setDate(firstDayOfMonth.getDate() + currentDay - 1 - ((date.getDay() + 6) % 7));

  const weekNumber = Math.ceil((currentWeekMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return weekNumber;
}

function getMondayOfWeek(date: Date): Date {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getWeekday(dateStr: string): string {
  const date = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[date.getDay()];
}

function formatDayDisplay(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}-${parts[2]}`;
}

function isCurrentWeek(displayDate: Date): boolean {
  const today = new Date();
  const displayWeekMonday = getMondayOfWeek(displayDate);
  const currentWeekMonday = getMondayOfWeek(today);
  return displayWeekMonday.getTime() === currentWeekMonday.getTime();
}

function isCurrentMonth(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}

module.exports = {
  formatDate,
  formatMonthTitle,
  getWeekOfMonth,
  getMondayOfWeek,
  getWeekday,
  formatDayDisplay,
  isCurrentWeek,
  isCurrentMonth
};

export {};
