'use strict';

/**
 * 今日心语模块
 * 根据排班状态和当前时间，生成个性化关怀话语
 */

// 表情状态映射
const emojiStateMap = {
  // 疲惫/累状态
  '😩': 'tired',
  '😫': 'tired',
  '😴': 'tired',
  '😪': 'tired',
  '🥴': 'tired',
  '😵': 'tired',
  
  // 难过/悲伤状态
  '😔': 'sad',
  '😞': 'sad',
  '🙁': 'sad',
  '☹️': 'sad',
  '😢': 'sad',
  '😭': 'sad',
  '😟': 'sad',
  
  // 压力/焦虑状态
  '😰': 'stressed',
  '😣': 'stressed',
  '😖': 'stressed',
  '😨': 'stressed',
  '😱': 'stressed',
  '😓': 'stressed',
  '🤯': 'stressed',
  
  // 愤怒/生气状态
  '😤': 'angry',
  '😠': 'angry',
  '😡': 'angry',
  '🤬': 'angry',
  
  // 生病状态
  '🤒': 'sick',
  '🤕': 'sick',
  '🤢': 'sick',
  '🤮': 'sick',
  '🤧': 'sick',
  '😷': 'sick',
  
  // 开心/积极状态
  '😊': 'happy',
  '😃': 'happy',
  '😄': 'happy',
  '😁': 'happy',
  '😆': 'happy',
  '🤣': 'happy',
  '😂': 'happy',
  '😉': 'happy',
  '😍': 'happy',
  '🥰': 'happy',
  '😘': 'happy',
  '😋': 'happy',
  '🤪': 'happy',
  '😎': 'happy',
  '🤩': 'happy',
  '🥳': 'happy',
  '🤗': 'happy'
};

// 表情专属话语库
const emojiMessageTemplates = {
  tired: [
    '💪 {name}，辛苦了！累了就休息一下吧。',
    '😴 {name}，休息是为了更好地出发。',
    '☕ {name}，泡杯热茶，放松一下。',
    '🛋️ {name}，好好休息，明天会更好。',
    '🌸 {name}，别太累了，身体最重要。',
    '🌙 {name}，早点休息，晚安。',
    '💤 {name}，辛苦了，睡个好觉。',
    '✨ {name}，你已经很棒了，歇会儿吧。'
  ],
  sad: [
    '🤗 {name}，别难过，一切都会好的。',
    '💝 {name}，你不是一个人，有我在呢。',
    '🌈 {name}，雨后会有彩虹的。',
    '❤️ {name}，抱抱你，都会过去的。',
    '🌻 {name}，明天会更好的。',
    '🎁 {name}，给自己一个小奖励吧。',
    '🌤️ {name}，乌云会散去的。',
    '💐 {name}，你值得被温柔对待。'
  ],
  stressed: [
    '🧘 {name}，深呼吸，放轻松。',
    '🌊 {name}，慢慢来，不着急。',
    '🎈 {name}，压力大就出去走走吧。',
    '🍀 {name}，你可以的，相信自己。',
    '🎶 {name}，听首歌放松一下。',
    '🌳 {name}，给自己留一点空间。',
    '💎 {name}，你很强大，没问题的。',
    '🌺 {name}，别急，一步步来。'
  ],
  angry: [
    '😌 {name}，消消气，别气坏身体。',
    '🍃 {name}，深呼吸，冷静一下。',
    '🧊 {name}，喝杯水，放轻松。',
    '🌿 {name}，换个心情，没什么大不了。',
    '🌸 {name}，生气伤身体，不值得。',
    '💆 {name}，放松一下，别想太多。',
    '🌻 {name}，一切都会好起来的。',
    '🍀 {name}，好运会来的。'
  ],
  sick: [
    '💊 {name}，好好养病，早日康复。',
    '😷 {name}，好好休息，多喝水。',
    '🏥 {name}，注意身体，快点好起来。',
    '❤️ {name}，好好照顾自己哦。',
    '🍜 {name}，吃点热乎的，暖暖身子。',
    '🛌 {name}，好好休息，很快就好。',
    '🌈 {name}，病好了想做什么呀？',
    '🌸 {name}，快点好起来呀。'
  ],
  happy: [
    '🎉 {name}，今天也要开心哦！',
    '🌟 {name}，你的笑容真好看！',
    '🌈 {name}，开心的一天开始啦！',
    '🎁 {name}，希望你每天都这么开心！',
    '🌸 {name}，你开心我也开心！',
    '✨ {name}，继续保持好心情！',
    '🎈 {name}，开心每一天！',
    '🌺 {name}，心情棒棒哒！'
  ]
};

