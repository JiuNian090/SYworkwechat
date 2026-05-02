'use strict';
const { formatDate } = require('./date.js');
const { emojiStateMap, emojiMessageTemplates, emojiMessageTemplatesNoName, emojiScheduleMixedTemplates, messageTemplates } = require('./dailyMessageData.js');

interface ShiftData {
  type?: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  [key: string]: unknown;
}

interface StatusResult {
  status: string;
  shift?: ShiftData | null;
  timePeriod: string;
}

function toAbsolute(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function isWorkingType(type: string): boolean {
  if (!type) {
    return false;
  }
  const nonWorkingTypes = ['休息', '休假', 'SD', '休息日'];
  return !nonWorkingTypes.includes(type.trim());
}

function isNightShift(shift: ShiftData | null | undefined): boolean {
  if (!shift) {
    return false;
  }

  if (shift.type && shift.type.includes('夜')) {
    return true;
  }

  const startTime = shift.startTime;
  const endTime = shift.endTime;

  if (startTime) {
    const [startHour] = startTime.split(':').map(Number);
    if (!isNaN(startHour) && startHour >= 22) {
      return true;
    }
  }

  if (endTime) {
    const [endHour] = endTime.split(':').map(Number);
    if (!isNaN(endHour) && endHour <= 6) {
      return true;
    }
  }

  return false;
}

function calculateShiftDuration(shift: ShiftData | null | undefined): number {
  if (!shift || !shift.date || !shift.startTime || !shift.endTime) {
    return 0;
  }

  const startTime = toAbsolute(shift.date, shift.startTime);
  const endTime = toAbsolute(shift.date, shift.endTime);

  if (!startTime || !endTime) {
    return 0;
  }

  const adjustedEndTime = new Date(endTime);
  if (adjustedEndTime < startTime) {
    adjustedEndTime.setDate(adjustedEndTime.getDate() + 1);
  }

  const durationMs = adjustedEndTime.getTime() - startTime.getTime();
  return durationMs / (1000 * 60 * 60);
}

function determineStatus(shifts: Record<string, ShiftData> | null | undefined, now: Date): StatusResult {
  const todayStr = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const recentShifts: Array<ShiftData> = [];
  if (shifts) {
    if (shifts[yesterdayStr]) {
      recentShifts.push({ ...shifts[yesterdayStr], date: yesterdayStr });
    }
    if (shifts[todayStr]) {
      recentShifts.push({ ...shifts[todayStr], date: todayStr });
    }
    if (shifts[tomorrowStr]) {
      recentShifts.push({ ...shifts[tomorrowStr], date: tomorrowStr });
    }
  }

  let activeShift = null;
  for (const shift of recentShifts) {
    if (!isWorkingType(shift.type || '')) {
      continue;
    }

    const startTime = toAbsolute(shift.date || '', shift.startTime || '');
    let endTime = toAbsolute(shift.date || '', shift.endTime || '');

    if (!startTime || !endTime) {
      continue;
    }

    if (endTime < startTime) {
      const nextDay = new Date(shift.date || '');
      nextDay.setDate(nextDay.getDate() + 1);
      endTime = toAbsolute(formatDate(nextDay), shift.endTime || '');
    }

    if (now >= startTime && endTime && now < endTime) {
      activeShift = shift;
      break;
    }
  }

  const currentHour = now.getHours();
  const yesterdayShift = shifts && shifts[yesterdayStr];

  if (!activeShift && yesterdayShift && isNightShift(yesterdayShift)) {
    const ysStartRaw = toAbsolute(yesterdayStr, yesterdayShift.startTime || '');
    const ysEndRaw = toAbsolute(yesterdayStr, yesterdayShift.endTime || '');
    if (ysStartRaw && ysEndRaw && ysEndRaw > ysStartRaw) {
      const startHour = ysStartRaw.getHours();
      if (startHour >= 0 && startHour < 6) {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
          ysStartRaw.getHours(), ysStartRaw.getMinutes());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
          ysEndRaw.getHours(), ysEndRaw.getMinutes());
        if (now >= todayStart && now < todayEnd) {
          return {
            status: 'workingNightShiftLate',
            shift: yesterdayShift,
            timePeriod: getTimePeriod(currentHour)
          };
        }
      }
    }
  }

  if (activeShift && isNightShift(activeShift) && currentHour >= 0 && currentHour < 6) {
    return {
      status: 'workingNightShiftLate',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }

  if (yesterdayShift && isWorkingType(yesterdayShift.type || '') && isNightShift(yesterdayShift)) {
    const yesterdayStartTime = toAbsolute(yesterdayStr, yesterdayShift.startTime || '');
    let yesterdayEndTime = toAbsolute(yesterdayStr, yesterdayShift.endTime || '');

    if (yesterdayEndTime && yesterdayStartTime && yesterdayEndTime < yesterdayStartTime) {
      const nextDay = new Date(yesterdayStr);
      nextDay.setDate(nextDay.getDate() + 1);
      yesterdayEndTime = toAbsolute(formatDate(nextDay), yesterdayShift.endTime || '');
    }

    if (yesterdayEndTime) {
      const hoursSinceEnd = (now.getTime() - yesterdayEndTime.getTime()) / (1000 * 60 * 60);
      const endHour = yesterdayEndTime.getHours();

      if (currentHour >= 0 && currentHour < 12 &&
          endHour >= 0 && endHour < 12 &&
          hoursSinceEnd > 0 && hoursSinceEnd < 2 && !activeShift) {
        return {
          status: 'nightShiftJustEnded',
          shift: yesterdayShift,
          timePeriod: getTimePeriod(currentHour)
        };
      }
    }
  }

  if (activeShift && currentHour >= 22 && currentHour < 24) {
    return {
      status: 'workingNightShiftEarly',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }

  if (activeShift) {
    const duration = calculateShiftDuration(activeShift);
    if (duration >= 8) {
      return {
        status: 'workingLong',
        shift: activeShift,
        timePeriod: getTimePeriod(currentHour)
      };
    }
  }

  if (activeShift) {
    return {
      status: 'workingShort',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }

  const todayHasWork = shifts && shifts[todayStr] && isWorkingType(shifts[todayStr].type || '');

  if (!activeShift && todayHasWork) {
    const todayShift = shifts![todayStr];
    if (todayShift && isWorkingType(todayShift.type || '')) {
      const shiftStart = toAbsolute(todayStr, todayShift.startTime || '');
      if (shiftStart && now < shiftStart) {
        const hoursUntilStart = (shiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
        const statusKey = hoursUntilStart <= 3 ? 'waitingForShiftSoon' : 'waitingForShift';
        return {
          status: statusKey,
          shift: todayShift,
          timePeriod: getTimePeriod(currentHour)
        };
      }
    }
  }

  if (!todayHasWork && yesterdayShift && isWorkingType(yesterdayShift.type || '') && isNightShift(yesterdayShift)) {
    return {
      status: 'restAfterNightShift',
      shift: yesterdayShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }

  const todayShift = shifts?.[todayStr];
  if (!todayHasWork && todayShift) {
    const type = todayShift.type;
    if (type && (type.includes('休息') || type.includes('休假') || type === 'SD')) {
      const tomorrowHasWork = shifts && shifts[tomorrowStr] && isWorkingType(shifts[tomorrowStr].type || '');
      return {
        status: tomorrowHasWork ? 'restDayWithWorkTomorrow' : 'longVacation',
        shift: todayShift,
        timePeriod: getTimePeriod(currentHour)
      };
    }
  }

  if (!todayHasWork && !todayShift) {
    const tomorrowHasWork = shifts && shifts[tomorrowStr] && isWorkingType(shifts[tomorrowStr].type || '');
    return {
      status: tomorrowHasWork ? 'freeDayWithWorkTomorrow' : 'longVacation',
      timePeriod: getTimePeriod(currentHour)
    };
  }

  return {
    status: 'default',
    timePeriod: getTimePeriod(currentHour)
  };
}

function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 6) {
    return '凌晨';
  } else if (hour >= 6 && hour < 8) {
    return '清晨';
  } else if (hour >= 8 && hour < 12) {
    return '上午';
  } else if (hour >= 12 && hour < 18) {
    return '下午';
  } else if (hour >= 18 && hour < 22) {
    return '晚上';
  } else {
    return '深夜';
  }
}

function getRandomNickname(nickname: string): string {
  if (!nickname || !nickname.trim()) {
    return '';
  }

  const trimmedNickname = nickname.trim();
  const options = [
    `亲爱的${trimmedNickname}`,
    `${trimmedNickname.charAt(trimmedNickname.length - 1)}宝`
  ];

  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
}

function getRandomMessage(status: string, nickname: string, timePeriod: string): string {
  let templateKey = status;

  if (status === 'restAfterNightShift') {
    if (timePeriod === '凌晨' || timePeriod === '清晨' || timePeriod === '上午') {
      templateKey = 'restAfterNightShiftMorning';
    } else {
      templateKey = 'restAfterNightShiftAfternoon';
    }
  }

  let templates;
  if (nickname && nickname.trim()) {
    templates = messageTemplates[templateKey];
  } else {
    templates = messageTemplates[templateKey + 'NoName'] || messageTemplates[templateKey];
  }

  if (!templates || templates.length === 0) {
    templates = nickname ? messageTemplates.default : messageTemplates.defaultNoName;
  }

  const randomIndex = Math.floor(Math.random() * templates.length);
  let message = templates[randomIndex];

  if (nickname && nickname.trim()) {
    const randomNickname = getRandomNickname(nickname);
    message = message.replace('{name}', randomNickname);
  }

  return message;
}

function getEmotionStateByEmoji(emoji: string): string | null {
  if (!emoji) return null;
  return emojiStateMap[emoji] || null;
}

function getMessageByEmoji(emoji: string, nickname: string): string | null {
  const state = getEmotionStateByEmoji(emoji);
  if (!state) return null;

  let templates;
  if (nickname && nickname.trim()) {
    templates = emojiMessageTemplates[state];
  } else {
    templates = emojiMessageTemplatesNoName[state];
  }

  if (!templates || templates.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * templates.length);
  let message = templates[randomIndex];

  if (nickname && nickname.trim()) {
    const randomNickname = getRandomNickname(nickname);
    message = message.replace('{name}', randomNickname);
  }

  return message;
}

function getTodayStatus(scheduleData: Record<string, ShiftData> | null | undefined, now: Date): string {
  const todayStr = formatDate(now);
  const todayShift = scheduleData && scheduleData[todayStr];

  if (todayShift && isWorkingType(todayShift.type || '')) {
    return 'working';
  }
  return 'rest';
}

function getMixedEmojiMessage(emoji: string, nickname: string, todayStatus: string): string | null {
  const emotionState = getEmotionStateByEmoji(emoji);
  if (!emotionState) {
    return null;
  }

  const mixedKey = `${emotionState}-${todayStatus}`;
  const templates = emojiScheduleMixedTemplates[mixedKey];
  const templatesNoName = emojiScheduleMixedTemplates[`${mixedKey}NoName`];

  if (!templates || !templatesNoName) {
    return null;
  }

  let messageTemplates;
  if (nickname && nickname.trim()) {
    messageTemplates = templates;
  } else {
    messageTemplates = templatesNoName;
  }

  const randomIndex = Math.floor(Math.random() * messageTemplates.length);
  let message = messageTemplates[randomIndex];

  if (nickname && nickname.trim()) {
    const randomNickname = getRandomNickname(nickname);
    message = message.replace('{name}', randomNickname);
  }

  return message;
}

function getDailyMessage(nickname: string, scheduleData: Record<string, ShiftData> | null | undefined, emoji?: string, now?: Date): string {
  const currentNow = now || new Date();
  const todayStatus = getTodayStatus(scheduleData, currentNow);

  if (emoji) {
    const mixedMessage = getMixedEmojiMessage(emoji, nickname, todayStatus);
    if (mixedMessage) {
      return mixedMessage;
    }

    const emojiMessage = getMessageByEmoji(emoji, nickname);
    if (emojiMessage) {
      return emojiMessage;
    }
  }

  const statusResult = determineStatus(scheduleData, currentNow);
  return getRandomMessage(statusResult.status, nickname, statusResult.timePeriod);
}

module.exports = {
  getDailyMessage
};

export {};
