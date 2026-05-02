// @ts-nocheck
'use strict';

/**
 * 今日心语模块
 * 根据排班状态和当前时间，生成个性化关怀话语
 */

// 表情状态映射（所有类别）
const emojiStateMap: Record<string, string> = {
  // ============== 表情类 ==============
  // 疲惫/累状态
  '😩': 'tired', '😫': 'tired', '😴': 'tired', '😪': 'tired', '🥴': 'tired', '😵': 'tired', '🤯': 'tired',

  // 难过/悲伤状态
  '😔': 'sad', '😞': 'sad', '🙁': 'sad', '☹️': 'sad', '😢': 'sad', '😭': 'sad', '😟': 'sad', '😕': 'sad',
  '😶': 'sad', '😑': 'sad', '😬': 'sad', '🙄': 'sad',

  // 压力/焦虑状态
  '😰': 'stressed', '😣': 'stressed', '😖': 'stressed', '😨': 'stressed', '😱': 'stressed',
  '😓': 'stressed', '😧': 'stressed', '😦': 'stressed', '😮': 'stressed',
  '😯': 'stressed', '😲': 'stressed',

  // 愤怒/生气状态
  '😤': 'angry', '😠': 'angry', '😡': 'angry', '🤬': 'angry',

  // 生病状态
  '🤒': 'sick', '🤕': 'sick', '🤢': 'sick', '🤮': 'sick', '🤧': 'sick', '😷': 'sick',
  '🥵': 'sick', '🥶': 'sick',

  // 开心/积极状态
  '😊': 'happy', '😃': 'happy', '😄': 'happy', '😁': 'happy', '😆': 'happy', '🤣': 'happy',
  '😂': 'happy', '😉': 'happy', '😍': 'happy', '🥰': 'happy', '😘': 'happy', '😚': 'happy',
  '😋': 'happy', '😛': 'happy', '😝': 'happy', '😜': 'happy', '🤪': 'happy', '😎': 'happy',
  '🤩': 'happy', '🥳': 'happy', '🤗': 'happy', '🤓': 'happy', '😏': 'happy',
  '🤑': 'happy', '🤤': 'happy', '😅': 'happy', '🙂': 'happy', '🙃': 'happy',
  '😌': 'happy', '🎉': 'happy', '🎊': 'happy', '✨': 'happy',

  // 思考/专注状态
  '🤔': 'thinking', '🧐': 'thinking', '🤨': 'thinking', '🤫': 'thinking', '🤐': 'thinking',

  // ============== 动物类 ==============
  '🐶': 'animal', '🐱': 'animal', '🐭': 'animal', '🐹': 'animal', '🐰': 'animal', '🦊': 'animal',
  '🐻': 'animal', '🐼': 'animal', '🐨': 'animal', '🐯': 'animal', '🦁': 'animal', '🐮': 'animal',
  '🐷': 'animal', '🐸': 'animal', '🐵': 'animal', '🐔': 'animal', '🐧': 'animal', '🐦': 'animal',
  '🐤': 'animal', '🦋': 'animal', '🐝': 'animal', '🐛': 'animal', '🦄': 'animal', '🐙': 'animal',
  '🐠': 'animal', '🐟': 'animal', '🐬': 'animal', '🐳': 'animal', '🐋': 'animal', '🦈': 'animal',
  '🐊': 'animal', '🐢': 'animal', '🐍': 'animal', '🦎': 'animal', '🦖': 'animal', '🦕': 'animal',
  '🐘': 'animal', '🦛': 'animal', '🦏': 'animal', '🐪': 'animal', '🐫': 'animal', '🦒': 'animal',
  '🦘': 'animal', '🐃': 'animal', '🐂': 'animal', '🐄': 'animal', '🐎': 'animal', '🐖': 'animal',
  '🐏': 'animal', '🐑': 'animal', '🐐': 'animal', '🐓': 'animal', '🦃': 'animal', '🦅': 'animal',
  '🦆': 'animal', '🦉': 'animal', '🦤': 'animal', '🪶': 'animal', '🦩': 'animal', '🦚': 'animal',
  '🦜': 'animal', '🐿️': 'animal', '🦔': 'animal', '🐇': 'animal', '🐀': 'animal', '🐁': 'animal',

  // ============== 食物类 ==============
  '🍎': 'food', '🍊': 'food', '🍋': 'food', '🍌': 'food', '🍉': 'food', '🍇': 'food', '🍓': 'food',
  '🫐': 'food', '🍈': 'food', '🍒': 'food', '🍑': 'food', '🥭': 'food', '🍍': 'food', '🥥': 'food',
  '🥝': 'food', '🍅': 'food', '🫒': 'food', '🥑': 'food', '🍆': 'food', '🥔': 'food', '🥕': 'food',
  '🌽': 'food', '🌶️': 'food', '🫑': 'food', '🥒': 'food', '🥬': 'food', '🥦': 'food', '🧄': 'food',
  '🧅': 'food', '🍄': 'food', '🥜': 'food', '🫘': 'food', '🌰': 'food', '🫚': 'food', '🫛': 'food',
  '🍞': 'food', '🥐': 'food', '🥖': 'food', '🫓': 'food', '🥨': 'food', '🥯': 'food', '🥞': 'food',
  '🧇': 'food', '🧀': 'food', '🍖': 'food', '🍗': 'food', '🥩': 'food', '🥓': 'food', '🍔': 'food',
  '🍟': 'food', '🍕': 'food', '🌭': 'food', '🥪': 'food', '🌮': 'food', '🌯': 'food', '🫔': 'food',
  '🥙': 'food', '🧆': 'food', '🥚': 'food', '🍳': 'food', '🥘': 'food', '🍲': 'food', '🫕': 'food',
  '🥣': 'food', '🥗': 'food', '🍿': 'food', '🧈': 'food', '🧂': 'food', '🥫': 'food', '🍱': 'food',
  '🍘': 'food', '🍙': 'food', '🍚': 'food', '🍛': 'food', '🍜': 'food', '🍝': 'food', '🍠': 'food',
  '🍢': 'food', '🍣': 'food', '🍤': 'food', '🍥': 'food', '🦪': 'food', '🍦': 'food', '🍧': 'food',
  '🍨': 'food', '🍩': 'food', '🍪': 'food', '🎂': 'food', '🍰': 'food', '🧁': 'food', '🥧': 'food',
  '🍫': 'food', '🍬': 'food', '🍭': 'food', '🍮': 'food', '🍯': 'food', '🍼': 'food', '🥛': 'food',
  '🫖': 'food', '🍵': 'food', '🍶': 'food', '🍾': 'food', '🍷': 'food', '🍸': 'food', '🍹': 'food',
  '🍺': 'food', '🍻': 'food', '🥂': 'food', '🥃': 'food', '🫗': 'food', '🥤': 'food', '🧋': 'food',
  '🧃': 'food', '🧉': 'food', '🧊': 'food', '🥢': 'food', '🍽️': 'food', '🍴': 'food', '🥄': 'food',
  '🔪': 'food',

  // ============== 活动类 ==============
  '🏃': 'activity', '🚶': 'activity', '🧎': 'activity', '🧍': 'activity', '🏋️': 'activity',
  '🏊': 'activity', '🏄': 'activity', '🚣': 'activity', '🧗': 'activity', '🚵': 'activity',
  '🚴': 'activity', '🏇': 'activity', '⛷️': 'activity', '🎿': 'activity', '🏂': 'activity',
  '🤸': 'activity', '🤽': 'activity', '🤾': 'activity', '🤹': 'activity', '🎪': 'activity',
  '🎭': 'activity', '🎨': 'activity', '🎬': 'activity', '🎤': 'activity', '🎧': 'activity',
  '🎼': 'activity', '🎹': 'activity', '🥁': 'activity', '🎷': 'activity', '🎺': 'activity',
  '🎸': 'activity', '🪕': 'activity', '🎻': 'activity', '🪗': 'activity', '🎯': 'activity',
  '🎱': 'activity', '🎳': 'activity', '🎮': 'activity', '🎰': 'activity', '🎲': 'activity',
  '🧩': 'activity',

  // ============== 旅行类 ==============
  '🚗': 'travel', '🚕': 'travel', '🚙': 'travel', '🚌': 'travel', '🚎': 'travel', '🏎️': 'travel',
  '🚓': 'travel', '🚑': 'travel', '🚒': 'travel', '🚐': 'travel', '🚚': 'travel', '🚛': 'travel',
  '🚜': 'travel', '🛵': 'travel', '🏍️': 'travel', '🛺': 'travel', '🚲': 'travel', '🛴': 'travel',
  '🚀': 'travel', '🛸': 'travel', '🚁': 'travel', '🛩️': 'travel', '✈️': 'travel', '🛫': 'travel',
  '🛬': 'travel', '🪂': 'travel', '🚤': 'travel', '🛳️': 'travel', '⛴️': 'travel', '🚢': 'travel',
  '⛰️': 'travel', '🌋': 'travel', '🏔️': 'travel', '🗻': 'travel', '🏕️': 'travel', '🏖️': 'travel',
  '🏜️': 'travel', '🏝️': 'travel', '🏞️': 'travel', '🎡': 'travel', '🎢': 'travel', '🎠': 'travel',
  '🎃': 'travel', '🎄': 'travel', '🎆': 'travel', '🎇': 'travel', '🧨': 'travel', '🎈': 'travel',
  '🎋': 'travel', '🎍': 'travel', '🎎': 'travel', '🎏': 'travel', '🎐': 'travel', '🎑': 'travel',
  '🧧': 'travel', '🎀': 'travel', '🎁': 'travel', '🤶': 'travel', '🎅': 'travel', '🦌': 'travel',
  '⛄': 'travel', '🔥': 'travel', '❄️': 'travel', '☃️': 'travel', '🌨️': 'travel', '🌧️': 'travel',
  '🌦️': 'travel', '🌥️': 'travel', '☁️': 'travel', '🌤️': 'travel', '☀️': 'travel', '🌝': 'travel',
  '🌞': 'travel', '🪐': 'travel', '🌟': 'travel', '⭐': 'travel', '⚡': 'travel', '☄️': 'travel',
  '💫': 'travel', '🌙': 'travel', '🌚': 'travel', '🌛': 'travel', '🌜': 'travel', '🌔': 'travel',
  '🌓': 'travel', '🌒': 'travel', '🌑': 'travel', '🌘': 'travel', '🌗': 'travel', '🌖': 'travel',
  '🌕': 'travel', '🌪️': 'travel', '🌫️': 'travel', '🌬️': 'travel', '🌀': 'travel', '🌈': 'travel',
  '🌂': 'travel', '☂️': 'travel', '🌊': 'travel', '💧': 'travel', '💦': 'travel', '☔': 'travel',

  // ============== 物品类 ==============
  '🏵️': 'object', '🎗️': 'object', '🎟️': 'object', '🎫': 'object', '🎖️': 'object', '🏆': 'object',
  '🏅': 'object', '🥇': 'object', '🥈': 'object', '🥉': 'object', '⚽': 'object', '⚾': 'object',
  '🥎': 'object', '🏀': 'object', '🏐': 'object', '🏈': 'object', '🏉': 'object', '🎾': 'object',
  '🥏': 'object', '🏏': 'object', '🏑': 'object', '🏒': 'object', '🥍': 'object',
  '🏓': 'object', '🏸': 'object', '🥊': 'object', '🥋': 'object', '🥅': 'object', '🎣': 'object',
  '🎽': 'object', '🛷': 'object', '🔮': 'object', '🎵': 'object', '🎶': 'object'
};