// 表情专属无昵称话语库
const emojiMessageTemplatesNoName = {
  tired: [
    '💪 辛苦了！累了就休息一下吧。',
    '😴 休息是为了更好地出发。',
    '☕ 泡杯热茶，放松一下。',
    '🛋️ 好好休息，明天会更好。',
    '🌸 别太累了，身体最重要。',
    '🌙 早点休息，晚安。',
    '💤 辛苦了，睡个好觉。',
    '✨ 你已经很棒了，歇会儿吧。'
  ],
  sad: [
    '🤗 别难过，一切都会好的。',
    '💝 你不是一个人，有我在呢。',
    '🌈 雨后会有彩虹的。',
    '❤️ 抱抱你，都会过去的。',
    '🌻 明天会更好的。',
    '🎁 给自己一个小奖励吧。',
    '🌤️ 乌云会散去的。',
    '💐 你值得被温柔对待。'
  ],
  stressed: [
    '🧘 深呼吸，放轻松。',
    '🌊 慢慢来，不着急。',
    '🎈 压力大就出去走走吧。',
    '🍀 你可以的，相信自己。',
    '🎶 听首歌放松一下。',
    '🌳 给自己留一点空间。',
    '💎 你很强大，没问题的。',
    '🌺 别急，一步步来。'
  ],
  angry: [
    '😌 消消气，别气坏身体。',
    '🍃 深呼吸，冷静一下。',
    '🧊 喝杯水，放轻松。',
    '🌿 换个心情，没什么大不了。',
    '🌸 生气伤身体，不值得。',
    '💆 放松一下，别想太多。',
    '🌻 一切都会好起来的。',
    '🍀 好运会来的。'
  ],
  sick: [
    '💊 好好养病，早日康复。',
    '😷 好好休息，多喝水。',
    '🏥 注意身体，快点好起来。',
    '❤️ 好好照顾自己哦。',
    '🍜 吃点热乎的，暖暖身子。',
    '🛌 好好休息，很快就好。',
    '🌈 病好了想做什么呀？',
    '🌸 快点好起来呀。'
  ],
  happy: [
    '🎉 今天也要开心哦！',
    '🌟 你的笑容真好看！',
    '🌈 开心的一天开始啦！',
    '🎁 希望你每天都这么开心！',
    '🌸 你开心我也开心！',
    '✨ 继续保持好心情！',
    '🎈 开心每一天！',
    '🌺 心情棒棒哒！'
  ]
};

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将日期字符串和时间字符串转换为 Date 对象
 * @param {string} dateStr 日期字符串 YYYY-MM-DD
 * @param {string} timeStr 时间字符串 HH:mm
 * @returns {Date|null} 合并后的 Date 对象
 */
