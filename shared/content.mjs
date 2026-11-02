export const OCCASIONS = {
  birthday: {
    label: '生日',
    english: 'BIRTHDAY',
    accent: '把新一岁写成花',
    defaultTitle: (name) => `致 ${name} 的一封生日来信`,
    defaultMessage: (name) => `${name}，\n愿新的一岁，仍有热爱可以奔赴，有星光值得等候。\n愿你被岁月温柔相待，也始终拥有把日子过成诗的能力。`,
    defaultClosing: '愿你岁岁常欢愉，年年皆胜意。'
  },
  anniversary: {
    label: '纪念日',
    english: 'ANNIVERSARY',
    accent: '把一起走过的日子珍藏',
    defaultTitle: (name) => `写给 ${name} 的纪念日`,
    defaultMessage: (name) => `${name}，\n有些日子因为被记得，便有了光。\n谢谢我们一起走过的每一段路，也期待下一程仍有你在身旁。`,
    defaultClosing: '愿往后的每个寻常日子，都值得纪念。'
  },
  festival: {
    label: '节日',
    english: 'FESTIVAL',
    accent: '在节令里寄一份心意',
    defaultTitle: (name) => `寄给 ${name} 的节日心意`,
    defaultMessage: (name) => `${name}，\n灯火可亲，四季流转。\n愿此刻的欢喜抵达你身边，也愿所有平凡的日常，都有一盏灯为你而亮。`,
    defaultClosing: '顺问冬安，喜乐常伴。'
  },
  graduation: {
    label: '毕业',
    english: 'GRADUATION',
    accent: '去更辽阔的地方',
    defaultTitle: (name) => `祝 ${name} 毕业快乐`,
    defaultMessage: (name) => `${name}，\n这一程已经抵达，下一程正在展开。\n愿你带着在这里积攒的勇气与热爱，去更辽阔的地方，见更明亮的自己。`,
    defaultClosing: '前程似锦，山高水长。'
  },
  wedding: {
    label: '婚礼',
    english: 'WEDDING',
    accent: '愿爱有回响，日子有光',
    defaultTitle: (name) => `写给 ${name} 的新婚祝福`,
    defaultMessage: (name) => `${name}，\n愿你们在漫长岁月里，始终是彼此最坚定的同路人。\n愿一屋两人，三餐四季，欢喜有分享，风雨共担当。`,
    defaultClosing: '新婚快乐，长长久久。'
  },
  newborn: {
    label: '新生',
    english: 'NEW LIFE',
    accent: '欢迎来到这个世界',
    defaultTitle: (name) => `写给小宝贝 ${name}`,
    defaultMessage: (name) => `${name}，\n欢迎来到这个明亮又辽阔的世界。\n愿你被爱包围，慢慢长大；愿你眼里有光，心里有糖。`,
    defaultClosing: '平安喜乐，一生明朗。'
  },
  gratitude: {
    label: '感谢',
    english: 'GRATITUDE',
    accent: '认真说一声谢谢',
    defaultTitle: (name) => `写给 ${name} 的感谢`,
    defaultMessage: (name) => `${name}，\n有些感谢，想说得很认真。\n谢谢你在那些平常或不平常的日子里，给予我的善意、耐心与陪伴。`,
    defaultClosing: '谢谢你，出现在我的生命里。'
  },
  encouragement: {
    label: '鼓励',
    english: 'ENCOURAGEMENT',
    accent: '愿你仍有向上的力量',
    defaultTitle: (name) => `给 ${name} 的一点力量`,
    defaultMessage: (name) => `${name}，\n如果此刻有些辛苦，就先允许自己慢一点。\n路会继续向前，光也会如约而来。你远比想象中更有力量。`,
    defaultClosing: '慢慢来，一切都会好起来。'
  },
  custom: {
    label: '其他',
    english: 'A NOTE FOR YOU',
    accent: '把想说的话认真寄出',
    defaultTitle: (name) => `写给 ${name} 的一封信`,
    defaultMessage: (name) => `${name}，\n有些话，想以一种特别的方式说给你听。\n愿这封小小的信，能在今天抵达你的心里。`,
    defaultClosing: '愿你所愿，皆有回响。'
  }
};