// 表情专属话语库（所有类别）
const emojiMessageTemplates = {
  // ============== 情绪类 ==============
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
  ],
  thinking: [
    '🤔 {name}，在思考什么呀？',
    '💭 {name}，专注的样子真棒！',
    '🧠 {name}，你的想法一定很棒！',
    '📚 {name}，学习使人进步！',
    '💡 {name}，灵感马上就来啦！',
    '🔍 {name}，保持好奇心！',
    '🎯 {name}，想清楚了再行动！',
    '✨ {name}，你会找到答案的！'
  ],

  // ============== 动物类 ==============
  animal: [
    '🐾 {name}，可爱的动物们真治愈！',
    '🐱 {name}，猫猫狗狗太可爱啦！',
    '🐼 {name}，你像熊猫一样可爱！',
    '🦊 {name}，聪明又可爱！',
    '🐰 {name}，蹦蹦跳跳真可爱！',
    '🐬 {name}，每天都开心！',
    '🦄 {name}，充满魔法的一天！',
    '🦁 {name}，今天也要元气满满！'
  ],

  // ============== 食物类 ==============
  food: [
    '🍔 {name}，今天也要好好吃饭哦！',
    '🍕 {name}，美食让生活更美好！',
    '🍰 {name}，给自己来点甜蜜吧！',
    '🍜 {name}，热乎的食物最温暖了！',
    '🍎 {name}，多吃水果身体棒！',
    '☕ {name}，来杯咖啡提提神！',
    '🍫 {name}，巧克力让心情变好！',
    '🍹 {name}，享受美食享受生活！'
  ],

  // ============== 活动类 ==============
  activity: [
    '🏃 {name}，生命在于运动！',
    '🎨 {name}，享受艺术的美好！',
    '🎵 {name}，音乐让心情更美好！',
    '🎮 {name}，游戏时光最放松！',
    '📚 {name}，阅读使人成长！',
    '🎯 {name}，专注做自己喜欢的事！',
    '🎭 {name}，生活就是一场表演！',
    '✨ {name}，做自己喜欢的事最开心！'
  ],

  // ============== 旅行类 ==============
  travel: [
    '✈️ {name}，期待一场美好的旅行！',
    '🚗 {name}，去看看外面的世界吧！',
    '🏖️ {name}，阳光沙滩海浪！',
    '⛰️ {name}，爬山望远心情好！',
    '🌈 {name}，旅途中总有惊喜！',
    '🌟 {name}，去探索未知的美好！',
    '🚂 {name}，火车旅行真浪漫！',
    '🎡 {name}，享受生活的美好！'
  ],

  // ============== 物品类 ==============
  object: [
    '🏆 {name}，你是最棒的！',
    '🎮 {name}，游戏愉快！',
    '🎵 {name}，听歌放松一下！',
    '📚 {name}，好好学习天天向上！',
    '🎨 {name}，发挥你的创造力！',
    '🎯 {name}，目标明确加油干！',
    '✨ {name}，让每一天都闪闪发光！',
    '💫 {name}，美好的事物就在身边！'
  ]
};

