'use strict';
const { formatDate } = require('./date.js');
const { emojiStateMap, emojiMessageTemplates, emojiMessageTemplatesNoName, emojiScheduleMixedTemplates, messageTemplates } = require('./dailyMessageData.js');

interface ShiftData {
  type?: string;
  name?: string;
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

/** ---------- 工具函数 ---------- */

function toAbsolute(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function getShiftStartEnd(shift: ShiftData, dateStr: string): { start: Date | null; end: Date | null } {
  const start = toAbsolute(dateStr, shift.startTime || '');
  let end = toAbsolute(dateStr, shift.endTime || '');
  if (end && start && end < start) {
    const nextDay = new Date(dateStr);
    nextDay.setDate(nextDay.getDate() + 1);
    end = toAbsolute(formatDate(nextDay), shift.endTime || '');
  }
  return { start, end };
}

/** ---------- 排班分类 ---------- */

const NON_WORKING_TYPES = ['休息', '休假', 'SD', '休息日'];

function isWorkingType(type: string): boolean {
  if (!type) return false;
  return !NON_WORKING_TYPES.includes(type.trim());
}

/**
 * 根据班次名称和上下班时间判断班制类型
 * 可识别：中班 / 夜班 / 5-8长跨夜 / 日班
 */
function classifyShift(shift: ShiftData | null | undefined): string {
  if (!shift || !isWorkingType(shift.type || '')) return 'rest';

  const name = (shift.name || '').trim();
  const startTime = shift.startTime || '';
  const endTime = shift.endTime || '';
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);

  // 名称直接匹配
  if (name.includes('中班')) return 'mid';
  if (name === '夜班' || name.includes('夜班')) return 'night';
  if (name === '5-8') return 'overnight';

  // 根据时间推断
  if (!isNaN(startHour) && !isNaN(endHour)) {
    // 中班: 16:00-18:00 上班, 00:00-03:00 下班
    if (startHour >= 16 && startHour <= 18 && endHour >= 0 && endHour <= 3) return 'mid';
    // 夜班: 00:00-03:00 上班, 06:00-09:00 下班
    if (startHour >= 0 && startHour <= 3 && endHour >= 6 && endHour <= 9) return 'night';
    // 长跨夜: 16:00-18:00 上班, 06:00-09:00 下班（跨午夜且跨到次日早上）
    if (startHour >= 16 && startHour <= 18 && endHour >= 6 && endHour <= 9) return 'overnight';
  }

  return 'day';
}

/**
 * 检查某个班次是否在某个时间点"刚刚结束"（2小时内）
 */
function recentlyEnded(shift: ShiftData, dateStr: string, now: Date): boolean {
  const { start, end } = getShiftStartEnd(shift, dateStr);
  if (!end) return false;
  if (end > now) return false; // 还没结束
  const hoursSince = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 0 && hoursSince < 2;
}

/**
 * 检查用户是否正处于跨夜班后的休息/补觉状态
 * 昨夜上了跨夜班（中班/夜班/5-8），今天白天应该是在休息
 */
function isRecoveringFromOvernight(yesterdayShift: ShiftData | null | undefined): boolean {
  if (!yesterdayShift || !isWorkingType(yesterdayShift.type || '')) return false;
  const cat = classifyShift(yesterdayShift);
  return cat === 'mid' || cat === 'night' || cat === 'overnight';
}

/** ---------- 精细时间分段 ---------- */

function getTimePeriod(hour: number): string {
  if (hour >= 0 && hour < 3) return '深夜';
  if (hour >= 3 && hour < 5) return '凌晨';
  if (hour >= 5 && hour < 6) return '拂晓';
  if (hour >= 6 && hour < 8) return '清晨';
  if (hour >= 8 && hour < 11) return '上午';
  if (hour >= 11 && hour < 13) return '正午';
  if (hour >= 13 && hour < 17) return '下午';
  if (hour >= 17 && hour < 19) return '傍晚';
  return '晚上';
}

/** ---------- 亲昵称呼生成 ---------- */

function getRandomNickname(nickname: string): string {
  if (!nickname || !nickname.trim()) return '';
  const n = nickname.trim();
  const lastChar = n.charAt(n.length - 1);
  const firstChar = n.charAt(0);
  const twoChars = n.length >= 2 ? n.slice(-2) : n;

  const options = [
    `亲爱的${firstChar}`,
    `${lastChar}宝`,
    `${firstChar}大人`,
    `小${lastChar}`,
    `${twoChars}同学`,
    `${twoChars}呀`,
    `${lastChar}崽`,
  ];

  return options[Math.floor(Math.random() * options.length)];
}

/** ---------- 核心：排班状态判定 ---------- */

function determineStatus(shifts: Record<string, ShiftData> | null | undefined, now: Date): StatusResult {
  const todayStr = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const currentHour = now.getHours();

  /** ---------- 收集三天排班 ---------- */
  const todayShift: ShiftData | undefined = shifts?.[todayStr];
  const yesterdayShift: ShiftData | undefined = shifts?.[yesterdayStr];
  const tomorrowShift: ShiftData | undefined = shifts?.[tomorrowStr];

  const todayHasWork = todayShift ? isWorkingType(todayShift.type || '') : false;
  const yesterdayHasWork = yesterdayShift ? isWorkingType(yesterdayShift.type || '') : false;
  const tomorrowHasWork = tomorrowShift ? isWorkingType(tomorrowShift.type || '') : false;

  const todayCategory = todayHasWork ? classifyShift(todayShift) : 'rest';
  const yesterdayCategory = yesterdayHasWork ? classifyShift(yesterdayShift) : 'rest';
  const tomorrowCategory = tomorrowHasWork ? classifyShift(tomorrowShift) : 'rest';

  /** ---------- 当前是否在工作 ---------- */
  let activeShift: ShiftData | null = null;
  let activeCategory = '';

  for (const [date, shift] of Object.entries(shifts || {})) {
    if (!isWorkingType(shift.type || '')) continue;
    const { start, end } = getShiftStartEnd(shift, date);
    if (start && end && now >= start && now < end) {
      activeShift = { ...shift, date };
      activeCategory = classifyShift(shift);
      break;
    }
  }

  const timePeriod = getTimePeriod(currentHour);

  /** ============ 1. 正在工作中 ============ */
  if (activeShift) {
    switch (activeCategory) {
      case 'mid':
        return { status: 'workingMidShift', shift: activeShift, timePeriod };
      case 'night':
        return { status: 'workingNightShift', shift: activeShift, timePeriod };
      case 'overnight':
        return { status: 'workingOvernight', shift: activeShift, timePeriod };
      default: {
        const duration = calculateShiftDuration(activeShift);
        return {
          status: duration >= 8 ? 'workingDayLong' : 'workingDayShort',
          shift: activeShift,
          timePeriod
        };
      }
    }
  }

  /** ============ 2. 刚下班（2小时内） ============ */
  // 检查昨天的跨夜班是否刚刚结束（夜班/中班/5-8 早上结束的情况）
  if (yesterdayHasWork) {
    const { end } = getShiftStartEnd(yesterdayShift!, yesterdayStr);
    if (end && end < now) {
      const hoursSince = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 0 && hoursSince < 2) {
        const cat = classifyShift(yesterdayShift);
        if (cat === 'mid') return { status: 'midShiftJustEnded', shift: yesterdayShift, timePeriod };
        if (cat === 'night') return { status: 'nightShiftJustEnded', shift: yesterdayShift, timePeriod };
        if (cat === 'overnight') return { status: 'overnightJustEnded', shift: yesterdayShift, timePeriod };
        if (currentHour >= 15 || currentHour < 10) return { status: 'dayShiftJustEnded', shift: yesterdayShift, timePeriod };
      }
    }
  }

