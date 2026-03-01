// ==========================================
// STATE
// ==========================================
const STORAGE_KEY = 'quizBank';
const CONFIG_KEY = 'quizConfig';

let pendingImport = null; // data đang chờ xác nhận import
let currentPage = 1;
const PAGE_SIZE = 20;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadStatsAndUI();
    loadConfigUI();
    setupDragDrop();
});

// ==========================================
// LOCALSTORAGE HELPERS
// ==========================================
function getBank() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}
function setBank(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    loadStatsAndUI();
}
function getConfig() {
    const defaults = {
        title: 'ÔN TẬP CUỐI KỲ: TƯ DUY TÍNH TOÁN',
        org: 'Khoa Công nghệ thông tin - UET',
        count: 30,
        shuffleOptions: true,
        shuffleQuestions: true,
        showExplain: true
    };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(CONFIG_KEY)) }; }
    catch { return defaults; }
}
function setConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// ==========================================
// PANEL SWITCHING
// ==========================================
function switchPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
    document.getElementById(`panel-${name}`).classList.add('active');

    const labels = { dashboard: '📊', import: '📥', bank: '🗃️', config: '⚙️', export: '💾' };
    document.querySelectorAll('.sidebar-item').forEach(s => {
        if (s.textContent.includes(Object.values(labels).find(l => s.querySelector('.icon')?.textContent === l) || '___')) {
            // fallback match
        }
    });
    // Simpler active approach
    const items = document.querySelectorAll('.sidebar-item');
    const map = ['dashboard', 'compose', 'import', 'bank', 'config', 'export'];
    map.forEach((m, i) => { if (m === name && items[i]) items[i].classList.add('active'); });

    // Refresh data for specific panels
    if (name === 'bank') renderBankTable();
    if (name === 'export') refreshExport();
    if (name === 'config') loadConfigUI();
    if (name === 'dashboard') loadStatsAndUI();
}

// ==========================================
// IMPORT: Tab switching
// ==========================================
function switchImportTab(tab) {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('import-file').style.display = tab === 'file' ? 'block' : 'none';
    document.getElementById('import-paste').style.display = tab === 'paste' ? 'block' : 'none';
}

// ==========================================
// IMPORT: File upload
// ==========================================
function setupDragDrop() {
    const zone = document.getElementById('upload-zone');
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.json')) readFile(file);
        else toast('Chỉ hỗ trợ file .json', 'error');
    });
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) readFile(file);
}

