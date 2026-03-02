// ==========================================
// CONSTANTS
// ==========================================
const STORAGE_KEY = 'quizBank';
const CONFIG_KEY = 'quizConfig';

// ==========================================
// STATE
// ==========================================
let examQuestions = [];
let correctCount = 0;
let wrongCount = 0;
let answeredCount = 0;
let showExplain = true;

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initExamPage();
});

function initExamPage() {
    const bank = getBank();
    const cfg = getConfig();

    // Update header
    document.getElementById('exam-title').textContent = '🚀 ' + cfg.title;
    document.getElementById('exam-org').textContent = cfg.org;
    document.title = cfg.title;

    if (bank.length === 0) {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('error-screen').style.display = 'block';
        return;
    }

    // Info
    const examCount = Math.min(cfg.count, bank.length);
    document.getElementById('info-total').textContent = bank.length;
    document.getElementById('info-exam').textContent = examCount;
    document.getElementById('info-shuffle').textContent = cfg.shuffleOptions ? '✔' : '✘';
    showExplain = cfg.showExplain;
}

// ==========================================
// START EXAM
// ==========================================
function startExam() {
    const bank = getBank();
    const cfg = getConfig();

    if (bank.length === 0) {
        alert('Ngân hàng câu hỏi trống!');
        return;
    }

    const examCount = Math.min(cfg.count, bank.length);

    // Random pick N questions
    examQuestions = pickRandom(bank, examCount);

    // Shuffle question order if enabled
    if (cfg.shuffleQuestions) {
        shuffleArray(examQuestions);
    }

    // Shuffle options if enabled
    if (cfg.shuffleOptions) {
        examQuestions = examQuestions.map(q => shuffleOptions(q));
    }

    // Reset state
    correctCount = 0;
    wrongCount = 0;
    answeredCount = 0;

    // Update UI
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('error-screen').style.display = 'none';
    document.getElementById('result-bar').style.display = 'none';
    document.getElementById('stats-bar').style.display = 'flex';
    document.getElementById('correct-count').textContent = '0';
    document.getElementById('wrong-count').textContent = '0';
    document.getElementById('progress').textContent = '0';
    document.getElementById('total-q').textContent = examCount;

    // Render
    renderQuiz();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// RENDER QUIZ
// ==========================================
function renderQuiz() {
    const root = document.getElementById('quiz-root');
    root.innerHTML = '';

    examQuestions.forEach((data, index) => {
        const card = document.createElement('div');
        card.className = 'q-card';
        card.id = `q-${index}`;
        card.style.animationDelay = `${index * 0.05}s`;

        const codeSection = data.code
            ? `<div class="q-code">${escapeHtml(data.code)}</div>`
            : '';

        const optionsHtml = data.options.map((opt, i) => `
            <div class="option" onclick="handleSelect(${index}, ${i})">${escapeHtml(String(opt))}</div>
        `).join('');

        const explainSection = data.explain
            ? `<div class="explanation" id="exp-${index}"><strong>💡 Giải thích:</strong> ${escapeHtml(data.explain)}</div>`
            : '';

        card.innerHTML = `
            <div class="q-header"><span>Câu ${index + 1}:</span> ${escapeHtml(data.q)}</div>
            ${codeSection}
            <div class="options">${optionsHtml}</div>
            ${explainSection}
        `;
        root.appendChild(card);
    });
}

// ==========================================
// HANDLE ANSWER
// ==========================================
function handleSelect(qIdx, optIdx) {
    const card = document.getElementById(`q-${qIdx}`);
    if (card.dataset.answered) return;

    const options = card.querySelectorAll('.option');
    const data = examQuestions[qIdx];
    const correctIdx = data.correct;
    const exp = document.getElementById(`exp-${qIdx}`);

    card.dataset.answered = 'true';
    answeredCount++;
    document.getElementById('progress').textContent = answeredCount;

    // Lock all options
    options.forEach(opt => opt.classList.add('locked'));

    if (optIdx === correctIdx) {
        options[optIdx].classList.add('correct');
        correctCount++;
        document.getElementById('correct-count').textContent = correctCount;
    } else {
        options[optIdx].classList.add('wrong');
        options[correctIdx].classList.add('correct');
        wrongCount++;
        document.getElementById('wrong-count').textContent = wrongCount;
    }

    // Show explanation
    if (showExplain && exp) {
        exp.style.display = 'block';
    }

    // Check if exam is done
    if (answeredCount === examQuestions.length) {
        showResult();
    }
}

// ==========================================
// SHOW RESULT
// ==========================================
function showResult() {
    const total = examQuestions.length;
    const percent = Math.round((correctCount / total) * 100);

    document.getElementById('final-score').textContent = `${correctCount}/${total} (${percent}%)`;
    document.getElementById('final-detail').textContent =
        `✅ Đúng: ${correctCount}  |  ❌ Sai: ${wrongCount}`;

    const resultBar = document.getElementById('result-bar');
    resultBar.style.display = 'block';
    resultBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ==========================================
// RANDOM & SHUFFLE UTILITIES
// ==========================================
function pickRandom(arr, n) {
    const copy = [...arr];
    const result = [];
    n = Math.min(n, copy.length);
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * copy.length);
        result.push(JSON.parse(JSON.stringify(copy[idx]))); // deep clone
        copy.splice(idx, 1);
    }
    return result;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function shuffleOptions(q) {
    // Create index mapping: originalIndex -> option
    const indices = q.options.map((opt, i) => ({ opt, i }));
    shuffleArray(indices);

    // Update correct index
    const newCorrect = indices.findIndex(item => item.i === q.correct);

    return {
        ...q,
        options: indices.map(item => item.opt),
        correct: newCorrect
    };
}

// ==========================================
// LOCALSTORAGE (Multi-bank)
// ==========================================
function getActiveBankId() {
    return localStorage.getItem('quizActiveBank') || '';
}

function getBank() {
    const id = getActiveBankId();
    if (!id) {
        // Fallback: try old format
        try { return JSON.parse(localStorage.getItem('quizBank')) || []; }
        catch { return []; }
    }
    try { return JSON.parse(localStorage.getItem('quizBank_' + id)) || []; }
    catch { return []; }
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

// ==========================================
// ESCAPE HTML
// ==========================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
