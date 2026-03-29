import fs from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_LANGUAGE, translations } from '../src/translations.js';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');
const HEAD_MARKER = '<!-- i18n:head -->';
const TOOTH_EMOJI = '🦷';

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeLanguage(lang) {
  return String(lang || '')
    .trim()
    .toLowerCase();
}

function resolveLanguage(lang) {
  const normalized = normalizeLanguage(lang);
  if (normalized && hasOwn(translations, normalized)) return normalized;
  return DEFAULT_LANGUAGE;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceToothEmoji(text, iconHeight) {
  if (typeof text !== 'string') return String(text ?? '');
  if (!text.includes(TOOTH_EMOJI)) return text;

  const height = Number(iconHeight);
  const style =
    Number.isFinite(height) && height > 0 ? ` style="height: ${height}px;"` : '';
  const icon = `<img src="/cropped_tooth.svg" alt="" class="tooth-icon"${style}>`;
  return text.replaceAll(TOOTH_EMOJI, icon);
}

function getNestedTranslation(lang, keyPath) {
  if (!lang || !keyPath) return undefined;

  const parts = String(keyPath).split('.');
  let value = translations[lang];

  for (const part of parts) {
    if (value && typeof value === 'object' && hasOwn(value, part)) {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}

function t(lang, keyPath) {
  const resolvedLang = resolveLanguage(lang);
  const primary = getNestedTranslation(resolvedLang, keyPath);
  if (primary !== undefined) return primary;

  const fallback = getNestedTranslation(DEFAULT_LANGUAGE, keyPath);
  if (fallback !== undefined) return fallback;

  return keyPath;
}

function extractAttribute(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match?.[1] ?? '';
}

function renderListItems(items, iconHeight) {
  return items
    .map((item) => `<li>${replaceToothEmoji(String(item ?? ''), iconHeight)}</li>`)
    .join('');
}

function renderParagraphs(items, iconHeight) {
  return items
    .map((item) => `<p>${replaceToothEmoji(String(item ?? ''), iconHeight)}</p>`)
    .join('');
}

function renderTranslationValue({ value, mode, tagName, iconHeight }) {
  const lowerTag = String(tagName).toLowerCase();

  if (Array.isArray(value)) {
    if (lowerTag === 'ul' || lowerTag === 'ol') return renderListItems(value, iconHeight);
    return renderParagraphs(value, iconHeight);
  }

  const asString = String(value ?? '');

  if (mode === 'text') {
    const safe = escapeHtml(asString);
    return replaceToothEmoji(safe, iconHeight);
  }

  // html / paragraphs
  return replaceToothEmoji(asString, iconHeight);
}

function applyDataTranslation(html, { lang, attr, mode }) {
  const attrName = String(attr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<([a-zA-Z0-9-]+)([^>]*?\\b${attrName}="([^"]+)"[^>]*?)>([\\s\\S]*?)<\\/\\1>`,
    'g'
  );

  return html.replace(re, (full, tagName, attrs, keyPath) => {
    const iconHeight = extractAttribute(attrs, 'data-icon-height');
    const translated = t(lang, keyPath);
    const rendered = renderTranslationValue({ value: translated, mode, tagName, iconHeight });
    return `<${tagName}${attrs}>${rendered}</${tagName}>`;
  });
}

function setHtmlLangAttribute(html, lang) {
  const resolvedLang = resolveLanguage(lang);
  return html.replace(/<html\b([^>]*)>/, (match, attrs) => {
    if (/\blang=/.test(attrs)) {
      return `<html${attrs.replace(/\blang="[^"]*"/, `lang="${resolvedLang}"`)}>`;
    }
    return `<html lang="${resolvedLang}"${attrs}>`;
  });
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function pathForLanguage(lang) {
  const resolvedLang = resolveLanguage(lang);
  return resolvedLang === DEFAULT_LANGUAGE ? '/' : `/${resolvedLang}/`;
}

function renderI18nHead({ siteUrl, lang }) {
  const resolvedLang = resolveLanguage(lang);
  const languages = Object.keys(translations).map(resolveLanguage);

  const base = siteUrl ? ensureTrailingSlash(siteUrl.replace(/\/+$/, '')) : '';
  const toUrl = (p) => (base ? new URL(p, base).toString() : p);

  const canonical = toUrl(pathForLanguage(resolvedLang));
  const lines = [`<link rel="canonical" href="${canonical}" />`];

  for (const l of languages) {
    lines.push(`<link rel="alternate" hreflang="${l}" href="${toUrl(pathForLanguage(l))}" />`);
  }

  lines.push(
    `<link rel="alternate" hreflang="x-default" href="${toUrl(pathForLanguage(DEFAULT_LANGUAGE))}" />`
  );

  return lines.join('\n    ');
}

function injectI18nHead(html, headHtml) {
  if (html.includes(HEAD_MARKER)) {
    return html.replace(HEAD_MARKER, headHtml);
  }
  return html.replace(/<\/head>/, `${headHtml}\n  </head>`);
}

function setActiveLanguageButton(html, lang) {
  const resolvedLang = resolveLanguage(lang);

  const re = /<button\b([^>]*\bdata-lang="([^"]+)"[^>]*)>/g;
  return html.replace(re, (full, attrs, btnLang) => {
    const btnResolvedLang = resolveLanguage(btnLang);

    const classMatch = attrs.match(/\bclass="([^"]*)"/);
    if (!classMatch) return full;

    const classes = classMatch[1].split(/\s+/).filter(Boolean);
    const next = new Set(classes);
    if (btnResolvedLang === resolvedLang) next.add('active');
    else next.delete('active');

    const nextAttrs = attrs.replace(/\bclass="[^"]*"/, `class="${Array.from(next).join(' ')}"`);
    return `<button${nextAttrs}>`;
  });
}

function renderPage({ templateHtml, lang, siteUrl }) {
  let html = templateHtml;

  html = setHtmlLangAttribute(html, lang);
  html = injectI18nHead(html, renderI18nHead({ siteUrl, lang }));
  html = setActiveLanguageButton(html, lang);

  html = applyDataTranslation(html, { lang, attr: 'data-translate-paragraphs', mode: 'paragraphs' });
  html = applyDataTranslation(html, { lang, attr: 'data-translate-html', mode: 'html' });
  html = applyDataTranslation(html, { lang, attr: 'data-translate', mode: 'text' });

  return html;
}

async function detectSiteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;

  try {
    const cname = await fs.readFile(path.resolve(process.cwd(), 'CNAME'), 'utf8');
    const domain = cname.trim().replace(/\/+$/, '');
    if (!domain) return '';
    if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
    return `https://${domain}`;
  } catch {
    return '';
  }
}

