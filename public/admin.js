import { OCCASIONS, THEMES, DEFAULT_COMPONENTS } from '/modules/content.mjs';
import { parseCsvObjects } from '/modules/csv.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  pages: [],
  selected: new Set(),
  editing: null,
  editorDirty: false,
  batchRows: [],
  batchResults: [],
  view: 'library',
  busy: false
};

const icons = {
  edit: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 16-.7 3.7L8 19l10-10-3-3L5 16Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m13.5 7.5 3 3" stroke="currentColor" stroke-width="1.4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="10" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M15.5 8V6.5A1.5 1.5 0 0 0 14 5H6.5A1.5 1.5 0 0 0 5 6.5V15a1.5 1.5 0 0 0 1.5 1.5H8" stroke="currentColor" stroke-width="1.4"/></svg>',
  publish: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 11 16-7-5.5 16-3-6.5L4 11Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m11.5 13.5 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  unpublish: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 7h12v10H6z" stroke="currentColor" stroke-width="1.4"/><path d="M9 12h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 7h14M9 7V5h6v2M7 7l.7 12h8.6L17 7M10 10.5v5M14 10.5v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};

const componentLabels = {
  message: '祝福正文',
  gallery: '照片墙',
  timeline: '时间线',
  audio: '声音',
  closing: '结尾'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', includeTime
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function todayInputValue() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function pageDefault(occasionKey = 'birthday') {
  return {
    recipient: '',
    sender: '',
    occasion: occasionKey,
    theme: 'ivory',
    title: '',
    message: '',
    closing: '',
    eventDate: todayInputValue(),
    gallery: [],
    milestones: [],
    audioUrl: '',
    expiresAt: '',
    components: { ...DEFAULT_COMPONENTS }
  };
}

async function api(path, options = {}) {
  const config = { ...options, headers: { ...(options.headers || {}) } };
  if (options.body && !config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
  const response = await fetch(path, config);
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin();
    throw new Error('登录已失效，请重新登录');
  }
  if (!response.ok) throw new Error(data.error || '操作失败');
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('is-error', isError);
  element.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('is-visible'), 2800);
}

async function copyText(text, successMessage = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  toast(successMessage);
}

function setLoginVisible(visible) {
  $('#login-view').hidden = !visible;
  $('#studio').hidden = visible;
}

function showLogin() {
  setLoginVisible(true);
  $('#password').focus();
}