  // 检查今天的班次是否刚刚结束（适用于白天班或昨天开始的跨夜班在早上结束）
  if (todayHasWork && currentHour >= 13) {
    const { start, end } = getShiftStartEnd(todayShift!, todayStr);
    if (end && end < now) {
      const hoursSince = (now.getTime() - end.getTime()) / (1000 * 60 * 60);
      if (hoursSince >= 0 && hoursSince < 2) {
        return { status: 'dayShiftJustEnded', shift: todayShift, timePeriod };
      }
    }
  }

  /** ============ 3. 跨夜班后的休息/补觉 ============ */
  // 如果昨天上了中班/夜班/5-8，今天没有班（或有 SD/休），并且现在还在白天 → 补觉恢复中
  if (isRecoveringFromOvernight(yesterdayShift)) {
    const yesterdayCat = classifyShift(yesterdayShift);

    // 如果今天没有工作
    if (!todayHasWork) {
      // 早上→中午→下午 分别是不同的休息阶段
      if (currentHour >= 0 && currentHour < 12) {
        // 早上应该是还在补觉或者刚醒
        if (yesterdayCat === 'mid') return { status: 'sleepingAfterMidShift', shift: yesterdayShift, timePeriod };
        if (yesterdayCat === 'night') return { status: 'sleepingAfterNightShift', shift: yesterdayShift, timePeriod };
        if (yesterdayCat === 'overnight') return { status: 'sleepingAfterOvernight', shift: yesterdayShift, timePeriod };
      } else {
        // 下午醒了，在休息恢复
        if (yesterdayCat === 'mid') return { status: 'awakeAfterMidShift', shift: yesterdayShift, timePeriod };
        if (yesterdayCat === 'night') return { status: 'awakeAfterNightShift', shift: yesterdayShift, timePeriod };
        if (yesterdayCat === 'overnight') return { status: 'awakeAfterOvernight', shift: yesterdayShift, timePeriod };
      }
    }

    // 今天也有班？检查是否在等待中
    if (todayHasWork && todayCategory !== 'day') {
      const { start } = getShiftStartEnd(todayShift!, todayStr);
      if (start && now < start) {
        const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
        const soon = hoursUntil <= 3;
        switch (todayCategory) {
          case 'mid':
            return { status: soon ? 'waitingForMidShiftSoon' : 'waitingForMidShift', shift: todayShift, timePeriod };
          case 'night':
            return { status: soon ? 'waitingForNightShiftSoon' : 'waitingForNightShift', shift: todayShift, timePeriod };
          case 'overnight':
            return { status: soon ? 'waitingForOvernightSoon' : 'waitingForOvernight', shift: todayShift, timePeriod };
        }
      }
    }
  }

