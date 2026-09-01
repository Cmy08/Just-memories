// ============================================================
// storage.js — 多项目管理（缓存最多3个项目）
// ============================================================

const STORAGE_KEY = 'mdEditor_v2_projects';
const MAX_PROJECTS = 3;

/**
 * 项目数据结构：
 * {
 *   id: string (压缩包名称或时间戳),
 *   name: string,
 *   files: { filename: { content, modified } },
 *   lastModified: number (时间戳),
 *   fileList: [filename, ...] (保持顺序)
 * }
 */

/** 获取所有项目列表 */
function getProjects() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                return data;
            }
        }
    } catch (e) {
        console.warn('读取项目列表失败:', e);
    }
    return [];
}

/** 保存项目列表 */
function saveProjects(projects) {
    try {
        // 限制最大项目数
        if (projects.length > MAX_PROJECTS) {
            // 按最后修改时间排序，保留最新的
            projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
            projects = projects.slice(0, MAX_PROJECTS);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
        return true;
    } catch (e) {
        console.warn('保存项目列表失败:', e);
        return false;
    }
}

/** 获取单个项目（通过 ID） */
function getProject(projectId) {
    const projects = getProjects();
    return projects.find(p => p.id === projectId) || null;
}

/** 创建或更新项目 */
function upsertProject(projectId, projectName, files, fileList) {
    const projects = getProjects();

    // 检查是否已存在
    const existingIndex = projects.findIndex(p => p.id === projectId);

    const now = Date.now();
    const projectData = {
        id: projectId,
        name: projectName || projectId,
        files: files || {},
        fileList: fileList || Object.keys(files || {}),
        lastModified: now
    };

    if (existingIndex >= 0) {
        // 更新已有项目，保留修改标记
        const existing = projects[existingIndex];
        // 合并文件：保留已有文件的修改标记，新增文件
        const mergedFiles = { ...existing.files };
        for (const [key, value] of Object.entries(projectData.files)) {
            if (mergedFiles[key]) {
                // 如果已存在，且新内容与旧内容不同，保留用户的修改标记
                if (mergedFiles[key].content !== value.content) {
                    mergedFiles[key].content = value.content;
                    // 如果用户已经修改过，保留 modified 标记
                    if (!mergedFiles[key].modified) {
                        mergedFiles[key].modified = false;
                    }
                }
            } else {
                mergedFiles[key] = value;
            }
        }
        // 更新文件列表顺序
        const mergedFileList = [...new Set([...projectData.fileList, ...existing.fileList])];
        projects[existingIndex] = {
            ...existing,
            files: mergedFiles,
            fileList: mergedFileList,
            lastModified: now
        };
    } else {
        // 新项目
        projects.push(projectData);
    }

    // 限制数量
    if (projects.length > MAX_PROJECTS) {
        projects.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
        projects.length = MAX_PROJECTS;
    }

    saveProjects(projects);
    return projectData;
}

/** 删除项目 */
function deleteProject(projectId) {
    const projects = getProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    return saveProjects(filtered);
}

/** 清除所有项目 */
function clearAllProjects() {
    localStorage.removeItem(STORAGE_KEY);
}

/** 获取项目中的文件内容 */
function getProjectFileContent(projectId, filename) {
    const project = getProject(projectId);
    if (!project) return null;
    return project.files[filename] || null;
}

/** 更新项目中的文件内容 */
function updateProjectFile(projectId, filename, content, markModified = true) {
    const projects = getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex < 0) return false;

    const project = projects[projectIndex];
    if (!project.files[filename]) {
        project.files[filename] = { content: '', modified: false };
    }
    project.files[filename].content = content;
    if (markModified) {
        project.files[filename].modified = true;
    }
    project.lastModified = Date.now();

    // 如果文件不在列表中，添加
    if (!project.fileList.includes(filename)) {
        project.fileList.push(filename);
    }

    saveProjects(projects);
    return true;
}

/** 清除项目的所有修改标记（导出后调用） */
function clearProjectModifiedFlags(projectId) {
    const project = getProject(projectId);
    if (!project) return false;
    for (const key in project.files) {
        if (project.files[key]) {
            project.files[key].modified = false;
        }
    }
    project.lastModified = Date.now();
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index >= 0) {
        projects[index] = project;
        saveProjects(projects);
        return true;
    }
    return false;
}

/** 导出项目数据为 JSZip 兼容格式 */
function exportProjectFiles(projectId) {
    const project = getProject(projectId);
    if (!project) return null;
    const result = {};
    for (const [key, value] of Object.entries(project.files)) {
        result[key] = value.content;
    }
    return result;
}