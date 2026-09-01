// ============================================================
// ui.js — 界面交互（模式切换、主题切换、项目渲染等）
// ============================================================

// ===== DOM 引用 =====
const $ = id => document.getElementById(id);

const dom = {
    projectList: $('projectList'),
    newProjectBtn: $('newProjectBtn'),
    clearAllBtn: $('clearAllBtn'),

    projectName: $('projectName'),
    fileCount: $('fileCount'),
    fileListContainer: $('fileListContainer'),
    markdownBody: $('markdownBody'),
    editTextarea: $('editTextarea'),
    viewContainer: $('viewContainer'),
    editContainer: $('editContainer'),
    fileStatus: $('fileStatus'),
    statusBar: $('statusBar'),
    scrollInfo: $('scrollInfo'),

    modeTabs: document.querySelectorAll('.mode-tab'),
    viewModeBtn: document.querySelector('.mode-tab[data-mode="view"]'),
    editModeBtn: document.querySelector('.mode-tab[data-mode="edit"]'),

    themeSelector: $('themeSelector'),
    exportBtn: $('exportBtn'),
    zipUpload: $('zipUpload'),
    loadingOverlay: $('loadingOverlay'),
    loadingText: $('loadingText'),
    viewContainer: $('viewContainer'),
};

// ===== 状态 =====
let currentProjectId = null;
let currentFilename = null;
let currentMode = 'view';
let isEditDirty = false;

// 保存当前编辑内容（供 draft.js 调用）
window._saveCurrentEdit = function() {
    if (currentMode === 'edit' && currentProjectId && currentFilename) {
        const content = dom.editTextarea.value;
        updateProjectFile(currentProjectId, currentFilename, content, true);
        return true;
    }
    return false;
};

// ===== 加载遮罩 =====
function showLoading(msg = '处理中...') {
    dom.loadingText.textContent = msg;
    dom.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    dom.loadingOverlay.classList.add('hidden');
}

