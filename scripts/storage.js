// ============================================================
// storage.js — 多项目管理（无数量限制）
// ============================================================

const STORAGE_KEY = 'mdEditor_v2_projects';

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
        const existing = projects[existingIndex];
        const mergedFiles = { ...existing.files };
        for (const [key, value] of Object.entries(projectData.files)) {
            if (mergedFiles[key]) {
                if (mergedFiles[key].content !== value.content) {
                    mergedFiles[key].content = value.content;
                    if (!mergedFiles[key].modified) {
                        mergedFiles[key].modified = false;
                    }
                }
            } else {
                mergedFiles[key] = value;
            }
        }
        const mergedFileList = [...new Set([...projectData.fileList, ...existing.fileList])];
        projects[existingIndex] = {
            ...existing,
            files: mergedFiles,
            fileList: mergedFileList,
            lastModified: now
        };
    } else {
        projects.push(projectData);
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
