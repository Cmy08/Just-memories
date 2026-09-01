// ============================================================
// zip-handler.js — 压缩包解压与打包
// ============================================================

/** 解压压缩包，返回 { projectId, projectName, files, fileList } */
async function parseZipFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const files = {};
        const fileList = [];

        for (const [path, zipEntry] of Object.entries(zip.files)) {
            if (zipEntry.dir) continue;
            if (!path.toLowerCase().endsWith('.md')) continue;

            try {
                const content = await zipEntry.async('string');
                // 使用相对路径作为文件名
                const filename = path;
                files[filename] = {
                    content: content,
                    modified: false
                };
                fileList.push(filename);
            } catch (e) {
                console.warn('读取文件失败:', path, e);
            }
        }

        // 生成项目ID（使用文件名+时间戳）
        const baseName = file.name.replace(/\.zip$/i, '') || '未命名项目';
        const timestamp = Date.now();
        const projectId = `${baseName}_${timestamp}`;

        return {
            projectId,
            projectName: baseName,
            files,
            fileList
        };
    } catch (e) {
        console.error('解压失败:', e);
        throw e;
    }
}

/** 打包项目为 Blob */
async function packProjectToZip(projectFiles, zipName = 'export.zip') {
    try {
        const zip = new JSZip();
        for (const [filename, content] of Object.entries(projectFiles)) {
            zip.file(filename, content);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        return blob;
    } catch (e) {
        console.error('打包失败:', e);
        throw e;
    }
}