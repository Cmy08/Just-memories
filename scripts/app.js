// ============================================================
// app.js — 主应用入口（协调各模块）
// ============================================================

console.log('📦 MD Editor v2 已加载');
console.log(`📄 项目数: ${getProjects().length}`);
console.log(`🎨 当前主题: ${getSavedTheme()}`);

window.__debug = {
    getProjects,
    getProject,
    deleteProject,
    clearAllProjects,
    applyTheme,
    renderMarkdown,
    exportDraft,
    importDraft,
};