function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            processImportData(data);
        } catch (err) {
            toast('Lỗi parse JSON: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ==========================================
// IMPORT: Paste JSON
// ==========================================
function importFromPaste() {
    const raw = document.getElementById('json-paste').value.trim();
    if (!raw) { toast('Vui lòng dán JSON vào ô nhập', 'error'); return; }
    try {
        const data = JSON.parse(raw);
        processImportData(data);
    } catch (err) {
        toast('Lỗi parse JSON: ' + err.message, 'error');
    }
}

// ==========================================
// IMPORT: Process & Validate
// ==========================================
function processImportData(data) {
    // Accept array or single object
    let arr = Array.isArray(data) ? data : [data];

    // Validate
    const errors = [];
    arr.forEach((item, i) => {
        if (!item.q) errors.push(`Câu ${i + 1}: thiếu "q" (nội dung câu hỏi)`);
        if (!item.options || !Array.isArray(item.options) || item.options.length < 2)
            errors.push(`Câu ${i + 1}: thiếu/sai "options" (cần ít nhất 2 đáp án)`);
        if (item.correct === undefined || item.correct === null)
            errors.push(`Câu ${i + 1}: thiếu "correct" (index đáp án đúng)`);
    });

    if (errors.length > 0) {
        toast(`Dữ liệu không hợp lệ! ${errors.length} lỗi`, 'error');
        alert('Lỗi validate:\n\n' + errors.join('\n'));
        return;
    }

    // Normalize
    arr = arr.map((item, i) => ({
        id: item.id || (i + 1),
        q: item.q,
        code: item.code || '',
        type: item.type || 'single',
        options: item.options,
        correct: item.correct,
        explain: item.explain || '',
        tags: item.tags || []
    }));

    pendingImport = arr;
    showPreview(arr);
    toast(`Đã tải ${arr.length} câu hỏi — kiểm tra và xác nhận`, 'info');
}

function showPreview(arr) {
    const panel = document.getElementById('import-preview');
    const tbody = document.querySelector('#preview-table tbody');
    const countEl = document.getElementById('preview-count');

    countEl.textContent = arr.length;
    tbody.innerHTML = arr.slice(0, 30).map((item, i) => `
        <tr>
            <td>${i + 1}</td>
            <td class="q-text">${escapeHtml(item.q)}</td>
            <td>${item.options.length} đáp án</td>
            <td>${item.code ? '<span class="has-code">✔ Code</span>' : '—'}</td>
        </tr>
    `).join('');
    if (arr.length > 30) {
        tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-dim)">... và ${arr.length - 30} câu nữa</td></tr>`;
    }
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth' });
}

function cancelPreview() {
    pendingImport = null;
    document.getElementById('import-preview').style.display = 'none';
}

function confirmImport() {
    if (!pendingImport) return;

    const overwrite = document.getElementById('toggle-overwrite').classList.contains('on');
    const autoId = document.getElementById('toggle-autoid').classList.contains('on');

    let bank = overwrite ? [] : getBank();

    let data = [...pendingImport];
    if (autoId) {
        const startId = bank.length + 1;
        data = data.map((item, i) => ({ ...item, id: startId + i }));
    }

    bank = bank.concat(data);
    setBank(bank);

    toast(`✅ Đã import ${data.length} câu hỏi thành công!`, 'success');
    pendingImport = null;
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('json-paste').value = '';
    document.getElementById('file-input').value = '';
}

// ==========================================
// BANK: Render table
// ==========================================
function renderBankTable() {
    const bank = getBank();
    const search = (document.getElementById('search-input')?.value || '').toLowerCase();
    const filtered = bank.filter(item => {
        if (!search) return true;
        const text = (item.q + ' ' + (item.code || '') + ' ' + (item.tags || []).join(' ')).toLowerCase();
        return text.includes(search);
    });

    document.getElementById('filtered-count').textContent = filtered.length;

    const tbody = document.getElementById('bank-tbody');
    const emptyEl = document.getElementById('bank-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        document.getElementById('bank-pagination').innerHTML = '';
        return;
    }
    emptyEl.style.display = 'none';

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map((item, i) => `
        <tr>
            <td>${item.id || start + i + 1}</td>
            <td class="q-text" title="${escapeHtml(item.q)}">${escapeHtml(item.q)}</td>
            <td>${item.options.length} ${item.code ? '<span class="has-code">💻</span>' : ''}</td>
            <td>${(item.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-ghost btn-sm" onclick="viewQuestion(${bank.indexOf(item)})">👁️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${bank.indexOf(item)})">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');

    // Pagination
    const pagEl = document.getElementById('bank-pagination');
    pagEl.innerHTML = `
        <span class="page-info">Trang ${currentPage}/${totalPages} (${filtered.length} câu)</span>
        <div class="page-btns">
            <button class="btn btn-ghost btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="currentPage--;renderBankTable()">◀</button>
            <button class="btn btn-ghost btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="currentPage++;renderBankTable()">▶</button>
        </div>
    `;
}

function filterQuestions() {
    currentPage = 1;
    renderBankTable();
}

// ==========================================
// BANK: View question detail
// ==========================================
function viewQuestion(idx) {
    const bank = getBank();
    const item = bank[idx];
    if (!item) return;

    document.getElementById('modal-title').textContent = `Câu ${item.id}: ${item.q}`;
    let body = '';
    if (item.code) body += `<div class="detail-code">${escapeHtml(item.code)}</div>`;
    body += '<ul class="detail-options">';
    item.options.forEach((opt, i) => {
        const isCorrect = Array.isArray(item.correct) ? item.correct.includes(i) : item.correct === i;
        body += `<li class="${isCorrect ? 'correct-opt' : ''}">${isCorrect ? '✅ ' : ''}${escapeHtml(opt)}</li>`;
    });
    body += '</ul>';
    if (item.explain) body += `<p style="margin-top:12px;font-size:0.88em;color:var(--text-dim)">💡 ${escapeHtml(item.explain)}</p>`;
    if (item.tags && item.tags.length) {
        body += `<div style="margin-top:12px">${item.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</div>`;
    }
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-detail').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-detail').classList.remove('show');
}
document.getElementById('modal-detail').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// ==========================================
// BANK: Delete
// ==========================================
function deleteQuestion(idx) {
    if (!confirm('Xóa câu hỏi này?')) return;
    const bank = getBank();
    bank.splice(idx, 1);
    setBank(bank);
    renderBankTable();
    toast('Đã xóa câu hỏi', 'success');
}

function deleteAllQuestions() {
    const bank = getBank();
    if (bank.length === 0) { toast('Ngân hàng đã trống', 'info'); return; }
    if (!confirm(`Xóa tất cả ${bank.length} câu hỏi? Hành động này không thể hoàn tác.`)) return;
    setBank([]);
    renderBankTable();
    toast('Đã xóa toàn bộ ngân hàng', 'success');
}

// ==========================================
// CONFIG
// ==========================================
function loadConfigUI() {
    const cfg = getConfig();
    const bank = getBank();

    document.getElementById('cfg-title').value = cfg.title;
    document.getElementById('cfg-org').value = cfg.org;
    document.getElementById('cfg-total').textContent = bank.length;

    const slider = document.getElementById('cfg-count');
    const maxVal = Math.max(bank.length, 1);
    slider.max = maxVal;
    document.getElementById('cfg-max-label').textContent = maxVal;
    slider.value = Math.min(cfg.count, maxVal);
    document.getElementById('cfg-count-display').textContent = slider.value;

    toggleState('cfg-shuffle', cfg.shuffleOptions);
    toggleState('cfg-shuffleq', cfg.shuffleQuestions);
    toggleState('cfg-explain', cfg.showExplain);
}

function updateSlider() {
    const val = document.getElementById('cfg-count').value;
    document.getElementById('cfg-count-display').textContent = val;
}

function toggleState(id, state) {
    const el = document.getElementById(id);
    if (state) el.classList.add('on'); else el.classList.remove('on');
}

function saveConfig() {
    const cfg = {
        title: document.getElementById('cfg-title').value || 'Bài thi trắc nghiệm',
        org: document.getElementById('cfg-org').value || '',
        count: parseInt(document.getElementById('cfg-count').value),
        shuffleOptions: document.getElementById('cfg-shuffle').classList.contains('on'),
        shuffleQuestions: document.getElementById('cfg-shuffleq').classList.contains('on'),
        showExplain: document.getElementById('cfg-explain').classList.contains('on')
    };
    setConfig(cfg);
    toast('💾 Đã lưu cấu hình bài thi', 'success');
}

// ==========================================
// EXPORT
// ==========================================
function refreshExport() {
    const bank = getBank();
    document.getElementById('export-count').textContent = bank.length;
    document.getElementById('export-json').value = JSON.stringify(bank, null, 2);
}

function exportBank() {
    const bank = getBank();
    if (bank.length === 0) { toast('Ngân hàng trống', 'error'); return; }
    downloadJSON(bank, 'quiz-bank.json');
    toast(`📦 Đã tải ${bank.length} câu hỏi`, 'success');
}

function exportConfig() {
    const cfg = getConfig();
    downloadJSON(cfg, 'quiz-config.json');
    toast('📦 Đã tải cấu hình', 'success');
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function copyExportJSON() {
    const el = document.getElementById('export-json');
    el.select();
    document.execCommand('copy');
    toast('📋 Đã copy JSON', 'success');
}

// ==========================================
// STATS / DASHBOARD
// ==========================================
function loadStatsAndUI() {
    const bank = getBank();
    const cfg = getConfig();

    // Stats
    document.getElementById('stat-total').textContent = bank.length;
    document.getElementById('stat-code').textContent = bank.filter(q => q.code).length;
    document.getElementById('stat-exam').textContent = Math.min(cfg.count, bank.length);
    document.getElementById('sidebar-count').textContent = bank.length;

    // Tags
    const tagMap = {};
    bank.forEach(q => (q.tags || []).forEach(t => { tagMap[t] = (tagMap[t] || 0) + 1; }));
    const tags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
    document.getElementById('stat-tags').textContent = tags.length;

    const tagDiv = document.getElementById('tag-distribution');
    if (tags.length === 0) {
        tagDiv.innerHTML = '<span class="empty-state" style="padding:20px;width:100%"><p>Chưa có tag nào</p></span>';
    } else {
        tagDiv.innerHTML = tags.map(([tag, count]) =>
            `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:var(--surface2);border-radius:8px;font-size:0.85em;">
                <span class="tag">${tag}</span>
                <strong>${count}</strong>
            </span>`
        ).join('');
    }
}

// ==========================================
// COMPOSE: Tab switching
// ==========================================
function switchComposeTab(tab) {
    const tabs = document.querySelectorAll('#panel-compose .import-tab');
    tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('compose-form').style.display = tab === 'form' ? 'block' : 'none';
    document.getElementById('compose-bulk').style.display = tab === 'bulk' ? 'block' : 'none';
}

// ==========================================
// COMPOSE: Form - Add/Remove options
// ==========================================
function addOption() {
    const container = document.getElementById('cmp-options');
    const idx = container.querySelectorAll('.compose-opt-row').length;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[idx] || (idx + 1);
    const row = document.createElement('div');
    row.className = 'compose-opt-row';
    row.innerHTML = `
        <input type="radio" name="cmp-correct" value="${idx}">
        <input type="text" placeholder="Đáp án ${letter}" class="cmp-opt-input">
        <button class="btn btn-danger btn-sm" onclick="removeOption(this)" title="Xóa">✕</button>
    `;
    container.appendChild(row);
}

function removeOption(btn) {
    const container = document.getElementById('cmp-options');
    if (container.querySelectorAll('.compose-opt-row').length <= 2) {
        toast('Cần ít nhất 2 đáp án', 'error');
        return;
    }
    btn.closest('.compose-opt-row').remove();
    // Re-index radio values
    container.querySelectorAll('.compose-opt-row').forEach((row, i) => {
        row.querySelector('input[type="radio"]').value = i;
    });
}

// ==========================================
// COMPOSE: Form - Save question
// ==========================================
function saveComposedQuestion() {
    const q = document.getElementById('cmp-question').value.trim();
    if (!q) { toast('Vui lòng nhập nội dung câu hỏi', 'error'); return; }

    const optInputs = document.querySelectorAll('#cmp-options .cmp-opt-input');
    const options = Array.from(optInputs).map(inp => inp.value.trim());

    if (options.some(o => !o)) { toast('Vui lòng điền đầy đủ các đáp án', 'error'); return; }
    if (options.length < 2) { toast('Cần ít nhất 2 đáp án', 'error'); return; }

    const correctRadio = document.querySelector('input[name="cmp-correct"]:checked');
    const correct = correctRadio ? parseInt(correctRadio.value) : 0;

    const code = document.getElementById('cmp-code').value.trim();
    const explain = document.getElementById('cmp-explain').value.trim();
    const tagsRaw = document.getElementById('cmp-tags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t) : [];

    const bank = getBank();
    const newId = bank.length + 1;

    const question = {
        id: newId,
        q: q,
        code: code,
        type: 'single',
        options: options,
        correct: correct,
        explain: explain,
        tags: tags
    };

    bank.push(question);
    setBank(bank);
    toast(`✅ Đã lưu câu hỏi #${newId}`, 'success');
    return true;
}

function saveAndNewQuestion() {
    if (saveComposedQuestion()) {
        clearComposeForm();
        document.getElementById('cmp-question').focus();
        // Show counter
        const bank = getBank();
        const counter = document.getElementById('cmp-saved-count');
        counter.textContent = `✅ Đã lưu ${bank.length} câu vào ngân hàng`;
        counter.style.display = 'block';
    }
}

function clearComposeForm() {
    document.getElementById('cmp-question').value = '';
    document.getElementById('cmp-code').value = '';
    document.getElementById('cmp-explain').value = '';
    document.getElementById('cmp-tags').value = '';

    // Reset options to 4 default
    const container = document.getElementById('cmp-options');
    const letters = ['A', 'B', 'C', 'D'];
    container.innerHTML = letters.map((l, i) => `
        <div class="compose-opt-row">
            <input type="radio" name="cmp-correct" value="${i}" ${i === 0 ? 'checked' : ''}>
            <input type="text" placeholder="Đáp án ${l}" class="cmp-opt-input">
            <button class="btn btn-danger btn-sm" onclick="removeOption(this)" title="Xóa">✕</button>
        </div>
    `).join('');
}

// ==========================================
// COMPOSE: Bulk text parser
// ==========================================
function parseBulkText() {
    const raw = document.getElementById('bulk-text').value.trim();
    if (!raw) { toast('Vui lòng nhập text câu hỏi', 'error'); return; }

    // Split by blank lines (one or more empty lines between question blocks)
    const blocks = raw.split(/\n\s*\n/).filter(b => b.trim());
    const questions = [];
    const errors = [];

    blocks.forEach((block, blockIdx) => {
        const lines = block.trim().split('\n');
        let question = '';
        let code = '';
        let options = [];
        let correctLetter = '';
        let explain = '';
        let tags = [];
        let inCode = false;
        let codeLines = [];
        let questionLines = [];
        let foundFirstOption = false;

        lines.forEach(line => {
            const trimmed = line.trim();

            // Code block start
            if (trimmed.toLowerCase() === 'code:') {
                inCode = true;
                return;
            }
            // Code block end
            if (inCode && (trimmed.toLowerCase() === '/code' || trimmed.toLowerCase() === '/code:')) {
                inCode = false;
                code = codeLines.join('\n');
                return;
            }
            if (inCode) {
                codeLines.push(line);
                return;
            }

            // Option line: A. B. C. etc.
            const optMatch = trimmed.match(/^([A-Z])\.\s*(.+)/);
            if (optMatch) {
                foundFirstOption = true;
                options.push(optMatch[2]);
                return;
            }

            // Answer line
            const ansMatch = trimmed.match(/^[Đđ]áp\s*án\s*[:：]\s*([A-Za-z])/i);
            if (ansMatch) {
                correctLetter = ansMatch[1].toUpperCase();
                return;
            }

            // Explain line
            const expMatch = trimmed.match(/^[Gg]iải\s*thích\s*[:：]\s*(.+)/);
            if (expMatch) {
                explain = expMatch[1];
                return;
            }

            // Tags line
            const tagMatch = trimmed.match(/^[Tt]ags?\s*[:：]\s*(.+)/);
            if (tagMatch) {
                tags = tagMatch[1].split(',').map(t => t.trim()).filter(t => t);
                return;
            }

            // Otherwise it's part of the question text (before first option)
            if (!foundFirstOption && trimmed) {
                questionLines.push(trimmed);
            }
        });

        question = questionLines.join(' ');

        // Validate
        if (!question) { errors.push(`Câu ${blockIdx + 1}: thiếu nội dung câu hỏi`); return; }
        if (options.length < 2) { errors.push(`Câu ${blockIdx + 1}: cần ít nhất 2 đáp án (A. B. ...)`); return; }

        // Convert letter to index
        const correctIdx = correctLetter ? correctLetter.charCodeAt(0) - 65 : 0;
        if (correctIdx < 0 || correctIdx >= options.length) {
            errors.push(`Câu ${blockIdx + 1}: đáp án "${correctLetter}" không hợp lệ`);
            return;
        }

        questions.push({
            q: question,
            code: code,
            type: 'single',
            options: options,
            correct: correctIdx,
            explain: explain,
            tags: tags
        });
    });

    if (errors.length > 0) {
        toast(`Có ${errors.length} lỗi khi parse`, 'error');
        const resultDiv = document.getElementById('bulk-result');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="color:var(--danger);font-size:0.88em;margin-bottom:12px">
                <strong>❌ Lỗi:</strong><br>${errors.join('<br>')}
            </div>
        `;
        if (questions.length > 0) {
            resultDiv.innerHTML += `
                <div style="font-size:0.88em;color:var(--success);margin-bottom:12px">
                    ✅ Đã parse thành công ${questions.length} câu. Bạn có muốn import những câu hợp lệ?
                </div>
                <button class="btn btn-primary" onclick="importBulkQuestions()">📥 Import ${questions.length} câu hợp lệ</button>
            `;
        }
        window._bulkParsed = questions;
        return;
    }

    // All good — show success and import
    window._bulkParsed = questions;
    const resultDiv = document.getElementById('bulk-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div style="font-size:0.88em;color:var(--success);margin-bottom:12px">
            ✅ Đã parse thành công <strong>${questions.length}</strong> câu hỏi!
        </div>
        <button class="btn btn-primary" onclick="importBulkQuestions()">📥 Import ${questions.length} câu vào ngân hàng</button>
    `;
    toast(`✅ Đã parse ${questions.length} câu hỏi`, 'success');
}

function importBulkQuestions() {
    const questions = window._bulkParsed;
    if (!questions || questions.length === 0) return;

    const bank = getBank();
    const startId = bank.length + 1;
    questions.forEach((q, i) => { q.id = startId + i; });

    const newBank = bank.concat(questions);
    setBank(newBank);
    toast(`✅ Đã import ${questions.length} câu hỏi!`, 'success');

    // Clear
    document.getElementById('bulk-text').value = '';
    document.getElementById('bulk-result').style.display = 'none';
    window._bulkParsed = null;
}

// ==========================================
// UTILITIES
// ==========================================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
