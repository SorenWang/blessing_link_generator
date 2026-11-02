import { OCCASIONS, formatChineseDate } from '/modules/content.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const params = new URLSearchParams(window.location.search);
const preview = params.get('preview') === '1';
const token = window.location.pathname.split('/').filter(Boolean).pop();

const loader = $('#page-loader');
const errorScreen = $('#error-screen');
const app = $('#blessing-app');
const cover = $('#cover');

function setError(title, message) {
  loader?.classList.add('is-done');
  if (app) app.hidden = true;
  if (cover) cover.hidden = true;
  $('#error-title').textContent = title || '这封信暂时找不到';
  $('#error-message').textContent = message || '请向发送者确认链接是否完整。';
  errorScreen.hidden = false;
  document.body.classList.remove('is-locked');
  document.title = `${title || '信件不存在'} · Blessing Link`;
}

function appendParagraphs(container, text) {
  const parts = String(text || '').split(/\n+/).map((part) => part.trim()).filter(Boolean);
  parts.forEach((part, index) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = part;
    paragraph.style.setProperty('--paragraph-index', index);
    container.append(paragraph);
  });
}

function buildPetals() {
  const field = $('#petal-field');
  for (let index = 0; index < 11; index += 1) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.left = `${4 + Math.random() * 92}%`;
    petal.style.setProperty('--duration', `${9 + Math.random() * 13}s`);
    petal.style.setProperty('--delay', `${-Math.random() * 18}s`);
    petal.style.setProperty('--drift', `${-70 + Math.random() * 140}px`);
    petal.style.setProperty('--angle', `${Math.random() * 180}deg`);
    field.append(petal);
  }
}

function buildGallery(photos) {
  const grid = $('#gallery-grid');
  photos.forEach((photo) => {
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = photo.caption || '一段被珍藏的记忆';
    image.loading = 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    caption.textContent = photo.caption || '';
    figure.append(image);
    if (photo.caption) figure.append(caption);
    grid.append(figure);
  });
  $('#gallery-count').textContent = `${String(photos.length).padStart(2, '0')} MOMENTS`;
}

function buildTimeline(milestones) {
  const timeline = $('#timeline');
  milestones.forEach((milestone) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const date = document.createElement('span');
    date.className = 'timeline-date';
    date.textContent = milestone.date || '—';
    const line = document.createElement('span');
    line.className = 'timeline-line';
    const dot = document.createElement('i');
    dot.className = 'timeline-dot';
    line.append(dot);
    const copy = document.createElement('div');
    copy.className = 'timeline-copy';
    const title = document.createElement('strong');
    title.textContent = milestone.title || '一段记忆';
    const text = document.createElement('p');
    text.textContent = milestone.text || '';
    copy.append(title);
    if (milestone.text) copy.append(text);
    item.append(date, line, copy);
    timeline.append(item);
  });
}

function setupAudio(audioUrl) {
  const audio = $('#page-audio');
  const toggle = $('#audio-toggle');
  const playIcon = $('#audio-play-icon');
  const progress = $('#audio-progress');
  audio.src = audioUrl;

  const syncState = (playing) => {
    toggle.classList.toggle('is-playing', playing);
    playIcon.textContent = playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', playing ? '暂停声音' : '播放声音');
  };

  toggle.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        await audio.play();
        syncState(true);
      } catch {
        toggle.querySelector('.audio-copy span').textContent = '音频暂时无法播放';
      }
    } else {
      audio.pause();
      syncState(false);
    }
  });

  audio.addEventListener('pause', () => syncState(false));
  audio.addEventListener('play', () => syncState(true));
  audio.addEventListener('ended', () => {
    syncState(false);
    progress.style.transform = 'scaleX(0)';
  });
  audio.addEventListener('timeupdate', () => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    progress.style.transform = `scaleX(${audio.currentTime / audio.duration})`;
  });
}

function setupReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
  items.forEach((item) => observer.observe(item));
}

function openLetter() {
  document.body.classList.remove('is-locked');
  document.body.classList.add('has-opened');
  cover.classList.add('has-opened');
  document.querySelector("#letter").removeAttribute("aria-hidden");
  window.scrollTo({ top: 0, behavior: 'instant' });
  window.setTimeout(() => {
    cover.hidden = true;
  }, 1100);
}

async function copyLink() {
  const url = `${window.location.origin}${window.location.pathname}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = url;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  const button = $('#copy-letter');
  const previous = button.textContent;
  button.textContent = '链接已复制';
  window.setTimeout(() => {
    button.textContent = previous;
  }, 1800);
}

function renderPage(page) {
  document.body.dataset.theme = page.theme || 'ivory';
  document.title = `${page.recipient} · ${page.title}`;
  $('#cover-english').textContent = OCCASIONS[page.occasion]?.english || 'A LETTER FOR YOU';
  $('#cover-name').textContent = page.recipient;
  $('#cover-occasion').textContent = `为 ${page.recipient} 留下的${page.occasionLabel || '祝福'}`;
  $('#cover-title').textContent = page.title;
  $('#cover-sender').textContent = page.sender || '一位记挂你的人';
  const displayDate = formatChineseDate(page.eventDate) || formatChineseDate(page.publishedAt?.slice(0, 10));
  $('#cover-date').textContent = displayDate || '';
  $('#cover-year').textContent = page.publishedAt ? page.publishedAt.slice(0, 4) : String(new Date().getFullYear());
  $('#letter-label').textContent = OCCASIONS[page.occasion]?.english || 'A NOTE FOR YOU';
  $('#letter-index').textContent = page.publishedAt ? page.publishedAt.slice(2, 4) : '26';
  $('#recipient-line').textContent = `${page.recipient}：`;
  $('#letter-lead').textContent = '见字如面。想把一些话，在今天说给你听。';
  $('#closing-text').textContent = page.closing || '愿你所愿，皆有回响。';
  $('#sender-name').textContent = page.sender || '一位记挂你的人';
  $('#footer-date').textContent = displayDate || '';

  appendParagraphs($('#message-body'), page.message);

  $('.message-section', document).hidden = !page.components?.message;
  if (page.gallery?.length && page.components?.gallery) {
    buildGallery(page.gallery);
    $('#gallery-section').hidden = false;
  }
  if (page.milestones?.length && page.components?.timeline) {
    buildTimeline(page.milestones);
    $('#timeline-section').hidden = false;
  }
  if (page.audioUrl && page.components?.audio) {
    setupAudio(page.audioUrl);
    $('#audio-section').hidden = false;
  }
  if (page.components?.closing === false) {
    $('#closing-section').hidden = true;
  }

  const themeColor = getComputedStyle(document.body).getPropertyValue('--theme-color').trim();
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme && themeColor) metaTheme.content = themeColor;

  buildPetals();
  if (preview) $('#preview-ribbon').hidden = false;
  app.hidden = false;
  loader.classList.add('is-done');
  setupReveal();

  if (!preview && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    openLetter();
  }
}

async function init() {
  if (!token) {
    setError('链接不完整', '请向发送者确认链接是否完整。');
    return;
  }
  try {
    const response = await fetch(`/api/public/pages/${encodeURIComponent(token)}${preview ? '?preview=1' : ''}`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || '这封信暂时找不到', '请向发送者确认链接是否完整，或稍后再试。');
      return;
    }
    renderPage(data.page);
  } catch {
    setError('网络似乎走远了', '请检查网络连接后刷新页面。');
  }
}

$('#open-letter').addEventListener('click', openLetter);
$('#copy-letter').addEventListener('click', copyLink);
init();



