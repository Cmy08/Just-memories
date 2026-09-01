// ============================================================
// app.js — 主应用入口（协调各模块）
// ============================================================

// 这个文件主要用于确保所有模块加载完成后的额外初始化
// 主要逻辑已在 ui.js 中实现

console.log('📦 MD Editor v2 已加载');
console.log(`📄 项目数: ${getProjects().length}`);
console.log(`🎨 当前主题: ${getSavedTheme()}`);

// 暴露一些全局函数方便调试（可选）
window.__debug = {
    getProjects,
    getProject,
    deleteProject,
    clearAllProjects,
    applyTheme,
    renderMarkdown,
};