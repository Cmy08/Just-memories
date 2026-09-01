// ============================================================
// renderer.js — Markdown渲染、主题应用、滚动位置管理
// ============================================================

// 缓存渲染结果
const renderCache = new Map();
const MAX_CACHE_SIZE = 10;

/** 渲染 Markdown 为 HTML（带缓存） */
function renderMarkdown(content, forceRefresh = false) {
    const cacheKey = content.length > 100 ? content.slice(0, 100) + content.length : content;
    if (!forceRefresh && renderCache.has(cacheKey)) {
        return renderCache.get(cacheKey);
    }

    try {
        const html = marked.parse(content);
        // 缓存
        if (renderCache.size > MAX_CACHE_SIZE) {
            const firstKey = renderCache.keys().next().value;
            renderCache.delete(firstKey);
        }
        renderCache.set(cacheKey, html);
        return html;
    } catch (e) {
        console.error('Markdown 渲染失败:', e);
        return `<pre style="color:#b33a3a;">渲染错误: ${e.message}</pre>`;
    }
}

/** 应用主题 */
function applyTheme(themeName) {
    const link = document.getElementById('themeStylesheet');
    if (!link) return;

    // 移除旧的主题类
    document.documentElement.classList.remove('theme-default', 'theme-cyberpunk');

    if (themeName === 'cyberpunk') {
        link.href = 'styles/theme-cyberpunk.css';
        document.documentElement.classList.add('theme-cyberpunk');
    } else {
        link.href = 'styles/theme-default.css';
        document.documentElement.classList.add('theme-default');
    }

    // 保存主题偏好
    try {
        localStorage.setItem('mdEditor_theme', themeName);
    } catch (e) { /* ignore */ }
}

/** 获取保存的主题偏好 */
function getSavedTheme() {
    try {
        return localStorage.getItem('mdEditor_theme') || 'default';
    } catch (e) {
        return 'default';
    }
}

/** 保存滚动位置 */
function saveScrollPosition(container, key) {
    if (!container) return;
    try {
        const data = {
            scrollTop: container.scrollTop,
            scrollLeft: container.scrollLeft
        };
        localStorage.setItem(`mdEditor_scroll_${key}`, JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

/** 恢复滚动位置 */
function restoreScrollPosition(container, key) {
    if (!container) return;
    try {
        const raw = localStorage.getItem(`mdEditor_scroll_${key}`);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.scrollTop !== undefined) {
                container.scrollTop = data.scrollTop;
            }
            if (data.scrollLeft !== undefined) {
                container.scrollLeft = data.scrollLeft;
            }
        }
    } catch (e) { /* ignore */ }
}

/** 保存编辑光标位置 */
function saveCursorPosition(textarea, key) {
    if (!textarea) return;
    try {
        const data = {
            selectionStart: textarea.selectionStart,
            selectionEnd: textarea.selectionEnd,
            scrollTop: textarea.scrollTop
        };
        localStorage.setItem(`mdEditor_cursor_${key}`, JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

/** 恢复编辑光标位置 */
function restoreCursorPosition(textarea, key) {
    if (!textarea) return;
    try {
        const raw = localStorage.getItem(`mdEditor_cursor_${key}`);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.selectionStart !== undefined) {
                textarea.selectionStart = data.selectionStart;
                textarea.selectionEnd = data.selectionEnd || data.selectionStart;
            }
            if (data.scrollTop !== undefined) {
                textarea.scrollTop = data.scrollTop;
            }
            // 聚焦
            textarea.focus();
        }
    } catch (e) { /* ignore */ }
}

/** 清理所有滚动/光标缓存 */
function clearScrollCache() {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
        if (key.startsWith('mdEditor_scroll_') || key.startsWith('mdEditor_cursor_')) {
            localStorage.removeItem(key);
        }
    }
}