// 表情专属无昵称话语库（所有类别）
const emojiMessageTemplatesNoName = {
  // ============== 情绪类 ==============
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
  ],
  thinking: [
    '🤔 在思考什么呀？',
    '💭 专注的样子真棒！',
    '🧠 你的想法一定很棒！',
    '📚 学习使人进步！',
    '💡 灵感马上就来啦！',
    '🔍 保持好奇心！',
    '🎯 想清楚了再行动！',
    '✨ 你会找到答案的！'
  ],

  // ============== 动物类 ==============
  animal: [
    '🐾 可爱的动物们真治愈！',
    '🐱 猫猫狗狗太可爱啦！',
    '🐼 你像熊猫一样可爱！',
    '🦊 聪明又可爱！',
    '🐰 蹦蹦跳跳真可爱！',
    '🐬 每天都开心！',
    '🦄 充满魔法的一天！',
    '🦁 今天也要元气满满！'
  ],

  // ============== 食物类 ==============
  food: [
    '🍔 今天也要好好吃饭哦！',
    '🍕 美食让生活更美好！',
    '🍰 给自己来点甜蜜吧！',
    '🍜 热乎的食物最温暖了！',
    '🍎 多吃水果身体棒！',
    '☕ 来杯咖啡提提神！',
    '🍫 巧克力让心情变好！',
    '🍹 享受美食享受生活！'
  ],

  // ============== 活动类 ==============
  activity: [
    '🏃 生命在于运动！',
    '🎨 享受艺术的美好！',
    '🎵 音乐让心情更美好！',
    '🎮 游戏时光最放松！',
    '📚 阅读使人成长！',
    '🎯 专注做自己喜欢的事！',
    '🎭 生活就是一场表演！',
    '✨ 做自己喜欢的事最开心！'
  ],

  // ============== 旅行类 ==============
  travel: [
    '✈️ 期待一场美好的旅行！',
    '🚗 去看看外面的世界吧！',
    '🏖️ 阳光沙滩海浪！',
    '⛰️ 爬山望远心情好！',
    '🌈 旅途中总有惊喜！',
    '🌟 去探索未知的美好！',
    '🚂 火车旅行真浪漫！',
    '🎡 享受生活的美好！'
  ],

  // ============== 物品类 ==============
  object: [
    '🏆 你是最棒的！',
    '🎮 游戏愉快！',
    '🎵 听歌放松一下！',
    '📚 好好学习天天向上！',
    '🎨 发挥你的创造力！',
    '🎯 目标明确加油干！',
    '✨ 让每一天都闪闪发光！',
    '💫 美好的事物就在身边！'
  ]
};