function toAbsolute(dateStr, timeStr) {
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

/**
 * 判断班次类型是否为工作类型
 * @param {string} type 班次类型
 * @returns {boolean} 是否为工作类型
 */
function isWorkingType(type) {
  if (!type) {
    return false;
  }
  const nonWorkingTypes = ['休息', '休假', 'SD'];
  return !nonWorkingTypes.includes(type.trim());
}

/**
 * 判断班次是否为夜班
 * @param {Object} shift 班次对象
 * @returns {boolean} 是否为夜班
 */
function isNightShift(shift) {
  if (!shift) {
    return false;
  }
  
  // 检查类型是否包含“夜”
  if (shift.type && shift.type.includes('夜')) {
    return true;
  }
  
  const startTime = shift.startTime;
  const endTime = shift.endTime;
  
  // 检查开始时间是否 >= 22:00
  if (startTime) {
    const [startHour] = startTime.split(':').map(Number);
    if (!isNaN(startHour) && startHour >= 22) {
      return true;
    }
  }
  
  // 检查结束时间是否 <= 06:00
  if (endTime) {
    const [endHour] = endTime.split(':').map(Number);
    if (!isNaN(endHour) && endHour <= 6) {
      return true;
    }
  }
  
  return false;
}

/**
 * 计算班次时长（小时）
 * @param {Object} shift 班次对象
 * @returns {number} 班次时长（小时）
 */
function calculateShiftDuration(shift) {
  if (!shift || !shift.date || !shift.startTime || !shift.endTime) {
    return 0;
  }
  
  const startTime = toAbsolute(shift.date, shift.startTime);
  const endTime = toAbsolute(shift.date, shift.endTime);
  
  if (!startTime || !endTime) {
    return 0;
  }
  
  // 处理跨夜班次
  let adjustedEndTime = new Date(endTime);
  if (adjustedEndTime < startTime) {
    adjustedEndTime.setDate(adjustedEndTime.getDate() + 1);
  }
  
  const durationMs = adjustedEndTime - startTime;
  return durationMs / (1000 * 60 * 60);
}

/**
 * 判定当前状态
 * @param {Object} shifts 排班数据
 * @param {Date} now 当前时间
 * @returns {Object} 状态对象
 */
function determineStatus(shifts, now) {
  const todayStr = formatDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);
  
  // 筛选昨今明三天的排班
  const recentShifts = [];
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
  
  // 查找当前正在进行的班次
  let activeShift = null;
  for (const shift of recentShifts) {
    if (!isWorkingType(shift.type)) {
      continue;
    }
    
    const startTime = toAbsolute(shift.date, shift.startTime);
    let endTime = toAbsolute(shift.date, shift.endTime);
    
    if (!startTime || !endTime) {
      continue;
    }
    
    // 处理跨夜班次
    if (endTime < startTime) {
      const nextDay = new Date(shift.date);
      nextDay.setDate(nextDay.getDate() + 1);
      endTime = toAbsolute(formatDate(nextDay), shift.endTime);
    }
    
    if (now >= startTime && now < endTime) {
      activeShift = shift;
      break;
    }
  }
  
  const currentHour = now.getHours();
  
  // 优先级 1: 正在上夜班（凌晨 0-6 点）
  if (activeShift && isNightShift(activeShift) && currentHour >= 0 && currentHour < 6) {
    return {
      status: 'workingNightShiftLate',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }
  
  // 优先级 2: 夜班刚结束（昨天夜班，现在在 0-12 点之间，距离结束不足 2 小时）
  const yesterdayShift = shifts && shifts[yesterdayStr];
  if (yesterdayShift && isWorkingType(yesterdayShift.type) && isNightShift(yesterdayShift)) {
    const yesterdayStartTime = toAbsolute(yesterdayStr, yesterdayShift.startTime);
    let yesterdayEndTime = toAbsolute(yesterdayStr, yesterdayShift.endTime);
    
    if (yesterdayEndTime && yesterdayStartTime && yesterdayEndTime < yesterdayStartTime) {
      const nextDay = new Date(yesterdayStr);
      nextDay.setDate(nextDay.getDate() + 1);
      yesterdayEndTime = toAbsolute(formatDate(nextDay), yesterdayShift.endTime);
    }
    
    if (yesterdayEndTime) {
      const hoursSinceEnd = (now - yesterdayEndTime) / (1000 * 60 * 60);
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
  
  // 优先级 3: 正在上深夜班（22-24 点）
  if (activeShift && currentHour >= 22 && currentHour < 24) {
    return {
      status: 'workingNightShiftEarly',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }
  
  // 优先级 4: 上班中（长工时 >= 8 小时）
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
  
  // 优先级 5: 上班中（短工时 < 8 小时）
  if (activeShift) {
    return {
      status: 'workingShort',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }
  
  // 检查今天是否有工作排班
  const todayHasWork = shifts && shifts[todayStr] && isWorkingType(shifts[todayStr].type);
  
  // 优先级 6: 下夜班休息（今天无工作，昨天有夜班）
  if (!todayHasWork && yesterdayShift && isWorkingType(yesterdayShift.type) && isNightShift(yesterdayShift)) {
    return {
      status: 'restAfterNightShift',
      shift: yesterdayShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }
  
  // 优先级 7: 明确休息日（今天无工作，但有休息/休假/SD 记录）
  const todayShift = shifts && shifts[todayStr];
  if (!todayHasWork && todayShift) {
    const type = todayShift.type;
    if (type && (type.includes('休息') || type.includes('休假') || type === 'SD')) {
      const tomorrowHasWork = shifts && shifts[tomorrowStr] && isWorkingType(shifts[tomorrowStr].type);
      return {
        status: tomorrowHasWork ? 'restDayWithWorkTomorrow' : 'longVacation',
        shift: todayShift,
        timePeriod: getTimePeriod(currentHour)
      };
    }
  }
  
  // 优先级 8: 无排班闲暇
  if (!todayHasWork && !todayShift) {
    const tomorrowHasWork = shifts && shifts[tomorrowStr] && isWorkingType(shifts[tomorrowStr].type);
    return {
      status: tomorrowHasWork ? 'freeDayWithWorkTomorrow' : 'longVacation',
      timePeriod: getTimePeriod(currentHour)
    };
  }
  
  // 优先级 9: 兜底
  return {
    status: 'default',
    timePeriod: getTimePeriod(currentHour)
  };
}

/**
 * 获取当前时段
 * @param {number} hour 当前小时
 * @returns {string} 时段名称
 */
function getTimePeriod(hour) {
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

/**
 * 话语库
 */
const messageTemplates = {
  workingNightShiftLate: [
    '🌃 {name}，凌晨的坚守，整个城市都在感谢你。',
    '🌃 {name}，辛苦了，深夜的城市因你而温暖。',
    '🌃 {name}，坚持住，黎明就在眼前。',
    '🌃 {name}，你的付出，照亮了整个夜晚。',
    '🌃 {name}，这一夜，你是最闪亮的星。',
    '🌃 {name}，夜深了，记得照顾好自己。',
    '🌃 {name}，感谢你的默默付出。',
    '🌃 {name}，这个城市的守护者。'
  ],
  nightShiftJustEnded: [
    '🌅 {name}，天亮了，夜班结束，回去好好睡一觉吧。',
    '🌅 {name}，辛苦了一夜，现在该休息了。',
    '🌅 {name}，终于下班了，晚安。',
    '🌅 {name}，一夜的付出，辛苦了。',
    '🌅 {name}，回去好好补个觉吧。',
    '🌅 {name}，辛苦了，好好休息。',
    '🌅 {name}，结束了，放松一下。',
    '🌅 {name}，晚安，做个好梦。'
  ],
  workingNightShiftEarly: [
    '🌙 {name}，深夜的坚持，辛苦了。',
    '🌙 {name}，夜班开始了，加油。',
    '🌙 {name}，夜晚的工作，感谢有你。',
    '🌙 {name}，今夜，你是最棒的。',
    '🌙 {name}，辛苦了，注意身体。',
    '🌙 {name}，今夜，感谢你的坚守。',
    '🌙 {name}，夜班开始了，照顾好自己。',
    '🌙 {name}，这个夜晚，有你真好。'
  ],
  workingLong: [
    '💪 {name}，今天战线有点长，但你比昨天更强大。',
    '💪 {name}，加油，你可以的。',
    '💪 {name}，虽然辛苦，但你很棒。',
    '💪 {name}，坚持就是胜利。',
    '💪 {name}，辛苦了，你做得很好。',
    '💪 {name}，今天是充实的一天。',
    '💪 {name}，加油，胜利在前方。',
    '💪 {name}，你真的很努力。'
  ],
  workingShort: [
    '🌿 {name}，节奏刚刚好，别忘了喝口水走动一下。',
    '🌿 {name}，今天很轻松，好好享受。',
    '🌿 {name}，工作时间不长，也要认真完成。',
    '🌿 {name}，轻松的一天，保持好心情。',
    '🌿 {name}，今天节奏不错，继续保持。',
    '🌿 {name}，工作不累，也要注意休息。',
    '🌿 {name}，轻松的工作，愉快的心情。',
    '🌿 {name}，今天很顺利呢。'
  ],
  restAfterNightShiftMorning: [
    '🛌 {name}，下夜班辛苦了，拉好窗帘深度补觉。',
    '🛌 {name}，辛苦了一夜，好好睡一觉。',
    '🛌 {name}，现在是补觉的好时候。',
    '🛌 {name}，好好休息，恢复体力。',
    '🛌 {name}，睡个好觉，明天见。',
    '🛌 {name}，辛苦了，好好休息。',
    '🛌 {name}，休息是为了更好地出发。',
    '🛌 {name}，好好睡吧，做个好梦。'
  ],
  restAfterNightShiftAfternoon: [
    '🍵 {name}，下夜班的休息日，泡杯热茶享受慢时光。',
    '🍵 {name}，休息一下，放松心情。',
    '🍵 {name}，今天是你的休息日。',
    '🍵 {name}，辛苦了，好好享受休息时光。',
    '🍵 {name}，放松一下，享受生活。',
    '🍵 {name}，休息的日子，好好珍惜。',
    '🍵 {name}，今天就好好放松吧。',
    '🍵 {name}，享受你的休息日。'
  ],
  restDayWithWorkTomorrow: [
    '🔋 {name}，今天是你的充电日，为明天储备能量。',
    '🔋 {name}，休息一下，明天继续加油。',
    '🔋 {name}，今天好好休息，明天好好工作。',
    '🔋 {name}，充电完成，明天更有活力。',
    '🔋 {name}，休息是为了更好地工作。',
    '🔋 {name}，今天好好放松，明天努力工作。',
    '🔋 {name}，休息一下，明天会更好。',
    '🔋 {name}，今天是你的休息日。'
  ],
  longVacation: [
    '😴 {name}，自由日快乐！彻底放空自己。',
    '😴 {name}，今天好好休息，放松一下。',
    '😴 {name}，享受你的自由时光。',
    '😴 {name}，今天是你的休息日，好好享受。',
    '😴 {name}，休息一下，享受生活。',
    '😴 {name}，今天就好好放松吧。',
    '😴 {name}，自由的一天，开心就好。',
    '😴 {name}，今天好好享受吧。'
  ],
  freeDayWithWorkTomorrow: [
    '🤗 {name}，意外的闲暇，好好享受吧。',
    '🤗 {name}，今天没有排班，好好放松。',
    '🤗 {name}，意外的惊喜，好好享受。',
    '🤗 {name}，今天是你的自由日。',
    '🤗 {name}，没有排班的一天，好好休息。',
    '🤗 {name}，享受意外的闲暇时光。',
    '🤗 {name}，今天好好放松一下吧。',
    '🤗 {name}，意外的休息，好好珍惜。'
  ],
  default: [
    '☀️ {name}，今天也要开心哦。',
    '☀️ {name}，新的一天，新的开始。',
    '☀️ {name}，今天天气不错，心情也要好。',
    '☀️ {name}，愿你今天一切顺利。',
    '☀️ {name}，新的一天，加油。',
    '☀️ {name}，今天也要元气满满。',
    '☀️ {name}，愿你今天有个好心情。',
    '☀️ {name}，美好的一天开始了。'
  ],
  workingNightShiftLateNoName: [
    '🌃 凌晨的坚守，整个城市都在感谢你。',
    '🌃 辛苦了，深夜的城市因你而温暖。',
    '🌃 坚持住，黎明就在眼前。',
    '🌃 你的付出，照亮了整个夜晚。',
    '🌃 这一夜，你是最闪亮的星。',
    '🌃 夜深了，记得照顾好自己。',
    '🌃 感谢你的默默付出。',
    '🌃 这个城市的守护者。'
  ],
  nightShiftJustEndedNoName: [
    '🌅 天亮了，夜班结束，回去好好睡一觉吧。',
    '🌅 辛苦了一夜，现在该休息了。',
    '🌅 终于下班了，晚安。',
    '🌅 一夜的付出，辛苦了。',
    '🌅 回去好好补个觉吧。',
    '🌅 辛苦了，好好休息。',
    '🌅 结束了，放松一下。',
    '🌅 晚安，做个好梦。'
  ],
  workingNightShiftEarlyNoName: [
    '🌙 深夜的坚持，辛苦了。',
    '🌙 夜班开始了，加油。',
    '🌙 夜晚的工作，感谢有你。',
    '🌙 今夜，你是最棒的。',
    '🌙 辛苦了，注意身体。',
    '🌙 今夜，感谢你的坚守。',
    '🌙 夜班开始了，照顾好自己。',
    '🌙 这个夜晚，有你真好。'
  ],
  workingLongNoName: [
    '💪 今天战线有点长，但你比昨天更强大。',
    '💪 加油，你可以的。',
    '💪 虽然辛苦，但你很棒。',
    '💪 坚持就是胜利。',
    '💪 辛苦了，你做得很好。',
    '💪 今天是充实的一天。',
    '💪 加油，胜利在前方。',
    '💪 你真的很努力。'
  ],
  workingShortNoName: [
    '🌿 节奏刚刚好，别忘了喝口水走动一下。',
    '🌿 今天很轻松，好好享受。',
    '🌿 工作时间不长，也要认真完成。',
    '🌿 轻松的一天，保持好心情。',
    '🌿 今天节奏不错，继续保持。',
    '🌿 工作不累，也要注意休息。',
    '🌿 轻松的工作，愉快的心情。',
    '🌿 今天很顺利呢。'
  ],
  restAfterNightShiftMorningNoName: [
    '🛌 下夜班辛苦了，拉好窗帘深度补觉。',
    '🛌 辛苦了一夜，好好睡一觉。',
    '🛌 现在是补觉的好时候。',
    '🛌 好好休息，恢复体力。',
    '🛌 睡个好觉，明天见。',
    '🛌 辛苦了，好好休息。',
    '🛌 休息是为了更好地出发。',
    '🛌 好好睡吧，做个好梦。'
  ],
  restAfterNightShiftAfternoonNoName: [
    '🍵 下夜班的休息日，泡杯热茶享受慢时光。',
    '🍵 休息一下，放松心情。',
    '🍵 今天是你的休息日。',
    '🍵 辛苦了，好好享受休息时光。',
    '🍵 放松一下，享受生活。',
    '🍵 休息的日子，好好珍惜。',
    '🍵 今天就好好放松吧。',
    '🍵 享受你的休息日。'
  ],
  restDayWithWorkTomorrowNoName: [
    '🔋 今天是你的充电日，为明天储备能量。',
    '🔋 休息一下，明天继续加油。',
    '🔋 今天好好休息，明天好好工作。',
    '🔋 充电完成，明天更有活力。',
    '🔋 休息是为了更好地工作。',
    '🔋 今天好好放松，明天努力工作。',
    '🔋 休息一下，明天会更好。',
    '🔋 今天是你的休息日。'
  ],
  longVacationNoName: [
    '😴 自由日快乐！彻底放空自己。',
    '😴 今天好好休息，放松一下。',
    '😴 享受你的自由时光。',
    '😴 今天是你的休息日，好好享受。',
    '😴 休息一下，享受生活。',
    '😴 今天就好好放松吧。',
    '😴 自由的一天，开心就好。',
    '😴 今天好好享受吧。'
  ],
  freeDayWithWorkTomorrowNoName: [
    '🤗 意外的闲暇，好好享受吧。',
    '🤗 今天没有排班，好好放松。',
    '🤗 意外的惊喜，好好享受。',
    '🤗 今天是你的自由日。',
    '🤗 没有排班的一天，好好休息。',
    '🤗 享受意外的闲暇时光。',
    '🤗 今天好好放松一下吧。',
    '🤗 意外的休息，好好珍惜。'
  ],
  defaultNoName: [
    '☀️ 今天也要开心哦。',
    '☀️ 新的一天，新的开始。',
    '☀️ 今天天气不错，心情也要好。',
    '☀️ 愿你今天一切顺利。',
    '☀️ 新的一天，加油。',
    '☀️ 今天也要元气满满。',
    '☀️ 愿你今天有个好心情。',
    '☀️ 美好的一天开始了。'
  ]
};

/**
 * 生成随机称呼
 * @param {string} nickname 昵称
 * @returns {string} 随机称呼
 */
function getRandomNickname(nickname) {
  if (!nickname || !nickname.trim()) {
    return '';
  }
  
  const trimmedNickname = nickname.trim();
  const options = [
    `亲爱的${trimmedNickname}`,
    `${trimmedNickname.charAt(trimmedNickname.length - 1)}宝`,
    `${trimmedNickname}宝贝`
  ];
  
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
}

/**
 * 从话语库中随机选择一条消息
 * @param {string} status 状态
 * @param {string} nickname 昵称
 * @param {string} timePeriod 时段
 * @returns {string} 消息
 */
function getRandomMessage(status, nickname, timePeriod) {
  let templateKey = status;
  
  // 处理“下夜班休息”根据时段选择不同的模板
  if (status === 'restAfterNightShift') {
    if (timePeriod === '凌晨' || timePeriod === '清晨' || timePeriod === '上午') {
      templateKey = 'restAfterNightShiftMorning';
    } else {
      templateKey = 'restAfterNightShiftAfternoon';
    }
  }
  
  // 如果有昵称，使用带昵称的模板
  let templates;
  if (nickname && nickname.trim()) {
    templates = messageTemplates[templateKey];
  } else {
    templates = messageTemplates[templateKey + 'NoName'] || messageTemplates[templateKey];
  }
  
  // 如果找不到对应模板，使用默认模板
  if (!templates || templates.length === 0) {
    templates = nickname ? messageTemplates.default : messageTemplates.defaultNoName;
  }
  
  // 随机选择一条
  const randomIndex = Math.floor(Math.random() * templates.length);
  let message = templates[randomIndex];
  
  // 替换昵称占位符（使用随机称呼）
  if (nickname && nickname.trim()) {
    const randomNickname = getRandomNickname(nickname);
    message = message.replace('{name}', randomNickname);
  }
  
  return message;
}

/**
 * 根据表情获取状态
 * @param {string} emoji 表情
 * @returns {string|null} 状态
 */
function getEmotionStateByEmoji(emoji) {
  if (!emoji) return null;
  return emojiStateMap[emoji] || null;
}

/**
 * 根据表情获取专属消息
 * @param {string} emoji 表情
 * @param {string} nickname 昵称
 * @returns {string|null} 消息
 */
function getMessageByEmoji(emoji, nickname) {
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

/**
 * 获取今日心语
 * @param {string} nickname 昵称
 * @param {Object} scheduleData 排班数据
 * @param {string} [emoji] 表情头像（可选）
 * @param {Date} [now] 当前时间（可选，用于测试）
 * @returns {string} 今日心语
 */
function getDailyMessage(nickname, scheduleData, emoji, now) {
  // 优先使用表情专属消息
  if (emoji) {
    const emojiMessage = getMessageByEmoji(emoji, nickname);
    if (emojiMessage) {
      return emojiMessage;
    }
  }
  
  // 否则使用排班状态消息
  const currentNow = now || new Date();
  const statusResult = determineStatus(scheduleData, currentNow);
  return getRandomMessage(statusResult.status, nickname, statusResult.timePeriod);
}

module.exports = {
  getDailyMessage,
  formatDate,
  toAbsolute,
  isWorkingType,
  isNightShift,
  determineStatus,
  getRandomNickname
};