  /** ============ 4. 等待上班 ============ */
  if (todayHasWork) {
    const { start } = getShiftStartEnd(todayShift!, todayStr);
    if (start && now < start) {
      const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
      const soon = hoursUntil <= 3;

      switch (todayCategory) {
        case 'mid':
          return { status: soon ? 'waitingForMidShiftSoon' : 'waitingForMidShift', shift: todayShift, timePeriod };
        case 'night':
          return { status: soon ? 'waitingForNightShiftSoon' : 'waitingForNightShift', shift: todayShift, timePeriod };
        case 'overnight':
          return { status: soon ? 'waitingForOvernightSoon' : 'waitingForOvernight', shift: todayShift, timePeriod };
        default: // 白天班
          return { status: soon ? 'waitingForDayShiftSoon' : 'waitingForDayShift', shift: todayShift, timePeriod };
      }
    }
  }

  /** ============ 5. 休息日 ============ */
  if (!todayHasWork) {
    if (todayShift && (todayShift.type || '').trim() !== '') {
      // 今天有排班记录但类型是休息
      if (tomorrowHasWork) {
        return { status: 'restDayWithWorkTomorrow', shift: todayShift, timePeriod };
      }
      return { status: 'longVacation', shift: todayShift, timePeriod };
    }

    // 今天没有排班记录
    if (tomorrowHasWork) {
      return { status: 'freeDayWithWorkTomorrow', timePeriod };
    }
    return { status: 'longVacation', timePeriod };
  }