async function switchView(view) {
  state.view = view;
  $$('.page-view').forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  $$('.rail-nav-item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewTarget === view);
  });
  $('.workspace').scrollTo?.({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateMetrics() {
  const total = state.pages.length;
  const published = state.pages.filter((page) => page.status === 'published').length;
  const views = state.pages.reduce((sum, page) => sum + Number(page.views || 0), 0);
  $('#metric-total').textContent = total;
  $('#metric-published').textContent = published;
  $('#metric-drafts').textContent = total - published;
  $('#metric-views').textContent = views;
}

function filteredPages() {
  const query = $('#page-search').value.trim().toLowerCase();
  const status = $('#page-filter').value;
  return state.pages.filter((page) => {
    const matchesStatus = status === 'all' || page.status === status;
    const haystack = [page.recipient, page.title, page.sender, page.token, OCCASIONS[page.occasion]?.label]
      .join(' ')
      .toLowerCase();
    return matchesStatus && (!query || haystack.includes(query));
  });
}

function statusPill(page) {
  return page.status === 'published'
    ? '<span class="status-pill is-published">已发布</span>'
    : '<span class="status-pill is-draft">草稿</span>';
}

function renderPages() {
  const pages = filteredPages();
  const list = $('#page-list');
  if (!pages.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-glyph">见</span><h3>${state.pages.length ? '没有符合条件的祝福' : '还没有祝福档案'}</h3><p>${state.pages.length ? '试试更换搜索词或筛选条件。' : '新建第一封祝福，或从名单批量生成。'}</p></div>`;
    updateBulkBar();
    return;
  }

  list.innerHTML = pages.map((page, index) => {
    const occasion = OCCASIONS[page.occasion] || OCCASIONS.custom;
    const theme = THEMES[page.theme] || THEMES.ivory;
    const checked = state.selected.has(page.id) ? ' checked' : '';
    const copyDisabled = page.status !== 'published' ? ' disabled' : '';
    const toggleLabel = page.status === 'published' ? '转为草稿' : '发布';
    const toggleIcon = page.status === 'published' ? icons.unpublish : icons.publish;
    const viewerUrl = page.status === 'published' ? page.url : `${page.url}?preview=1`;
    return `
      <div class="page-row" data-id="${escapeHtml(page.id)}" style="animation-delay:${Math.min(index * 35, 240)}ms">
        <label class="check-cell"><input type="checkbox" data-select-id="${escapeHtml(page.id)}" aria-label="选择 ${escapeHtml(page.recipient)}"${checked}></label>
        <a class="page-identity" href="${escapeHtml(viewerUrl)}" target="_blank" rel="noopener">
          <span class="page-monogram">${escapeHtml(Array.from(page.recipient || '祝')[0])}</span>
          <span class="page-name"><strong>${escapeHtml(page.recipient)}</strong><span>${escapeHtml(page.title)}</span></span>
        </a>
        <div class="page-meta"><strong>${escapeHtml(occasion.label)} · ${escapeHtml(theme.label)}</strong><span>${escapeHtml(page.sender || '未署名')}</span></div>
        <div class="status-cell">${statusPill(page)}</div>
        <div class="views-cell"><span class="view-count">${Number(page.views || 0)}</span></div>
        <div class="updated-cell"><span class="update-date">${formatDate(page.updatedAt)}</span></div>
        <div class="row-actions">
          <button type="button" class="row-action" data-action="edit" data-id="${escapeHtml(page.id)}" title="编辑">${icons.edit}</button>
          <button type="button" class="row-action" data-action="copy" data-id="${escapeHtml(page.id)}" title="复制链接"${copyDisabled}>${icons.copy}</button>
          <button type="button" class="row-action" data-action="toggle-publish" data-id="${escapeHtml(page.id)}" title="${toggleLabel}">${toggleIcon}</button>
          <button type="button" class="row-action" data-action="delete" data-id="${escapeHtml(page.id)}" title="删除">${icons.trash}</button>
        </div>
      </div>`;
  }).join('');
  updateBulkBar();
}

function updateBulkBar() {
  const existing = new Set(state.pages.map((page) => page.id));
  [...state.selected].forEach((id) => {
    if (!existing.has(id)) state.selected.delete(id);
  });
  $('#bulk-count').textContent = state.selected.size;
  $('#bulk-bar').hidden = state.selected.size === 0;
  const visible = filteredPages();
  $('#select-all').checked = visible.length > 0 && visible.every((page) => state.selected.has(page.id));
}

function renderThemePicker() {
  $('#theme-picker').innerHTML = Object.entries(THEMES).map(([key, theme]) => `
    <button type="button" class="theme-option" data-theme-key="${key}" style="background-image:linear-gradient(to top, rgba(8,14,12,.5), transparent),url('${escapeHtml(theme.background)}');background-position:center;background-size:cover" aria-pressed="false">
      <span class="theme-option-swatch">${theme.swatches.map((color) => `<span style="background:${escapeHtml(color)}"></span>`).join('')}</span>
      <span class="theme-option-copy"><strong>${escapeHtml(theme.label)}</strong><span>${escapeHtml(theme.description)}</span></span>
    </button>`).join('');
}

function renderComponentToggles() {
  $('#component-toggles').innerHTML = Object.entries(componentLabels).map(([key, label]) => `
    <label class="component-toggle"><input type="checkbox" data-component-key="${key}"> ${label}</label>`).join('');
}

function renderThemeSelection() {
  $$('.theme-option').forEach((button) => {
    const selected = button.dataset.themeKey === state.editing?.theme;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function renderComponents() {
  $$('.component-toggle input').forEach((input) => {
    input.checked = Boolean(state.editing?.components?.[input.dataset.componentKey]);
  });
}

function renderGallery() {
  const list = $('#gallery-list');
  const gallery = state.editing?.gallery || [];
  if (!gallery.length) {
    list.innerHTML = '<div class="gallery-empty">还没有照片。上传后会随页面一起保存。</div>';
    return;
  }
  list.innerHTML = gallery.map((item, index) => `
    <div class="gallery-item" data-gallery-index="${index}">
      <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.caption || `记忆 ${index + 1}`)}">
      <button type="button" class="gallery-remove" data-remove-gallery="${index}" aria-label="删除照片">×</button>
    </div>`).join('');
}

function renderMilestones() {
  const list = $('#milestone-list');
  const milestones = state.editing?.milestones || [];
  if (!milestones.length) {
    list.innerHTML = '<div class="gallery-empty">没有时间线内容。只有在组件里开启时间线时才会展示。</div>';
    return;
  }
  list.innerHTML = milestones.map((item, index) => `
    <div class="milestone-row" data-milestone-index="${index}">
      <input type="text" data-milestone-field="date" value="${escapeHtml(item.date)}" placeholder="年份 / 日期">
      <input type="text" data-milestone-field="title" value="${escapeHtml(item.title)}" placeholder="标题">
      <input type="text" data-milestone-field="text" value="${escapeHtml(item.text)}" placeholder="一句话描述">
      <button type="button" class="milestone-remove" data-remove-milestone="${index}" aria-label="删除时间线">×</button>
    </div>`).join('');
}

function renderAssetCards() {
  $('#theme-asset-grid').innerHTML = Object.entries(THEMES).map(([key, theme]) => `
    <article class="theme-asset-card">
      <div class="theme-asset-image" style="background-image:url('${escapeHtml(theme.background)}')"></div>
      <div class="theme-asset-overlay"></div>
      <div class="theme-asset-copy"><span class="eyebrow">${key.toUpperCase()}</span><h2>${escapeHtml(theme.label)}</h2><p>${escapeHtml(theme.description)}</p></div>
    </article>`).join('');
}

async function loadOverview() {
  const data = await api('/api/admin/overview');
  state.pages = data.pages || [];
  updateMetrics();
  renderPages();
  renderAssetCards();
}

async function enterStudio() {
  setLoginVisible(false);
  await loadOverview();
}

async function checkAuth() {
  const response = await fetch('/api/auth');
  const data = await response.json();
  $('#password-hint').hidden = !data.defaultPassword;
  if (data.authenticated) {
    await enterStudio();
  } else {
    showLogin();
  }
}

async function handleRowAction(id, action) {
  const page = state.pages.find((item) => item.id === id);
  if (!page) return;
  if (action === 'edit') {
    openEditor(page);
    return;
  }
  if (action === 'copy') {
    if (page.status !== 'published') {
      toast('这封祝福还是草稿，发布后才能复制公开链接', true);
      return;
    }
    await copyText(page.url, '祝福链接已复制');
    return;
  }
  if (action === 'toggle-publish') {
    const endpoint = page.status === 'published' ? 'unpublish' : 'publish';
    try {
      await api(`/api/admin/pages/${page.id}/${endpoint}`, { method: 'POST' });
      await loadOverview();
      toast(endpoint === 'publish' ? '祝福已发布，链接可以发送了' : '祝福已转为草稿');
    } catch (error) {
      toast(error.message, true);
    }
    return;
  }
  if (action === 'delete') {
    if (!window.confirm(`确定删除“${page.recipient}”的祝福页吗？删除后无法恢复。`)) return;
    try {
      await api(`/api/admin/pages/${page.id}`, { method: 'DELETE' });
      state.selected.delete(page.id);
      await loadOverview();
      toast('祝福页已删除');
    } catch (error) {
      toast(error.message, true);
    }
  }
}

function syncEditorMeta() {
  const page = state.editing;
  if (!page) return;
  const isPublished = page.status === 'published';
  $('#editor-heading').textContent = page.token ? `${page.recipient || '未命名'}的祝福` : '新建一封祝福';
  $('#editor-kicker').textContent = page.token ? 'EDIT BLESSING' : 'NEW BLESSING';
  const status = $('#editor-status');
  status.textContent = isPublished ? '已发布' : '草稿';
  status.className = `status-pill ${isPublished ? 'is-published' : 'is-draft'}`;
  $('#publish-page').innerHTML = isPublished ? '保存修改 <span aria-hidden="true">↗</span>' : '保存并发布 <span aria-hidden="true">↗</span>';
  $('#share-panel').hidden = !isPublished || !page.url;
  if (isPublished && page.url) {
    $('#share-link').value = page.url;
    $('#open-share-link').href = page.url;
  }
}

function openEditor(page = null) {
  state.editing = page ? structuredClone(page) : pageDefault();
  state.editorDirty = false;
  const editing = state.editing;

  $('#field-recipient').value = editing.recipient || '';
  $('#field-sender').value = editing.sender || '';
  $('#field-occasion').value = editing.occasion || 'birthday';
  $('#field-event-date').value = editing.eventDate || '';
  $('#field-title').value = editing.title || '';
  $('#field-message').value = editing.message || '';
  $('#field-closing').value = editing.closing || '';
  $('#field-audio-url').value = editing.audioUrl || '';
  $('#field-expires-at').value = editing.expiresAt || '';
  $('#audio-upload-status').textContent = editing.audioUrl ? '已有音频' : '未选择文件';

  renderThemeSelection();
  renderComponents();
  renderGallery();
  renderMilestones();
  syncEditorMeta();

  const frame = $('#preview-frame');
  if (editing.token) {
    frame.src = `/b/${editing.token}?preview=1&v=${Date.now()}`;
    $('#preview-placeholder').hidden = true;
  } else {
    frame.removeAttribute('src');
    $('#preview-placeholder').hidden = false;
  }

  $('#editor-view').hidden = false;
  document.body.classList.add('is-editing');
  window.setTimeout(() => $('#field-recipient').focus(), 120);
}

function closeEditor() {
  if (state.editorDirty && !window.confirm('还有未保存的修改，确定关闭编辑器吗？')) return;
  $('#editor-view').hidden = true;
  $('#preview-frame').removeAttribute('src');
  document.body.classList.remove('is-editing');
  state.editing = null;
  state.editorDirty = false;
}

function collectEditorPayload() {
  const components = {};
  $$('.component-toggle input').forEach((input) => {
    components[input.dataset.componentKey] = input.checked;
  });
  return {
    recipient: $('#field-recipient').value.trim(),
    sender: $('#field-sender').value.trim(),
    occasion: $('#field-occasion').value,
    theme: state.editing?.theme || 'ivory',
    title: $('#field-title').value.trim(),
    message: $('#field-message').value.trim(),
    closing: $('#field-closing').value.trim(),
    eventDate: $('#field-event-date').value,
    gallery: state.editing?.gallery || [],
    milestones: state.editing?.milestones || [],
    audioUrl: $('#field-audio-url').value.trim(),
    expiresAt: $('#field-expires-at').value,
    components
  };
}

function replacePageInState(page) {
  const index = state.pages.findIndex((item) => item.id === page.id);
  if (index === -1) state.pages.unshift(page);
  else state.pages[index] = page;
  updateMetrics();
  renderPages();
}

function useEditorDefaultsForOccasion(occasionKey) {
  const occasion = OCCASIONS[occasionKey] || OCCASIONS.custom;
  const recipient = $('#field-recipient').value.trim() || '亲爱的你';
  if (!$('#field-title').value.trim()) $('#field-title').value = occasion.defaultTitle(recipient);
  if (!$('#field-message').value.trim()) $('#field-message').value = occasion.defaultMessage(recipient);
  if (!$('#field-closing').value.trim()) $('#field-closing').value = occasion.defaultClosing;
}

async function savePage({ refreshPreview = true, quiet = false } = {}) {
  if (!state.editing || state.busy) return null;
  const payload = collectEditorPayload();
  if (!payload.recipient) {
    $('#field-recipient').focus();
    toast('请先填写收件人姓名', true);
    return null;
  }
  state.busy = true;
  const saveButton = $('#save-page');
  const oldLabel = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = '保存中…';
  try {
    const isExisting = Boolean(state.editing.token);
    const data = await api(isExisting ? `/api/admin/pages/${state.editing.id}` : '/api/admin/pages', {
      method: isExisting ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    state.editing = data.page;
    state.editorDirty = false;
    replacePageInState(data.page);
    syncEditorMeta();
    if (refreshPreview) {
      $('#preview-frame').src = `/b/${data.page.token}?preview=1&v=${Date.now()}`;
      $('#preview-placeholder').hidden = true;
    }
    if (!quiet) toast('祝福已保存');
    return data.page;
  } catch (error) {
    toast(error.message, true);
    return null;
  } finally {
    state.busy = false;
    saveButton.disabled = false;
    saveButton.textContent = oldLabel;
  }
}

async function publishPage() {
  if (!state.editing || state.busy) return;
  const saved = await savePage({ refreshPreview: false, quiet: true });
  if (!saved) return;
  if (saved.status === 'published') {
    $('#preview-frame').src = `/b/${saved.token}?preview=1&v=${Date.now()}`;
    $('#preview-placeholder').hidden = true;
    toast('修改已保存');
    return;
  }
  state.busy = true;
  $('#publish-page').disabled = true;
  try {
    const data = await api(`/api/admin/pages/${saved.id}/publish`, { method: 'POST' });
    state.editing = data.page;
    replacePageInState(data.page);
    syncEditorMeta();
    $('#preview-frame').src = `/b/${data.page.token}?preview=1&v=${Date.now()}`;
    $('#preview-placeholder').hidden = true;
    toast('祝福已发布，正式链接已准备好');
  } catch (error) {
    toast(error.message, true);
  } finally {
    state.busy = false;
    $('#publish-page').disabled = false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('单个文件不能超过 12MB');
  const data = await fileToDataUrl(file);
  const result = await api('/api/admin/uploads', {
    method: 'POST',
    body: JSON.stringify({ data, name: file.name, type: file.type })
  });
  return result.url;
}

async function uploadGalleryFiles(files) {
  if (!state.editing) return;
  const available = 24 - state.editing.gallery.length;
  const selected = [...files].slice(0, Math.max(0, available));
  if (!selected.length) {
    toast('照片数量已经达到上限', true);
    return;
  }
  for (const file of selected) {
    try {
      const url = await uploadFile(file);
      state.editing.gallery.push({ url, caption: file.name.replace(/\.[^.]+$/, '') || '一段记忆' });
      state.editorDirty = true;
      renderGallery();
    } catch (error) {
      toast(`${file.name}：${error.message}`, true);
    }
  }
  if (selected.length) toast(`已上传 ${selected.length} 张照片，保存后生效`);
}

async function uploadAudio(file) {
  if (!file || !state.editing) return;
  $('#audio-upload-status').textContent = '上传中…';
  try {
    const url = await uploadFile(file);
    $('#field-audio-url').value = url;
    $('#audio-upload-status').textContent = file.name;
    state.editorDirty = true;
    toast('音频已上传，保存后生效');
  } catch (error) {
    $('#audio-upload-status').textContent = '上传失败';
    toast(error.message, true);
  }
}

const CSV_SAMPLE = `recipient,sender,occasion,theme,title,message
林晚,阿宁,birthday,ivory,给林晚的生日来信,愿你新的一岁依然自由明亮
周予安,见字如面,festival,night,寄一轮月亮给你,愿每一个平常夜里都有一盏灯为你而亮
陈默,老周,graduation,celadon,毕业快乐,去更辽阔的地方见更明亮的自己`;

function pick(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && String(record[key]).trim()) return String(record[key]).trim();
  }
  return '';
}

function resolveOptionKey(value, dictionary, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (Object.hasOwn(dictionary, raw)) return raw;
  const lower = raw.toLowerCase();
  if (Object.hasOwn(dictionary, lower)) return lower;
  const match = Object.entries(dictionary).find(([key, option]) => (
    option.label === raw || String(option.english || '').toLowerCase() === lower
  ));
  return match?.[0] || fallback;
}

function parseBatchRows() {
  const text = $('#batch-text').value.trim();
  if (!text) {
    toast('请先粘贴 CSV 名单', true);
    return;
  }
  let records = [];
  try {
    records = parseCsvObjects(text);
  } catch {
    toast('CSV 格式无法解析，请检查引号和换行', true);
    return;
  }
  if (!records.length) {
    toast('没有读到数据行，请确认第一行是表头', true);
    return;
  }

  let skipped = 0;
  const rows = records.map((record) => {
    const recipient = pick(record, ['recipient', 'name', '收件人', '姓名', '名字', '祝福对象']);
    if (!recipient) {
      skipped += 1;
      return null;
    }
    return {
      recipient,
      sender: pick(record, ['sender', 'from', '发送人', '署名', '寄件人']),
      occasion: resolveOptionKey(pick(record, ['occasion', 'type', '场合', '类型', '祝福场合']), OCCASIONS, 'birthday'),
      theme: resolveOptionKey(pick(record, ['theme', 'style', '主题', '风格']), THEMES, 'ivory'),
      title: pick(record, ['title', '标题']),
      message: pick(record, ['message', '正文', '祝福语', '内容'])
    };
  }).filter(Boolean);

  if (!rows.length) {
    toast('没有找到有效的收件人姓名', true);
    return;
  }
  const sliced = rows.slice(0, 200);
  if (rows.length > 200) toast('一次最多生成 200 条，本次已取前 200 条', true);
  if (skipped) toast(`已跳过 ${skipped} 条没有姓名的数据`, true);
  state.batchRows = sliced;
  renderBatchPreview();
}

function renderBatchPreview() {
  const preview = $('#batch-preview');
  const rows = state.batchRows;
  const publish = $('#batch-publish').checked;
  $('#batch-preview-summary').textContent = rows.length
    ? `已解析 ${rows.length} 条祝福，生成后${publish ? '立即发布' : '保存为草稿'}。`
    : '还没有解析名单。';
  if (!rows.length) {
    preview.className = 'batch-preview-empty';
    preview.innerHTML = '<span class="empty-glyph">见</span><p>粘贴名单后点击“解析名单”<br>这里会显示将要生成的祝福。</p>';
    $('#generate-batch').disabled = true;
    return;
  }
  preview.className = 'batch-preview-list';
  preview.innerHTML = rows.slice(0, 12).map((row, index) => {
    const theme = THEMES[row.theme] || THEMES.ivory;
    return `
      <div class="batch-preview-item">
        <span class="batch-preview-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="batch-preview-name"><strong>${escapeHtml(row.recipient)}</strong><span>${escapeHtml(OCCASIONS[row.occasion].label)} · ${escapeHtml(theme.label)}${row.sender ? ` · 来自 ${escapeHtml(row.sender)}` : ''}</span></span>
        <span class="theme-dot" style="--dot:${escapeHtml(theme.swatches[1])}"></span>
      </div>`;
  }).join('') + (rows.length > 12 ? `<div class="batch-preview-item"><span></span><span class="batch-preview-name"><span>还有 ${rows.length - 12} 条未展开</span></span><span></span></div>` : '');
  $('#generate-batch').disabled = false;
}

async function generateBatch() {
  if (!state.batchRows.length || state.busy) return;
  state.busy = true;
  const button = $('#generate-batch');
  button.disabled = true;
  const oldLabel = button.innerHTML;
  button.textContent = '正在生成…';
  try {
    const data = await api('/api/admin/batch', {
      method: 'POST',
      body: JSON.stringify({
        rows: state.batchRows,
        publishAll: $('#batch-publish').checked
      })
    });
    state.batchResults = data.pages || [];
    renderBatchResults();
    await loadOverview();
    toast(`已生成 ${data.count} 条祝福链接`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    state.busy = false;
    button.disabled = false;
    button.innerHTML = oldLabel;
  }
}

function renderBatchResults() {
  const container = $('#batch-results');
  const list = $('#batch-results-list');
  container.hidden = false;
  $('#batch-result-title').textContent = `共生成 ${state.batchResults.length} 条祝福链接`;
  list.innerHTML = state.batchResults.map((page) => `
    <div class="result-item">
      <strong>${escapeHtml(page.recipient)}</strong>
      <code>${escapeHtml(page.url)}</code>
      <span class="result-status">${page.status === 'published' ? '已发布' : '草稿'}</span>
      <button type="button" class="small-action" data-copy-url="${escapeHtml(page.url)}">复制</button>
    </div>`).join('');
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fillBatchSample() {
  $('#batch-text').value = CSV_SAMPLE;
  state.batchRows = [];
  renderBatchPreview();
}

function bindEvents() {
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#login-message');
    message.textContent = '';
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#password').value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '登录失败');
      $('#password').value = '';
      await enterStudio();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  $('#logout-button').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showLogin();
  });

  $$('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.viewTarget));
  });

  ['#new-page-button', '#hero-new-button', '#mobile-new-button'].forEach((selector) => {
    $(selector).addEventListener('click', () => openEditor());
  });

  $('#page-search').addEventListener('input', renderPages);
  $('#page-filter').addEventListener('change', renderPages);

  $('#select-all').addEventListener('change', (event) => {
    const visible = filteredPages();
    visible.forEach((page) => {
      if (event.target.checked) state.selected.add(page.id);
      else state.selected.delete(page.id);
    });
    renderPages();
  });

  $('#page-list').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action) {
      event.preventDefault();
      handleRowAction(action.dataset.id, action.dataset.action);
      return;
    }
    const checkbox = event.target.closest('[data-select-id]');
    if (checkbox) {
      if (checkbox.checked) state.selected.add(checkbox.dataset.selectId);
      else state.selected.delete(checkbox.dataset.selectId);
      updateBulkBar();
    }
  });

  $('#page-list').addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-select-id]');
    if (!checkbox) return;
    if (checkbox.checked) state.selected.add(checkbox.dataset.selectId);
    else state.selected.delete(checkbox.dataset.selectId);
    updateBulkBar();
  });

  $('#bulk-bar').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-bulk-action]');
    if (!button) return;
    const action = button.dataset.bulkAction;
    if (action === 'delete' && !window.confirm(`确定删除选中的 ${state.selected.size} 封祝福吗？`)) return;
    try {
      await api('/api/admin/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: [...state.selected], action })
      });
      state.selected.clear();
      await loadOverview();
      toast('批量操作已完成');
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#close-editor').addEventListener('click', closeEditor);
  $('#save-page').addEventListener('click', () => savePage());
  $('#publish-page').addEventListener('click', publishPage);
  $('#refresh-preview').addEventListener('click', () => savePage());
  $('#page-form').addEventListener('input', () => { state.editorDirty = true; });
  $('#page-form').addEventListener('change', () => { state.editorDirty = true; });

  $('#field-occasion').addEventListener('change', (event) => {
    useEditorDefaultsForOccasion(event.target.value);
  });

  $('#theme-picker').addEventListener('click', (event) => {
    const option = event.target.closest('[data-theme-key]');
    if (!option || !state.editing) return;
    state.editing.theme = option.dataset.themeKey;
    state.editorDirty = true;
    renderThemeSelection();
  });

  $('#component-toggles').addEventListener('change', (event) => {
    const input = event.target.closest('[data-component-key]');
    if (!input || !state.editing) return;
    state.editing.components[input.dataset.componentKey] = input.checked;
    state.editorDirty = true;
  });

  $('#gallery-list').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-gallery]');
    if (!remove || !state.editing) return;
    state.editing.gallery.splice(Number(remove.dataset.removeGallery), 1);
    state.editorDirty = true;
    renderGallery();
  });

  $('#gallery-upload').addEventListener('change', async (event) => {
    await uploadGalleryFiles(event.target.files);
    event.target.value = '';
  });

  $('#add-milestone').addEventListener('click', () => {
    if (!state.editing || state.editing.milestones.length >= 12) {
      toast('时间线最多添加 12 条', true);
      return;
    }
    state.editing.milestones.push({ date: '', title: '', text: '' });
    state.editorDirty = true;
    renderMilestones();
  });

  $('#milestone-list').addEventListener('input', (event) => {
    const input = event.target.closest('[data-milestone-field]');
    const row = event.target.closest('[data-milestone-index]');
    if (!input || !row || !state.editing) return;
    state.editing.milestones[Number(row.dataset.milestoneIndex)][input.dataset.milestoneField] = input.value;
    state.editorDirty = true;
  });

  $('#milestone-list').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-milestone]');
    if (!remove || !state.editing) return;
    state.editing.milestones.splice(Number(remove.dataset.removeMilestone), 1);
    state.editorDirty = true;
    renderMilestones();
  });

  $('#audio-upload').addEventListener('change', async (event) => {
    await uploadAudio(event.target.files[0]);
    event.target.value = '';
  });

  $('#copy-share-link').addEventListener('click', () => {
    if ($('#share-link').value) copyText($('#share-link').value, '祝福链接已复制');
  });

  $('#fill-sample').addEventListener('click', fillBatchSample);
  $('#parse-batch').addEventListener('click', parseBatchRows);
  $('#generate-batch').addEventListener('click', generateBatch);
  $('#batch-publish').addEventListener('change', renderBatchPreview);
  $('#batch-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    $('#batch-text').value = await file.text();
    state.batchRows = [];
    renderBatchPreview();
    toast('CSV 已载入，点击解析名单继续');
    event.target.value = '';
  });
  $('#batch-results-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-url]');
    if (button) copyText(button.dataset.copyUrl, '链接已复制');
  });
  $('#copy-all-links').addEventListener('click', () => {
    const links = state.batchResults.map((page) => `${page.recipient}\t${page.url}`).join('\n');
    if (links) copyText(links, '全部链接已复制');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('#editor-view').hidden) closeEditor();
  });
}

function init() {
  const now = new Date();
  $('#today-label').textContent = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long'
  }).format(now);
  $('#field-occasion').innerHTML = Object.entries(OCCASIONS).map(([key, occasion]) => (
    `<option value="${key}">${escapeHtml(occasion.label)}</option>`
  )).join('');
  renderThemePicker();
  renderComponentToggles();
  renderAssetCards();
  bindEvents();
  checkAuth().catch((error) => {
    showLogin();
    toast(error.message, true);
  });
}

init();


