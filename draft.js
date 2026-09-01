// ============================================================
// draft.js — 草稿导入/导出 + 提醒
// ============================================================

const DRAFT_KEY = 'mdEditor_draft_reminder';

/** 导出草稿（下载 JSON 文件） */
function exportDraft() {
    const projects = getProjects();
    if (projects.length === 0) {
        alert('当前没有项目数据可以导出。');
        return false;
    }

    // 如果当前在编辑模式，先保存
    if (window._saveCurrentEdit) {
        window._saveCurrentEdit();
    }

    const data = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        projects: projects
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `md_editor_draft_${new Date().toISOString().slice(0,10)}.json`);

    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            lastExport: Date.now(),
            projectCount: projects.length
        }));
    } catch (e) { /* ignore */ }

    return true;
}

/** 导入草稿（上传 JSON 文件） */
function importDraft(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.projects || !Array.isArray(data.projects)) {
                    reject(new Error('无效的草稿文件：缺少 projects 字段'));
                    return;
                }

                if (data.version && data.version !== '2.0') {
                    if (!confirm(`草稿版本 (${data.version}) 与当前版本 (2.0) 可能不兼容，是否继续导入？`)) {
                        reject(new Error('用户取消导入'));
                        return;
                    }
                }

                const currentProjects = getProjects();
                if (currentProjects.length > 0) {
                    const choice = confirm(
                        `当前已有 ${currentProjects.length} 个项目。\n\n` +
                        `点击「确定」：覆盖所有现有项目\n` +
                        `点击「取消」：取消导入`
                    );
                    if (!choice) {
                        reject(new Error('用户取消导入'));
                        return;
                    }
                }

                saveProjects(data.projects);
                resolve(data.projects);
            } catch (err) {
                reject(new Error('解析草稿文件失败: ' + err.message));
            }
        };
        reader.onerror = function() {
            reject(new Error('读取文件失败'));
        };
        reader.readAsText(file);
    });
}

/** 检查是否需要提醒导出草稿（每 24 小时提醒一次） */
function checkDraftReminder() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - data.lastExport > oneDay) {
            const projects = getProjects();
            if (projects.length > 0) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

/** 显示草稿提醒（在界面中） */
function showDraftReminder() {
    const reminder = document.getElementById('draftReminder');
    if (!reminder) return;

    if (checkDraftReminder()) {
        reminder.classList.remove('hidden');
        reminder.innerHTML = `
            ⚠️ 已超过 24 小时未导出草稿，建议立即备份！
            <button onclick="exportDraft()" class="btn-primary" style="font-size:12px;padding:3px 14px;margin-left:10px;">
                📥 立即导出
            </button>
        `;
    } else {
        reminder.classList.add('hidden');
    }
}

// 每小时检查一次提醒
setInterval(showDraftReminder, 60 * 60 * 1000);

// 暴露全局函数
window.exportDraft = exportDraft;
window.importDraft = importDraft;
window.showDraftReminder = showDraftReminder;
window._checkDraftReminder = checkDraftReminder;