// ============== 表情+班次混合状态话语库 ==============
const emojiScheduleMixedTemplates = {
  // 疲惫时上班
  'tired-working': [
    '💪 {name}，虽然累但也要加油工作！',
    '☕ {name}，忙里偷闲喝杯茶休息下。',
    '😌 {name}，今天工作辛苦啦！',
    '💫 {name}，再坚持一下就下班了！',
    '✨ {name}，你是最棒的！',
    '🌸 {name}，劳逸结合最重要。',
    '🌟 {name}，加油！胜利在望！',
    '💪 {name}，你可以的！'
  ],
  'tired-workingNoName': [
    '💪 虽然累但也要加油工作！',
    '☕ 忙里偷闲喝杯茶休息下。',
    '😌 今天工作辛苦啦！',
    '💫 再坚持一下就下班了！',
    '✨ 你是最棒的！',
    '🌸 劳逸结合最重要。',
    '🌟 加油！胜利在望！',
    '💪 你可以的！'
  ],

  // 疲惫时休息
  'tired-rest': [
    '😴 {name}，累了就好好休息吧！',
    '🛋️ {name}，今天是你的充电日！',
    '☕ {name}，泡杯热茶放松下。',
    '💤 {name}，补个好觉吧！',
    '🌙 {name}，晚安好梦！',
    '✨ {name}，明天会更好！',
    '🌸 {name}，好好休息！',
    '🎈 {name}，享受放松时光！'
  ],
  'tired-restNoName': [
    '😴 累了就好好休息吧！',
    '🛋️ 今天是你的充电日！',
    '☕ 泡杯热茶放松下。',
    '💤 补个好觉吧！',
    '🌙 晚安好梦！',
    '✨ 明天会更好！',
    '🌸 好好休息！',
    '🎈 享受放松时光！'
  ],

  // 开心时上班
  'happy-working': [
    '🎉 {name}，开心的工作状态很棒！',
    '🌟 {name}，开心工作效率更高！',
    '💪 {name}，今天也要加油哦！',
    '✨ {name}，保持好心情！',
    '🌸 {name}，开心工作每一天！',
    '🎈 {name}，你最棒！',
    '🌈 {name}，今天会很顺利！',
    '💫 {name}，享受工作！'
  ],
  'happy-workingNoName': [
    '🎉 开心的工作状态很棒！',
    '🌟 开心工作效率更高！',
    '💪 今天也要加油哦！',
    '✨ 保持好心情！',
    '🌸 开心工作每一天！',
    '🎈 你最棒！',
    '🌈 今天会很顺利！',
    '💫 享受工作！'
  ],

  // 开心时休息
  'happy-rest': [
    '🎉 {name}，开心的休息日！',
    '🎁 {name}，好好享受假期！',
    '🎈 {name}，今天怎么安排呢？',
    '✨ {name}，开心每一天！',
    '🌸 {name}，享受美好时光！',
    '🌟 {name}，做你喜欢的事！',
    '🌈 {name}，享受生活！',
    '💫 {name}，开心就好！'
  ],
  'happy-restNoName': [
    '🎉 开心的休息日！',
    '🎁 好好享受假期！',
    '🎈 今天怎么安排呢？',
    '✨ 开心每一天！',
    '🌸 享受美好时光！',
    '🌟 做你喜欢的事！',
    '🌈 享受生活！',
    '💫 开心就好！'
  ],

  // 压力时上班
  'stressed-working': [
    '🧘 {name}，工作压力大，记得放松！',
    '💪 {name}，深呼吸，慢慢来！',
    '🎵 {name}，听首歌缓解下压力！',
    '☕ {name}，歇一会喝杯茶！',
    '💫 {name}，你很棒，别着急！',
    '✨ {name}，加油，你可以的！',
    '🌸 {name}，一步一步来！',
    '🌟 {name}，相信自己！'
  ],
  'stressed-workingNoName': [
    '🧘 工作压力大，记得放松！',
    '💪 深呼吸，慢慢来！',
    '🎵 听首歌缓解下压力！',
    '☕ 歇一会喝杯茶！',
    '💫 你很棒，别着急！',
    '✨ 加油，你可以的！',
    '🌸 一步一步来！',
    '🌟 相信自己！'
  ],

  // 压力时休息
  'stressed-rest': [
    '🧘 {name}，休息日好好放松下！',
    '🎈 {name}，出去走走散散心！',
    '🌊 {name}，压力都忘掉吧！',
    '✨ {name}，享受放松时光！',
    '🌸 {name}，别想工作的事！',
    '💫 {name}，今天好好休息！',
    '🎵 {name}，听首歌放松下！',
    '🌈 {name}，明天会更好！'
  ],
  'stressed-restNoName': [
    '🧘 休息日好好放松下！',
    '🎈 出去走走散散心！',
    '🌊 压力都忘掉吧！',
    '✨ 享受放松时光！',
    '🌸 别想工作的事！',
    '💫 今天好好休息！',
    '🎵 听首歌放松下！',
    '🌈 明天会更好！'
  ],

  // 生病时上班
  'sick-working': [
    '💊 {name}，生病了还在工作，辛苦了！',
    '😷 {name}，记得吃药好好休息！',
    '💪 {name}，身体最重要！',
    '☕ {name}，多喝热水！',
    '✨ {name}，快点好起来！',
    '🌸 {name}，注意身体！',
    '❤️ {name}，好好照顾自己！',
    '🌟 {name}，加油！'
  ],
  'sick-workingNoName': [
    '💊 生病了还在工作，辛苦了！',
    '😷 记得吃药好好休息！',
    '💪 身体最重要！',
    '☕ 多喝热水！',
    '✨ 快点好起来！',
    '🌸 注意身体！',
    '❤️ 好好照顾自己！',
    '🌟 加油！'
  ],

  // 生病时休息
  'sick-rest': [
    '💊 {name}，好好养病，早日康复！',
    '😷 {name}，好好休息多喝水！',
    '🛌 {name}，好好睡一觉！',
    '🍜 {name}，吃点热乎的！',
    '❤️ {name}，好好照顾自己！',
    '✨ {name}，快点好起来！',
    '🌸 {name}，早日康复！',
    '🌈 {name}，好好休息！'
  ],
  'sick-restNoName': [
    '💊 好好养病，早日康复！',
    '😷 好好休息多喝水！',
    '🛌 好好睡一觉！',
    '🍜 吃点热乎的！',
    '❤️ 好好照顾自己！',
    '✨ 快点好起来！',
    '🌸 早日康复！',
    '🌈 好好休息！'
  ],

  // 生气时上班
  'angry-working': [
    '😌 {name}，别把坏情绪带到工作中！',
    '💆 {name}，深吸一口气放松下！',
    '🌸 {name}，别气坏身体！',
    '✨ {name}，工作重要，身体更重要！',
    '💫 {name}，消消气！',
    '☕ {name}，喝杯茶冷静下！',
    '🌟 {name}，一切都会好的！',
    '❤️ {name}，别想太多！'
  ],
  'angry-workingNoName': [
    '😌 别把坏情绪带到工作中！',
    '💆 深吸一口气放松下！',
    '🌸 别气坏身体！',
    '✨ 工作重要，身体更重要！',
    '💫 消消气！',
    '☕ 喝杯茶冷静下！',
    '🌟 一切都会好的！',
    '❤️ 别想太多！'
  ],

  // 生气时休息
  'angry-rest': [
    '😌 {name}，休息日别生气！',
    '🎈 {name}，出去走走散散心！',
    '🌸 {name}，别气坏身体！',
    '✨ {name}，开心最重要！',
    '💫 {name}，换个心情！',
    '🎵 {name}，听首歌放松下！',
    '🌟 {name}，享受假期！',
    '❤️ {name}，别想不开心的事！'
  ],
  'angry-restNoName': [
    '😌 休息日别生气！',
    '🎈 出去走走散散心！',
    '🌸 别气坏身体！',
    '✨ 开心最重要！',
    '💫 换个心情！',
    '🎵 听首歌放松下！',
    '🌟 享受假期！',
    '❤️ 别想不开心的事！'
  ],

  // 难过时上班
  'sad-working': [
    '🤗 {name}，上班时也要保持心情哦！',
    '💝 {name}，你不是一个人！',
    '✨ {name}，一切都会好的！',
    '🌸 {name}，加油！',
    '💫 {name}，别难过！',
    '🌈 {name}，雨后会有彩虹！',
    '❤️ {name}，抱抱你！',
    '🌟 {name}，明天会更好！'
  ],
  'sad-workingNoName': [
    '🤗 上班时也要保持心情哦！',
    '💝 你不是一个人！',
    '✨ 一切都会好的！',
    '🌸 加油！',
    '💫 别难过！',
    '🌈 雨后会有彩虹！',
    '❤️ 抱抱你！',
    '🌟 明天会更好！'
  ],

  // 难过时休息
  'sad-rest': [
    '🤗 {name}，好好休息，一切都会好的！',
    '💝 {name}，你不是一个人！',
    '🎁 {name}，给自己一个小奖励！',
    '✨ {name}，明天会更好！',
    '🌸 {name}，别难过！',
    '🌈 {name}，雨后会有彩虹！',
    '💫 {name}，好好放松！',
    '❤️ {name}，抱抱你！'
  ],
  'sad-restNoName': [
    '🤗 好好休息，一切都会好的！',
    '💝 你不是一个人！',
    '🎁 给自己一个小奖励！',
    '✨ 明天会更好！',
    '🌸 别难过！',
    '🌈 雨后会有彩虹！',
    '💫 好好放松！',
    '❤️ 抱抱你！'
  ],

  // 思考时上班
  'thinking-working': [
    '🤔 {name}，工作中思考是好事！',
    '💡 {name}，灵感马上来！',
    '✨ {name}，专注工作！',
    '💪 {name}，加油！',
    '🌟 {name}，你会找到答案的！',
    '🎯 {name}，目标明确！',
    '🌸 {name}，工作顺利！',
    '💫 {name}，你最棒！'
  ],
  'thinking-workingNoName': [
    '🤔 工作中思考是好事！',
    '💡 灵感马上来！',
    '✨ 专注工作！',
    '💪 加油！',
    '🌟 你会找到答案的！',
    '🎯 目标明确！',
    '🌸 工作顺利！',
    '💫 你最棒！'
  ],

  // 思考时休息
  'thinking-rest': [
    '🤔 {name}，休息时可以想想喜欢的事！',
    '📚 {name}，学习使人进步！',
    '💡 {name}，灵感随时来！',
    '✨ {name}，享受思考时光！',
    '🌟 {name}，想好了就行动！',
    '🎯 {name}，有什么计划呢？',
    '🌸 {name}，享受假期！',
    '💫 {name}，思考人生！'
  ],
  'thinking-restNoName': [
    '🤔 休息时可以想想喜欢的事！',
    '📚 学习使人进步！',
    '💡 灵感随时来！',
    '✨ 享受思考时光！',
    '🌟 想好了就行动！',
    '🎯 有什么计划呢？',
    '🌸 享受假期！',
    '💫 思考人生！'
  ],

  // 动物+上班
  'animal-working': [
    '🐾 {name}，像小动物一样活力满满工作！',
    '🦁 {name}，像狮子一样有干劲！',
    '🐱 {name}，工作加油！',
    '✨ {name}，你最棒！',
    '🌟 {name}，元气满满！',
    '💪 {name}，加油干！',
    '🌸 {name}，工作顺利！',
    '💫 {name}，可爱的一天！'
  ],
  'animal-workingNoName': [
    '🐾 像小动物一样活力满满工作！',
    '🦁 像狮子一样有干劲！',
    '🐱 工作加油！',
    '✨ 你最棒！',
    '🌟 元气满满！',
    '💪 加油干！',
    '🌸 工作顺利！',
    '💫 可爱的一天！'
  ],

  // 动物+休息
  'animal-rest': [
    '🐾 {name}，像小动物一样好好休息！',
    '🐼 {name}，今天是充电日！',
    '🦄 {name}，魔法假期！',
    '✨ {name}，好好享受！',
    '🌟 {name}，开心每一天！',
    '🐱 {name}，休息日快乐！',
    '🌸 {name}，享受放松！',
    '💫 {name}，可爱的假期！'
  ],
  'animal-restNoName': [
    '🐾 像小动物一样好好休息！',
    '🐼 今天是充电日！',
    '🦄 魔法假期！',
    '✨ 好好享受！',
    '🌟 开心每一天！',
    '🐱 休息日快乐！',
    '🌸 享受放松！',
    '💫 可爱的假期！'
  ],

  // 食物+上班
  'food-working': [
    '🍔 {name}，工作再忙也要好好吃饭！',
    '☕ {name}，来杯咖啡提神！',
    '🍜 {name}，工作辛苦了，吃点好的！',
    '✨ {name}，加油工作！',
    '🌟 {name}，美食让生活更美好！',
    '💪 {name}，加油！',
    '🌸 {name}，工作顺利！',
    '💫 {name}，好好吃饭！'
  ],
  'food-workingNoName': [
    '🍔 工作再忙也要好好吃饭！',
    '☕ 来杯咖啡提神！',
    '🍜 工作辛苦了，吃点好的！',
    '✨ 加油工作！',
    '🌟 美食让生活更美好！',
    '💪 加油！',
    '🌸 工作顺利！',
    '💫 好好吃饭！'
  ],

  // 食物+休息
  'food-rest': [
    '🍔 {name}，休息日要好好享受美食！',
    '🍰 {name}，给自己来点甜蜜！',
    '🍕 {name}，美食假期！',
    '✨ {name}，享受美食！',
    '🌟 {name}，开心每一天！',
    '☕ {name}，喝杯茶放松下！',
    '🌸 {name}，享受假期！',
    '💫 {name}，美食让生活更美好！'
  ],
  'food-restNoName': [
    '🍔 休息日要好好享受美食！',
    '🍰 给自己来点甜蜜！',
    '🍕 美食假期！',
    '✨ 享受美食！',
    '🌟 开心每一天！',
    '☕ 喝杯茶放松下！',
    '🌸 享受假期！',
    '💫 美食让生活更美好！'
  ],

  // 活动+上班
  'activity-working': [
    '🎵 {name}，工作累了听首歌！',
    '💪 {name}，活动筋骨再继续！',
    '🎮 {name}，工作间隙小放松下！',
    '✨ {name}，加油工作！',
    '🌟 {name}，劳逸结合！',
    '🎯 {name}，专注工作！',
    '🌸 {name}，工作顺利！',
    '💫 {name}，工作开心！'
  ],
  'activity-workingNoName': [
    '🎵 工作累了听首歌！',
    '💪 活动筋骨再继续！',
    '🎮 工作间隙小放松下！',
    '✨ 加油工作！',
    '🌟 劳逸结合！',
    '🎯 专注工作！',
    '🌸 工作顺利！',
    '💫 工作开心！'
  ],

  // 活动+休息
  'activity-rest': [
    '🎵 {name}，休息日做你喜欢的事！',
    '🎨 {name}，享受艺术！',
    '🎮 {name}，游戏时光！',
    '✨ {name}，享受假期！',
    '🌟 {name}，做你喜欢的事！',
    '🏃 {name}，生命在于运动！',
    '🌸 {name}，享受生活！',
    '💫 {name}，开心每一天！'
  ],
  'activity-restNoName': [
    '🎵 休息日做你喜欢的事！',
    '🎨 享受艺术！',
    '🎮 游戏时光！',
    '✨ 享受假期！',
    '🌟 做你喜欢的事！',
    '🏃 生命在于运动！',
    '🌸 享受生活！',
    '💫 开心每一天！'
  ],

  // 旅行+上班
  'travel-working': [
    '✈️ {name}，好好工作，期待旅行！',
    '🚗 {name}，工作加油，周末去玩！',
    '🌟 {name}，努力工作，享受生活！',
    '✨ {name}，加油！',
    '🌈 {name}，工作顺利！',
    '🌊 {name}，旅行不远了！',
    '🌸 {name}，加油工作！',
    '💫 {name}，今天也要加油！'
  ],
  'travel-workingNoName': [
    '✈️ 好好工作，期待旅行！',
    '🚗 工作加油，周末去玩！',
    '🌟 努力工作，享受生活！',
    '✨ 加油！',
    '🌈 工作顺利！',
    '🌊 旅行不远了！',
    '🌸 加油工作！',
    '💫 今天也要加油！'
  ],

  // 旅行+休息
  'travel-rest': [
    '✈️ {name}，休息日去旅行吧！',
    '🚗 {name}，享受美好旅程！',
    '🏖️ {name}，享受假期！',
    '✨ {name}，旅途愉快！',
    '🌟 {name}，去探索吧！',
    '🌈 {name}，旅行开心！',
    '🌸 {name}，享受生活！',
    '💫 {name}，假期快乐！'
  ],
  'travel-restNoName': [
    '✈️ 休息日去旅行吧！',
    '🚗 享受美好旅程！',
    '🏖️ 享受假期！',
    '✨ 旅途愉快！',
    '🌟 去探索吧！',
    '🌈 旅行开心！',
    '🌸 享受生活！',
    '💫 假期快乐！'
  ],

  // 物品+上班
  'object-working': [
    '🏆 {name}，你是最棒的，工作加油！',
    '🎮 {name}，工作间隙放松下！',
    '🎵 {name}，工作累了听首歌！',
    '✨ {name}，加油！',
    '🌟 {name}，你最棒！',
    '💪 {name}，努力工作！',
    '🌸 {name}，工作顺利！',
    '💫 {name}，专注工作！'
  ],
  'object-workingNoName': [
    '🏆 你是最棒的，工作加油！',
    '🎮 工作间隙放松下！',
    '🎵 工作累了听首歌！',
    '✨ 加油！',
    '🌟 你最棒！',
    '💪 努力工作！',
    '🌸 工作顺利！',
    '💫 专注工作！'
  ],

  // 物品+休息
  'object-rest': [
    '🏆 {name}，好好休息，你最棒！',
    '🎮 {name}，游戏愉快！',
    '🎵 {name}，听首歌放松下！',
    '✨ {name}，享受假期！',
    '🌟 {name}，好好放松！',
    '🎁 {name}，好好享受！',
    '🌸 {name}，假期快乐！',
    '💫 {name}，开心每一天！'
  ],
  'object-restNoName': [
    '🏆 好好休息，你最棒！',
    '🎮 游戏愉快！',
    '🎵 听首歌放松下！',
    '✨ 享受假期！',
    '🌟 好好放松！',
    '🎁 好好享受！',
    '🌸 假期快乐！',
    '💫 开心每一天！'
  ]
};

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} date 日期对象
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date: Date): string {
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

/**
 * 判断班次类型是否为工作类型
 * @param {string} type 班次类型
 * @returns {boolean} 是否为工作类型
 */
function isWorkingType(type: string): boolean {
  if (!type) {
    return false;
  }
  const nonWorkingTypes = ['休息', '休假', 'SD', '休息日'];
  return !nonWorkingTypes.includes(type.trim());
}

/**
 * 判断班次是否为夜班
 * @param {Object} shift 班次对象
 * @returns {boolean} 是否为夜班
 */
function isNightShift(shift: Record<string, unknown> | null | undefined): boolean {
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
function calculateShiftDuration(shift: Record<string, unknown> | null | undefined): number {
  if (!shift || !shift.date || !shift.startTime || !shift.endTime) {
    return 0;
  }

  const startTime = toAbsolute(shift.date, shift.startTime);
  const endTime = toAbsolute(shift.date, shift.endTime);

  if (!startTime || !endTime) {
    return 0;
  }

  // 处理跨夜班次
  const adjustedEndTime = new Date(endTime);
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
  const recentShifts: Array<Record<string, unknown>> = [];
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
  const yesterdayShift = shifts && shifts[yesterdayStr];

  // 优先级 0.5: 昨天凌晨夜班延续到今天（如排班4号夜班1:30-8:30，实际覆盖5号凌晨1:30-8:30）
  if (!activeShift && yesterdayShift && isNightShift(yesterdayShift)) {
    const ysStartRaw = toAbsolute(yesterdayStr, yesterdayShift.startTime);
    const ysEndRaw = toAbsolute(yesterdayStr, yesterdayShift.endTime);
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

  // 优先级 1: 正在上夜班（凌晨 0-6 点）
  if (activeShift && isNightShift(activeShift) && currentHour >= 0 && currentHour < 6) {
    return {
      status: 'workingNightShiftLate',
      shift: activeShift,
      timePeriod: getTimePeriod(currentHour)
    };
  }

  // 优先级 2: 夜班刚结束（昨天夜班，现在在 0-12 点之间，距离结束不足 2 小时）
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

  // 优先级 5.5: 等待上班（今天有排班但还没到上班时间）
  if (!activeShift && todayHasWork) {
    const todayShift = shifts[todayStr];
    if (todayShift && isWorkingType(todayShift.type)) {
      const shiftStart = toAbsolute(todayStr, todayShift.startTime);
      if (shiftStart && now < shiftStart) {
        const hoursUntilStart = (shiftStart - now) / (1000 * 60 * 60);
        const statusKey = hoursUntilStart <= 3 ? 'waitingForShiftSoon' : 'waitingForShift';
        return {
          status: statusKey,
          shift: todayShift,
          timePeriod: getTimePeriod(currentHour)
        };
      }
    }
  }

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
  waitingForShift: [
    '⏰ {name}，今天有班次，记得准时到岗哦。',
    '⏰ {name}，做好准备，上班时间还没到，先休息一下吧。',
    '☕ {name}，开工前喝杯咖啡，养足精神。',
    '📋 {name}，今天的工作在等着你，准备好了吗？',
    '🌤️ {name}，上班前的时间，做点自己喜欢的事吧。',
    '💪 {name}，蓄势待发，今天好好干！',
    '🎯 {name}，目标明确，等会儿加油！',
    '🌟 {name}，今天的班次已就绪，养精蓄锐吧。'
  ],
  waitingForShiftSoon: [
    '🚀 {name}，马上要上班了，准备好了吗？',
    '💪 {name}，快到点了，打起精神来！',
    '⏰ {name}，马上就要开工了，加油！',
    '☕ {name}，最后喝口水，准备投入工作！',
    '🔥 {name}，倒计时开始，准备战斗！',
    '🎯 {name}，马上就要开始了，调整好状态！',
    '✨ {name}，准备出发，今天又是充实的一天！',
    '💫 {name}，马上到岗，加油加油！'
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
  waitingForShiftNoName: [
    '⏰ 今天有班次，记得准时到岗哦。',
    '⏰ 做好准备，上班时间还没到，先休息一下吧。',
    '☕ 开工前喝杯咖啡，养足精神。',
    '📋 今天的工作在等着你，准备好了吗？',
    '🌤️ 上班前的时间，做点自己喜欢的事吧。',
    '💪 蓄势待发，今天好好干！',
    '🎯 目标明确，等会儿加油！',
    '🌟 今天的班次已就绪，养精蓄锐吧。'
  ],
  waitingForShiftSoonNoName: [
    '🚀 马上要上班了，准备好了吗？',
    '💪 快到点了，打起精神来！',
    '⏰ 马上就要开工了，加油！',
    '☕ 最后喝口水，准备投入工作！',
    '🔥 倒计时开始，准备战斗！',
    '🎯 马上就要开始了，调整好状态！',
    '✨ 准备出发，今天又是充实的一天！',
    '💫 马上到岗，加油加油！'
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

/**
 * 从话语库中随机选择一条消息
 * @param {string} status 状态
 * @param {string} nickname 昵称
 * @param {string} timePeriod 时段
 * @returns {string} 消息
 */
function getRandomMessage(status: string, nickname: string, timePeriod: string): string {
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
function getEmotionStateByEmoji(emoji: string): string | null {
  if (!emoji) return null;
  return emojiStateMap[emoji] || null;
}

/**
 * 根据表情获取专属消息
 * @param {string} emoji 表情
 * @param {string} nickname 昵称
 * @returns {string|null} 消息
 */
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

/**
 * 判断今天是上班还是休息
 * @param {Object} scheduleData 排班数据
 * @param {Date} now 当前时间
 * @returns {string} 'working' | 'rest'
 */
function getTodayStatus(scheduleData: Record<string, unknown> | null | undefined, now: Date): string {
  const todayStr = formatDate(now);
  const todayShift = scheduleData && scheduleData[todayStr];

  if (todayShift && isWorkingType(todayShift.type)) {
    return 'working';
  }
  return 'rest';
}

/**
 * 获取表情+班次混合状态的消息
 * @param {string} emoji 表情
 * @param {string} nickname 昵称
 * @param {string} todayStatus 'working' | 'rest'
 * @returns {string | null}
 */
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

/**
 * 获取今日心语
 * @param {string} nickname 昵称
 * @param {Object} scheduleData 排班数据
 * @param {string} [emoji] 表情头像（可选）
 * @param {Date} [now] 当前时间（可选，用于测试）
 * @returns {string} 今日心语
 */
function getDailyMessage(nickname: string, scheduleData: Record<string, unknown> | null | undefined, emoji?: string, now?: Date): string {
  const currentNow = now || new Date();
  const todayStatus = getTodayStatus(scheduleData, currentNow);

  // 优先使用表情+班次混合状态的消息
  if (emoji) {
    const mixedMessage = getMixedEmojiMessage(emoji, nickname, todayStatus);
    if (mixedMessage) {
      return mixedMessage;
    }

    // 如果没有混合状态的消息，尝试表情专属消息
    const emojiMessage = getMessageByEmoji(emoji, nickname);
    if (emojiMessage) {
      return emojiMessage;
    }
  }

  // 否则使用排班状态消息
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

export {};