  /** ============ 6. 兜底 ============ */
  return { status: 'default', timePeriod };
}

function calculateShiftDuration(shift: ShiftData | null | undefined): number {
  if (!shift || !shift.date || !shift.startTime || !shift.endTime) return 0;
  const { start, end } = getShiftStartEnd(shift, shift.date);
  if (!start || !end) return 0;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/** ---------- 模板获取 ---------- */

function getRandomMessage(status: string, nickname: string, timePeriod: string): string {
  let templateKey = status;

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
    message = message.replace(/\{name\}/g, randomNickname);
  }

  return message;
}

/** ---------- Emoji 相关 ---------- */

function getEmotionStateByEmoji(emoji: string): string | null {
  if (!emoji) return null;
  return emojiStateMap[emoji] || null;
}

function getMessageByEmoji(emoji: string, nickname: string): string | null {
  const state = getEmotionStateByEmoji(emoji);
  if (!state) return null;

  const templatesData = (nickname && nickname.trim())
    ? emojiMessageTemplates[state]
    : emojiMessageTemplatesNoName[state];

  if (!templatesData || templatesData.length === 0) return null;

  const message = templatesData[Math.floor(Math.random() * templatesData.length)];
  if (nickname && nickname.trim()) {
    return message.replace(/\{name\}/g, getRandomNickname(nickname));
  }
  return message;
}

function getTodayStatus(scheduleData: Record<string, ShiftData> | null | undefined, now: Date): string {
  const todayStr = formatDate(now);
  const todayShift = scheduleData && scheduleData[todayStr];
  if (todayShift && isWorkingType(todayShift.type || '')) {
    const cat = classifyShift(todayShift);
    return cat;
  }
  return 'rest';
}

function getMixedEmojiMessage(emoji: string, nickname: string, todayStatus: string): string | null {
  const emotionState = getEmotionStateByEmoji(emoji);
  if (!emotionState) return null;

  // 按优先级尝试：专精状态 → 通用工作状态 → 通用休息状态
  const fallbackKeys: string[] = [todayStatus];
  if (todayStatus === 'mid' || todayStatus === 'night' || todayStatus === 'overnight') {
    fallbackKeys.push('working');
  } else if (todayStatus === 'day') {
    fallbackKeys.push('working');
  } else {
    fallbackKeys.push('rest');
  }
  fallbackKeys.push('rest'); // 最终兜底

  for (const key of fallbackKeys) {
    const mixedKey = `${emotionState}-${key}`;
    const pool = (nickname && nickname.trim())
      ? emojiScheduleMixedTemplates[mixedKey]
      : (emojiScheduleMixedTemplates[`${mixedKey}NoName`] || emojiScheduleMixedTemplates[mixedKey]);
    if (pool && pool.length > 0) {
      const message = pool[Math.floor(Math.random() * pool.length)];
      if (nickname && nickname.trim()) {
        return message.replace(/\{name\}/g, getRandomNickname(nickname));
      }
      return message;
    }
  }
  return null;
}

/** ---------- 主入口 ---------- */

function getDailyMessage(nickname: string, scheduleData: Record<string, ShiftData> | null | undefined, emoji?: string, now?: Date): string {
  const currentNow = now || new Date();
  const todayStatus = getTodayStatus(scheduleData, currentNow);

  if (emoji) {
    // 只使用「表情+排班状态」的组合心语，不使用纯表情心语
    const mixedMessage = getMixedEmojiMessage(emoji, nickname, todayStatus);
    if (mixedMessage) return mixedMessage;
  }

  const statusResult = determineStatus(scheduleData, currentNow);
  return getRandomMessage(statusResult.status, nickname, statusResult.timePeriod);
}

module.exports = { getDailyMessage };
export {};