// ===== 渲染项目列表 =====
function renderProjects() {
    const projects = getProjects();
    const container = dom.projectList;

    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="big-icon">📂</span>
                暂无项目<br />
                点击「＋」上传压缩包
            </div>
        `;
        return;
    }

    projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

    let html = '';
    for (const proj of projects) {
        const fileCount = Object.keys(proj.files || {}).length;
        const isActive = proj.id === currentProjectId ? 'active' : '';
        const time = proj.lastModified ? new Date(proj.lastModified).toLocaleString() : '';

        html += `
            <div class="project-item ${isActive}" data-project-id="${proj.id}">
                <span class="project-name">${escapeHtml(proj.name)}</span>
                <div class="project-meta">
                    <span class="count">${fileCount} 个文件</span>
                    <span class="time">${time}</span>
                </div>
                <button class="delete-project" data-project-id="${proj.id}" title="删除项目">✕</button>
            </div>
        `;
    }
    container.innerHTML = html;

    container.querySelectorAll('.project-item').forEach(el => {
        el.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-project')) return;
            const id = this.dataset.projectId;
            if (id) selectProject(id);
        });
    });

    container.querySelectorAll('.delete-project').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.projectId;
            if (id && confirm(`确定要删除项目「${getProject(id)?.name || id}」吗？`)) {
                deleteProject(id);
                if (currentProjectId === id) {
                    currentProjectId = null;
                    currentFilename = null;
                    clearEditor();
                }
                renderProjects();
                updateMainPanel();
                showDraftReminder();
            }
        });
    });
}

// ===== 选择项目 =====
function selectProject(projectId) {
    const project = getProject(projectId);
    if (!project) return;

    if (currentMode === 'edit' && currentProjectId && currentFilename) {
        const content = dom.editTextarea.value;
        updateProjectFile(currentProjectId, currentFilename, content, true);
    }

    currentProjectId = projectId;
    const fileList = project.fileList || Object.keys(project.files || {});
    currentFilename = fileList.length > 0 ? fileList[0] : null;

    renderProjects();
    updateMainPanel();

    if (currentMode === 'edit') {
        setMode('view');
    } else {
        renderContent();
    }
}

// ===== 更新主面板 =====
function updateMainPanel() {
    const project = currentProjectId ? getProject(currentProjectId) : null;

    if (project) {
        dom.projectName.textContent = project.name;
        const fileCount = Object.keys(project.files || {}).length;
        dom.fileCount.textContent = `${fileCount} 个文件`;

        const fileList = project.fileList || Object.keys(project.files || {});
        let html = '';
        for (const name of fileList) {
            const isActive = name === currentFilename ? 'active' : '';
            const isModified = project.files[name] && project.files[name].modified ? 'modified' : '';
            html += `<span class="file-chip ${isActive} ${isModified}" data-filename="${name}">${escapeHtml(name)}</span>`;
        }
        dom.fileListContainer.innerHTML = html || '<span style="color:#8a7a6a;">无文件</span>';

        dom.fileListContainer.querySelectorAll('.file-chip').forEach(el => {
            el.addEventListener('click', function() {
                const name = this.dataset.filename;
                if (name && project.files[name]) {
                    selectFile(name);
                }
            });
        });

        dom.statusBar.textContent = `项目: ${project.name} | 文件: ${fileCount} 个`;
    } else {
        dom.projectName.textContent = '未选择项目';
        dom.fileCount.textContent = '0 个文件';
        dom.fileListContainer.innerHTML = '<span style="color:#8a7a6a;">请从左侧选择一个项目</span>';
        dom.statusBar.textContent = '就绪';
    }

    if (currentProjectId && currentFilename) {
        renderContent();
    } else {
        clearEditor();
    }
}

// ===== 选择文件 =====
function selectFile(filename) {
    const project = currentProjectId ? getProject(currentProjectId) : null;
    if (!project || !project.files[filename]) return;

    if (currentMode === 'edit' && currentProjectId && currentFilename) {
        const content = dom.editTextarea.value;
        updateProjectFile(currentProjectId, currentFilename, content, true);
    }

    currentFilename = filename;
    updateMainPanel();
    renderContent();
}

// ===== 渲染内容 =====
function renderContent() {
    const project = currentProjectId ? getProject(currentProjectId) : null;
    if (!project || !currentFilename || !project.files[currentFilename]) {
        clearEditor();
        return;
    }

    const content = project.files[currentFilename].content || '';
    dom.editTextarea.value = content;

    const html = renderMarkdown(content);
    dom.markdownBody.innerHTML = html;

    const isModified = project.files[currentFilename].modified;
    dom.fileStatus.textContent = isModified ? '✏️ 已修改' : '';
    dom.fileStatus.className = 'mode-status' + (isModified ? ' saved' : '');

    const scrollKey = `${currentProjectId}_${currentFilename}`;
    restoreScrollPosition(dom.viewContainer, scrollKey);

    updateScrollInfo();
    updateFileListHighlight();
}

// ===== 清空编辑器 =====
function clearEditor() {
    dom.markdownBody.innerHTML = `<p style="color:#8a7a6a;text-align:center;padding:40px 0;">📂 请从左侧选择一个项目，然后点击文件</p>`;
    dom.editTextarea.value = '';
    dom.fileStatus.textContent = '';
    dom.fileStatus.className = 'mode-status';
}

// ===== 更新文件列表高亮 =====
function updateFileListHighlight() {
    dom.fileListContainer.querySelectorAll('.file-chip').forEach(el => {
        const name = el.dataset.filename;
        el.classList.toggle('active', name === currentFilename);
    });
}

// ===== 滚动信息 =====
function updateScrollInfo() {
    const el = dom.viewContainer;
    if (el) {
        const line = Math.floor(el.scrollTop / 20) + 1;
        dom.scrollInfo.textContent = `行 ${line}`;
    }
}

// ===== 设置模式 =====
function setMode(mode) {
    currentMode = mode;

    dom.modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    if (mode === 'view') {
        dom.viewContainer.classList.remove('hidden');
        dom.editContainer.classList.add('hidden');
        if (currentProjectId && currentFilename) {
            const scrollKey = `${currentProjectId}_${currentFilename}`;
            restoreScrollPosition(dom.viewContainer, scrollKey);
        }
    } else {
        dom.viewContainer.classList.add('hidden');
        dom.editContainer.classList.remove('hidden');
        if (currentProjectId && currentFilename) {
            const project = getProject(currentProjectId);
            if (project && project.files[currentFilename]) {
                dom.editTextarea.value = project.files[currentFilename].content || '';
                const cursorKey = `${currentProjectId}_${currentFilename}`;
                restoreCursorPosition(dom.editTextarea, cursorKey);
            }
        }
        dom.editTextarea.focus();
    }

    try {
        localStorage.setItem('mdEditor_mode', mode);
    } catch (e) { /* ignore */ }
}

// ===== 主题切换 =====
function initThemeSelector() {
    const saved = getSavedTheme();
    dom.themeSelector.value = saved;
    applyTheme(saved);

    dom.themeSelector.addEventListener('change', function() {
        const theme = this.value;
        applyTheme(theme);
        if (currentProjectId && currentFilename) {
            const project = getProject(currentProjectId);
            if (project && project.files[currentFilename]) {
                const content = project.files[currentFilename].content || '';
                const html = renderMarkdown(content);
                dom.markdownBody.innerHTML = html;
            }
        }
    });
}

// ===== 导出项目 =====
async function exportCurrentProject() {
    if (!currentProjectId) {
        alert('请先选择一个项目');
        return;
    }

    const project = getProject(currentProjectId);
    if (!project) {
        alert('项目不存在');
        return;
    }

    if (currentMode === 'edit' && currentProjectId && currentFilename) {
        const content = dom.editTextarea.value;
        updateProjectFile(currentProjectId, currentFilename, content, true);
    }

    showLoading('正在打包...');

    try {
        const files = {};
        for (const [name, data] of Object.entries(project.files)) {
            files[name] = data.content;
        }
        const blob = await packProjectToZip(files, `${project.name}_export.zip`);
        saveAs(blob, `${project.name}_export.zip`);

        clearProjectModifiedFlags(currentProjectId);

        renderProjects();
        updateMainPanel();

        hideLoading();
        dom.statusBar.textContent = '✅ 导出成功，修改标记已清除';
        setTimeout(() => {
            dom.statusBar.textContent = `项目: ${project.name} | 文件: ${Object.keys(project.files).length} 个`;
        }, 2000);
    } catch (e) {
        console.error('导出失败:', e);
        hideLoading();
        alert('❌ 导出失败: ' + e.message);
    }
}

// ===== 工具函数 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 滚动监听 =====
function initScrollListener() {
    dom.viewContainer.addEventListener('scroll', function() {
        if (currentProjectId && currentFilename) {
            const scrollKey = `${currentProjectId}_${currentFilename}`;
            saveScrollPosition(this, scrollKey);
            updateScrollInfo();
        }
    });
}

// ===== 编辑框监听 =====
function initEditListener() {
    dom.editTextarea.addEventListener('scroll', function() {
        if (currentProjectId && currentFilename && currentMode === 'edit') {
            const cursorKey = `${currentProjectId}_${currentFilename}`;
            saveCursorPosition(this, cursorKey);
        }
    });

    dom.editTextarea.addEventListener('click', function() {
        if (currentProjectId && currentFilename && currentMode === 'edit') {
            const cursorKey = `${currentProjectId}_${currentFilename}`;
            saveCursorPosition(this, cursorKey);
        }
    });

    dom.editTextarea.addEventListener('keyup', function() {
        if (currentProjectId && currentFilename && currentMode === 'edit') {
            const cursorKey = `${currentProjectId}_${currentFilename}`;
            saveCursorPosition(this, cursorKey);
        }
    });
}

// ===== 处理压缩包上传 =====
async function handleZipUpload(file) {
    showLoading('正在解压压缩包...');

    try {
        const result = await parseZipFile(file);

        const project = upsertProject(
            result.projectId,
            result.projectName,
            result.files,
            result.fileList
        );

        currentProjectId = project.id;
        const fileList = project.fileList || Object.keys(project.files || {});
        currentFilename = fileList.length > 0 ? fileList[0] : null;

        renderProjects();
        updateMainPanel();
        setMode('view');

        hideLoading();
        dom.statusBar.textContent = `✅ 已加载项目「${project.name}」，${Object.keys(project.files).length} 个文件`;
        showDraftReminder();

    } catch (e) {
        console.error('上传失败:', e);
        hideLoading();
        alert('❌ 处理压缩包失败: ' + e.message);
    }
}

// ===== 初始化 =====
function initUI() {
    try {
        const savedMode = localStorage.getItem('mdEditor_mode');
        if (savedMode === 'edit') {
            currentMode = 'edit';
        }
    } catch (e) { /* ignore */ }

    initThemeSelector();
    renderProjects();

    const projects = getProjects();
    if (projects.length > 0) {
        currentProjectId = projects[0].id;
        const fileList = projects[0].fileList || Object.keys(projects[0].files || {});
        currentFilename = fileList.length > 0 ? fileList[0] : null;
        updateMainPanel();
        setMode(currentMode);
    } else {
        updateMainPanel();
        setMode('view');
    }

    // 模式切换
    dom.viewModeBtn.addEventListener('click', function() {
        if (currentMode === 'view') return;
        if (currentProjectId && currentFilename) {
            const content = dom.editTextarea.value;
            updateProjectFile(currentProjectId, currentFilename, content, true);
        }
        setMode('view');
        renderContent();
    });

    dom.editModeBtn.addEventListener('click', function() {
        if (currentMode === 'edit') return;
        setMode('edit');
        if (currentProjectId && currentFilename) {
            const project = getProject(currentProjectId);
            if (project && project.files[currentFilename]) {
                dom.editTextarea.value = project.files[currentFilename].content || '';
                const cursorKey = `${currentProjectId}_${currentFilename}`;
                restoreCursorPosition(dom.editTextarea, cursorKey);
            }
        }
    });

    dom.exportBtn.addEventListener('click', exportCurrentProject);

    dom.newProjectBtn.addEventListener('click', function() {
        dom.zipUpload.click();
    });

    dom.zipUpload.addEventListener('change', async function(e) {
        const file = this.files[0];
        if (file) {
            await handleZipUpload(file);
        }
        this.value = '';
    });

    dom.clearAllBtn.addEventListener('click', function() {
        if (confirm('⚠️ 确定要清除所有项目吗？此操作不可恢复！')) {
            clearAllProjects();
            currentProjectId = null;
            currentFilename = null;
            renderProjects();
            updateMainPanel();
            clearEditor();
            dom.statusBar.textContent = '已清除所有项目';
            showDraftReminder();
        }
    });

    // 导出草稿
    document.getElementById('exportDraftBtn')?.addEventListener('click', function() {
        exportDraft();
        showDraftReminder();
    });

    // 导入草稿
    document.getElementById('importDraftInput')?.addEventListener('change', async function(e) {
        const file = this.files[0];
        if (!file) return;

        showLoading('正在导入草稿...');
        try {
            const projects = await importDraft(file);
            renderProjects();
            if (projects.length > 0) {
                currentProjectId = projects[0].id;
                const fileList = projects[0].fileList || Object.keys(projects[0].files || {});
                currentFilename = fileList.length > 0 ? fileList[0] : null;
                updateMainPanel();
                setMode('view');
            }
            hideLoading();
            dom.statusBar.textContent = `✅ 成功导入 ${projects.length} 个项目`;
            showDraftReminder();
        } catch (e) {
            hideLoading();
            alert('❌ 导入失败: ' + e.message);
        }
        this.value = '';
    });

    document.getElementById('importDraftLabel')?.addEventListener('click', function() {
        document.getElementById('importDraftInput')?.click();
    });

    // 拖拽上传
    document.addEventListener('dragover', function(e) {
        e.preventDefault();
        document.body.classList.add('drop-highlight');
    });

    document.addEventListener('dragleave', function(e) {
        e.preventDefault();
        document.body.classList.remove('drop-highlight');
    });

    document.addEventListener('drop', async function(e) {
        e.preventDefault();
        document.body.classList.remove('drop-highlight');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.name.toLowerCase().endsWith('.zip')) {
                await handleZipUpload(file);
            } else {
                alert('请拖拽 .zip 压缩包文件');
            }
        }
    });

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            if (currentMode === 'edit' && currentProjectId && currentFilename) {
                e.preventDefault();
                const content = dom.editTextarea.value;
                updateProjectFile(currentProjectId, currentFilename, content, true);
                dom.fileStatus.textContent = '💾 已保存';
                dom.fileStatus.className = 'mode-status saved';
                setTimeout(() => {
                    const project = getProject(currentProjectId);
                    if (project && project.files[currentFilename]) {
                        dom.fileStatus.textContent = project.files[currentFilename].modified ? '✏️ 已修改' : '';
                        dom.fileStatus.className = 'mode-status' + (project.files[currentFilename].modified ?
                            ' saved' : '');
                    }
                }, 1500);
            }
        }
    });

    initScrollListener();
    initEditListener();

    // 延迟检查草稿提醒
    setTimeout(showDraftReminder, 2000);
}

document.addEventListener('DOMContentLoaded', initUI);