export const THEMES = {
  ivory: {
    label: '绢光信笺',
    description: '米白纸感 · 酒红印章 · 宋体排版',
    mood: '温柔、克制、像一封真正寄出的信',
    swatches: ['#f4eee2', '#8f3f35', '#b58b4c'],
    background: '/assets/backgrounds/ivory-paper.svg'
  },
  night: {
    label: '星夜鎏金',
    description: '深海蓝 · 细碎星光 · 金色留白',
    mood: '静谧、隆重、适合被认真记住的夜晚',
    swatches: ['#0d2029', '#d5b46b', '#f3e5c7'],
    background: '/assets/backgrounds/night-sky.svg'
  },
  celadon: {
    label: '青岚山色',
    description: '青瓷绿 · 墨色线条 · 松弛呼吸',
    mood: '清雅、自然、有一点山间雾气',
    swatches: ['#dfe7dd', '#355348', '#a9c0af'],
    background: '/assets/backgrounds/celadon-mist.svg'
  },
  rose: {
    label: '绯页心事',
    description: '旧玫瑰 · 酒红字迹 · 柔软心事',
    mood: '浪漫、私密、适合说给特别的人',
    swatches: ['#f0ded8', '#8d3a43', '#c9888d'],
    background: '/assets/backgrounds/rose-paper.svg'
  },
  amber: {
    label: '午后琥珀',
    description: '暖金日光 · 胶片颗粒 · 松弛暖意',
    mood: '明亮、怀旧、像一场洒满阳光的午后',
    swatches: ['#f3e5c5', '#9a5b2e', '#d2a661'],
    background: '/assets/backgrounds/amber-glow.svg'
  }
};

export const DEFAULT_COMPONENTS = {
  intro: true,
  message: true,
  gallery: true,
  timeline: false,
  audio: false,
  closing: true
};

export const PAGE_STATUSES = ['draft', 'published'];

export function cleanText(value, max = 3000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

export function safeUrl(value) {
  const text = cleanText(value, 1200);
  if (!text) return '';
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeGallery(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (typeof item === 'string') {
        return { url: safeUrl(item), caption: `记忆 ${index + 1}` };
      }
      return {
        url: safeUrl(item?.url),
        caption: cleanText(item?.caption, 120) || `记忆 ${index + 1}`
      };
    })
    .filter((item) => item.url)
    .slice(0, 24);
}

export function normalizeMilestones(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      date: cleanText(item?.date, 40),
      title: cleanText(item?.title, 80),
      text: cleanText(item?.text, 500)
    }))
    .filter((item) => item.title || item.text)
    .slice(0, 12);
}

export function normalizeComponents(input = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_COMPONENTS).map((key) => [
      key,
      input?.[key] === undefined ? DEFAULT_COMPONENTS[key] : Boolean(input[key])
    ])
  );
}

export function normalizePage(input = {}, previous = {}) {
  const recipient = cleanText(input.recipient ?? previous.recipient, 60) || '亲爱的你';
  const sender = cleanText(input.sender ?? previous.sender, 60);
  const occasionKey = Object.hasOwn(OCCASIONS, input.occasion) ? input.occasion : previous.occasion;
  const occasion = Object.hasOwn(OCCASIONS, occasionKey) ? occasionKey : 'custom';
  const themeKey = Object.hasOwn(THEMES, input.theme) ? input.theme : previous.theme;
  const theme = Object.hasOwn(THEMES, themeKey) ? themeKey : 'ivory';
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate ?? previous.eventDate ?? '')
    ? (input.eventDate ?? previous.eventDate)
    : '';

  return {
    recipient,
    sender,
    occasion,
    theme,
    title: cleanText(input.title ?? previous.title, 100) || OCCASIONS[occasion].defaultTitle(recipient),
    message: cleanText(input.message ?? previous.message, 4000) || OCCASIONS[occasion].defaultMessage(recipient),
    closing: cleanText(input.closing ?? previous.closing, 300) || OCCASIONS[occasion].defaultClosing,
    eventDate,
    gallery: normalizeGallery(input.gallery ?? previous.gallery),
    milestones: normalizeMilestones(input.milestones ?? previous.milestones),
    audioUrl: safeUrl(input.audioUrl ?? previous.audioUrl),
    components: normalizeComponents(input.components ?? previous.components),
    expiresAt: input.expiresAt === null || input.expiresAt === '' ? '' : cleanText(input.expiresAt ?? previous.expiresAt, 30),
    status: input.status === 'published' ? 'published' : previous.status === 'published' && input.status === undefined ? 'published' : 'draft'
  };
}

export function toPublicPage(page) {
  return {
    token: page.token,
    recipient: page.recipient,
    sender: page.sender,
    occasion: page.occasion,
    occasionLabel: OCCASIONS[page.occasion]?.label || OCCASIONS.custom.label,
    theme: page.theme,
    title: page.title,
    message: page.message,
    closing: page.closing,
    eventDate: page.eventDate,
    gallery: page.gallery,
    milestones: page.milestones,
    audioUrl: page.audioUrl,
    components: page.components,
    publishedAt: page.publishedAt || ''
  };
}

export function formatChineseDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