async function copyCnameToDist() {
  try {
    const cname = await fs.readFile(path.resolve(process.cwd(), 'CNAME'), 'utf8');
    if (!cname.trim()) return;
    await fs.writeFile(path.join(DIST_DIR, 'CNAME'), cname, 'utf8');
  } catch {
    // Ignore if CNAME doesn't exist.
  }
}

async function main() {
  const templateHtml = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const siteUrl = await detectSiteUrl();

  const langs = Object.keys(translations).map(resolveLanguage);

  for (const lang of langs) {
    const rendered = renderPage({ templateHtml, lang, siteUrl });

    const outDir = lang === DEFAULT_LANGUAGE ? DIST_DIR : path.join(DIST_DIR, lang);
    const outPath = path.join(outDir, 'index.html');

    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, rendered, 'utf8');
  }

  await copyCnameToDist();
}

async function addCacheBustingToSimplePage() {
  const simplePath = path.join(DIST_DIR, 'simple', 'index.html');
  try {
    let html = await fs.readFile(simplePath, 'utf8');
    
    // Генерируем уникальный хэш на основе времени сборки
    const buildHash = Date.now().toString(36);
    
    // Заменяем статичную версию CSS на динамический хэш
    html = html.replace(/style\.css\?v=[^"']*/g, `style.css?v=${buildHash}`);
    
    // Добавляем мета-тег с временем сборки для отладки
    html = html.replace(
      '</head>',
      `    <meta name="build-time" content="${new Date().toISOString()}">\n</head>`
    );
    
    await fs.writeFile(simplePath, html, 'utf8');
    console.log(`✅ Updated simple/index.html with cache-busting hash: ${buildHash}`);
  } catch (err) {
    console.log('ℹ️ simple/index.html not found, skipping cache-busting');
  }
}

await main();
await addCacheBustingToSimplePage();
