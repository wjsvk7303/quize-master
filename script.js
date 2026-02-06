// ==================== Configuration ====================

const CONFIG = Object.freeze({
    // Scoring
    POINTS_PER_CORRECT: 10,

    // Rankings
    MAX_RANKINGS: 10,
    STORAGE_KEY: 'quizRankings',
    WELCOME_SHOWN_KEY: 'quizWelcomeShown',

    // Grade thresholds (percentage >= threshold)
    GRADES: [
        { threshold: 90, text: 'S 등급', letter: 'S', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '🏆', title: '상식 박사!', message: '완벽합니다! 당신은 진정한 상식 마스터입니다!' },
        { threshold: 80, text: 'A 등급', letter: 'A', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', emoji: '🌟', title: '상식 고수!', message: '훌륭합니다! 상식이 매우 풍부하시네요!' },
        { threshold: 70, text: 'B 등급', letter: 'B', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', emoji: '🎉', title: '상식 우수!', message: '잘하셨어요! 평균 이상의 실력이에요!' },
        { threshold: 60, text: 'C 등급', letter: 'C', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', emoji: '👍', title: '상식 보통!', message: '괜찮아요! 조금만 더 노력하면 더 좋아질 거예요!' },
        { threshold: 50, text: 'D 등급', letter: 'D', gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)', emoji: '📚', title: '상식 부족!', message: '더 많이 공부하면 실력이 늘 거예요!' },
        { threshold: 0,  text: 'F 등급', letter: 'F', gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', emoji: '💪', title: '더 노력 필요!', message: '다시 도전해서 더 좋은 결과를 만들어보세요!' }
    ],

    // Animation delays (ms)
    DELAY_ANSWER_REVEAL: 300,
    DELAY_EXPLANATION_SHOW: 800,
    DELAY_INPUT_ERROR_RESET: 1000,
    DELAY_SCORE_RING_START: 300,
    SCORE_RING_TRANSITION_DURATION: '2s',

    // SVG score ring
    SCORE_RING_RADIUS: 85,

    // Input validation
    NAME_MAX_LENGTH: 20,
    NAME_PATTERN: /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s._-]+$/,

    // Category result color thresholds (percentage)
    CATEGORY_COLOR_THRESHOLDS: [
        { min: 80, color: '#10b981' },
        { min: 60, color: '#667eea' },
        { min: 40, color: '#f59e0b' },
        { min: 0,  color: '#ef4444' }
    ],

    // Data loading
    DATA_URL: 'data/questions.json',
    FETCH_TIMEOUT_MS: 10000,
    MAX_RETRY_COUNT: 3,
    RETRY_DELAY_MS: 1000,

    // Supabase
    SUPABASE_URL: 'https://nyhybmkdgozecizvpezy.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55aHlibWtkZ296ZWNpenZwZXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNjA4MjEsImV4cCI6MjA4NTkzNjgyMX0.DtfFUp9IZnQzw7NyWvGPksBzfRV5F25UpOKDQnoY06s',

    // Gemini AI
    GEMINI_API_KEY: 'AIzaSyBW9Q4m2i8npqz15BsBZuNGf2YZOWqEDEE',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    GEMINI_TIMEOUT_MS: 30000,
    GEMINI_TEMPERATURE: 0.8,
    AI_QUESTION_COUNT: 10,
    AI_MAX_RETRY_COUNT: 2,
    AI_RETRY_DELAY_MS: 60000,
    AI_COOLDOWN_MS: 60000
});

// Question data is loaded from CONFIG.DATA_URL via loadQuestions()

// ==================== Supabase Client ====================

var supabaseClient = null;
try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn('Supabase client initialization failed:', e);
}

// ==================== Security Utilities ====================

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string safe for innerHTML insertion.
 */
function escapeHtml(str) {
    if (typeof str !== 'string') {
        return '';
    }
    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, function (char) {
        return escapeMap[char];
    });
}

/**
 * Validates and sanitizes a user name.
 * @param {string} rawName - The raw input name.
 * @returns {{ valid: boolean, name: string, error: string }} Validation result.
 */
function validateName(rawName) {
    if (typeof rawName !== 'string') {
        return { valid: false, name: '', error: '이름을 입력해주세요.' };
    }

    const trimmed = rawName.trim();

    if (trimmed.length === 0) {
        return { valid: false, name: '', error: '이름을 입력해주세요.' };
    }

    if (trimmed.length > CONFIG.NAME_MAX_LENGTH) {
        return { valid: false, name: '', error: '이름은 ' + CONFIG.NAME_MAX_LENGTH + '자 이내로 입력해주세요.' };
    }

    if (!CONFIG.NAME_PATTERN.test(trimmed)) {
        return { valid: false, name: '', error: '이름에 특수문자는 사용할 수 없습니다.' };
    }

    return { valid: true, name: trimmed, error: '' };
}

// ==================== Safe localStorage Wrapper ====================

const Storage = {
    /**
     * Safely retrieves and parses JSON from localStorage.
     * @param {string} key - The storage key.
     * @param {*} defaultValue - Default value if key is missing or invalid.
     * @returns {*} The parsed value or defaultValue.
     */
    get(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) {
                return defaultValue;
            }
            return JSON.parse(data);
        } catch (e) {
            console.error('localStorage read error for key "' + key + '":', e);
            return defaultValue;
        }
    },

    /**
     * Safely serializes and stores JSON in localStorage.
     * @param {string} key - The storage key.
     * @param {*} value - The value to store.
     * @returns {boolean} Whether the operation succeeded.
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error('localStorage quota exceeded for key "' + key + '". Attempting cleanup.');
                // Try to remove old data and retry once
                try {
                    localStorage.removeItem(key);
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    console.error('localStorage retry failed:', retryError);
                    return false;
                }
            }
            console.error('localStorage write error for key "' + key + '":', e);
            return false;
        }
    },

    /**
     * Safely removes an item from localStorage.
     * @param {string} key - The storage key.
     * @returns {boolean} Whether the operation succeeded.
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('localStorage remove error for key "' + key + '":', e);
            return false;
        }
    }
};

// ==================== Ranking Data Validation ====================

/**
 * Validates a single ranking record object.
 * @param {*} record - The record to validate.
 * @returns {boolean} Whether the record is structurally valid.
 */
function isValidRankingRecord(record) {
    return (
        record !== null &&
        typeof record === 'object' &&
        typeof record.name === 'string' &&
        record.name.length > 0 &&
        record.name.length <= CONFIG.NAME_MAX_LENGTH &&
        typeof record.score === 'number' &&
        Number.isFinite(record.score) &&
        record.score >= 0 &&
        typeof record.grade === 'string' &&
        typeof record.correctCount === 'number' &&
        Number.isFinite(record.correctCount) &&
        typeof record.totalQuestions === 'number' &&
        Number.isFinite(record.totalQuestions) &&
        record.totalQuestions > 0 &&
        typeof record.date === 'string' &&
        typeof record.timestamp === 'number' &&
        Number.isFinite(record.timestamp)
    );
}

/**
 * Validates and filters an array of ranking records.
 * @param {*} data - Raw data from localStorage.
 * @returns {Array} Validated array of ranking records.
 */
function validateRankings(data) {
    if (!Array.isArray(data)) {
        return [];
    }
    return data.filter(isValidRankingRecord);
}

// ==================== Game State ====================

const gameState = {
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    selectedCategory: 'all',
    userAnswers: [],
    playerName: '',
    isAnswering: false,
    pendingTimeouts: [],
    currentScreen: 'start',
    focusedElementBeforeModal: null,
    questionsData: null,
    dataLoaded: false,
    quizMode: 'local'
};

// ==================== Cached DOM Elements ====================

// These are populated once in initDomCache() after DOMContentLoaded.
const dom = {};

/**
 * Safely retrieves a DOM element by ID, logging a warning if not found.
 * @param {string} id - The element ID.
 * @returns {HTMLElement|null}
 */
function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn('DOM element not found: #' + id);
    }
    return el;
}

/**
 * Initializes the cached DOM element references.
 */
function initDomCache() {
    dom.startScreen = getElement('start-screen');
    dom.quizScreen = getElement('quiz-screen');
    dom.resultScreen = getElement('result-screen');
    dom.rankingModal = getElement('ranking-modal');
    dom.confirmModal = getElement('confirm-modal');
    dom.helpModal = getElement('help-modal');
    dom.welcomeOverlay = getElement('welcome-overlay');
    dom.startBtn = getElement('start-btn');
    dom.nameInput = getElement('user-name');
    dom.nameError = getElement('name-error');
    dom.categoryCards = document.querySelectorAll('.category-card');
    dom.optionsContainer = getElement('options-container');
    dom.nextBtn = getElement('next-btn');
    dom.retryBtn = getElement('retry-btn');
    dom.homeBtn = getElement('home-btn');
    dom.viewRankingBtn = getElement('view-ranking-btn');
    dom.viewRankingResultBtn = getElement('view-ranking-result-btn');
    dom.closeModalBtn = getElement('close-modal-btn');
    dom.closeModal = getElement('close-modal');
    dom.clearRankingBtn = getElement('clear-ranking-btn');
    dom.helpBtn = getElement('help-btn');
    dom.helpClose = getElement('help-close');
    dom.helpOk = getElement('help-ok');
    dom.confirmClose = getElement('confirm-close');
    dom.confirmYes = getElement('confirm-yes');
    dom.confirmNo = getElement('confirm-no');
    dom.confirmMessage = getElement('confirm-message');
    dom.welcomeStart = getElement('welcome-start');
    dom.dontShowWelcome = getElement('dont-show-welcome');
    dom.srAnnouncements = getElement('sr-announcements');
    dom.progressBar = document.querySelector('.progress-bar');
    dom.modeCards = document.querySelectorAll('.mode-card');
    dom.loadingText = document.querySelector('.loading-text');

    // Cached quiz screen elements (queried once, reused every question)
    dom.questionCategory = getElement('question-category');
    dom.questionText = getElement('question-text');
    dom.currentQuestion = getElement('current-question');
    dom.totalQuestions = getElement('total-questions');
    dom.currentScore = getElement('current-score');
    dom.explanation = getElement('explanation');
    dom.explanationText = getElement('explanation-text');
    dom.progressFill = getElement('progress-fill');
    dom.playerDisplayName = getElement('player-display-name');

    // Cached result screen elements
    dom.resultPlayerName = getElement('result-player-name');
    dom.finalScore = getElement('final-score');
    dom.correctCount = getElement('correct-count');
    dom.totalCount = getElement('total-count');
    dom.gradeBadge = getElement('grade-badge');
    dom.resultEmoji = getElement('result-emoji');
    dom.resultMessage = getElement('result-message');
    dom.categoryResults = getElement('category-results');
    dom.scoreRingProgress = getElement('score-ring-progress');

    // Loading / error overlay elements
    dom.loadingOverlay = getElement('loading-overlay');
    dom.errorOverlay = getElement('error-overlay');
    dom.errorMessage = getElement('error-message');
    dom.retryLoadBtn = getElement('retry-load-btn');

    // Cache all screens for showScreen()
    dom.allScreens = document.querySelectorAll('.screen');
}

// ==================== Timeout Management ====================

/**
 * Creates a managed setTimeout that can be cancelled on game reset.
 * @param {Function} callback - The function to execute.
 * @param {number} delay - Delay in milliseconds.
 * @returns {number} The timeout ID.
 */
function managedTimeout(callback, delay) {
    const id = setTimeout(function () {
        // Remove from pending list after execution
        const index = gameState.pendingTimeouts.indexOf(id);
        if (index > -1) {
            gameState.pendingTimeouts.splice(index, 1);
        }
        callback();
    }, delay);
    gameState.pendingTimeouts.push(id);
    return id;
}

/**
 * Cancels all pending managed timeouts.
 */
function clearAllTimeouts() {
    for (let i = 0; i < gameState.pendingTimeouts.length; i++) {
        clearTimeout(gameState.pendingTimeouts[i]);
    }
    gameState.pendingTimeouts = [];
}

// ==================== Data Loading ====================

/**
 * Validates loaded questions data and returns only valid questions.
 * @param {*} data - Raw parsed JSON data.
 * @returns {Array} Array of valid question objects.
 */
function validateQuestionsData(data) {
    if (!Array.isArray(data)) {
        return [];
    }

    var requiredFields = ['id', 'category', 'question', 'options', 'answer', 'explanation'];

    return data.filter(function (item) {
        if (item === null || typeof item !== 'object') return false;

        for (var i = 0; i < requiredFields.length; i++) {
            if (!(requiredFields[i] in item)) return false;
        }

        if (typeof item.id !== 'number') return false;
        if (typeof item.category !== 'string' || item.category.length === 0) return false;
        if (typeof item.question !== 'string' || item.question.length === 0) return false;
        if (!Array.isArray(item.options) || item.options.length < 2) return false;
        if (typeof item.answer !== 'number' || item.answer < 0 || item.answer >= item.options.length) return false;
        if (typeof item.explanation !== 'string') return false;

        return true;
    });
}

/**
 * Fetches question data from the server with timeout and retry logic.
 * On HTTP/HTTPS: uses fetch() to load questions.json.
 * On file:// (or when fetch fails): falls back to loading questions.js via <script> tag.
 * On success, stores data in gameState and hides the loading overlay.
 * On failure, shows the error overlay with a retry button.
 */
function loadQuestions() {
    var retryCount = 0;

    function showLoadingOverlay() {
        if (dom.loadingOverlay) dom.loadingOverlay.classList.remove('hidden');
        if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');
    }

    function hideLoadingOverlay() {
        if (dom.loadingOverlay) dom.loadingOverlay.classList.add('hidden');
    }

    function showErrorOverlay(message) {
        hideLoadingOverlay();
        if (dom.errorOverlay) dom.errorOverlay.classList.remove('hidden');
        if (dom.errorMessage) dom.errorMessage.textContent = message || '문제 데이터를 불러오지 못했습니다.';
    }

    function onDataReady(data) {
        var validQuestions = validateQuestionsData(data);
        if (validQuestions.length === 0) {
            showErrorOverlay('유효한 문제가 없습니다.');
            return;
        }

        gameState.questionsData = validQuestions;
        gameState.dataLoaded = true;
        hideLoadingOverlay();
        checkFirstTimeUser();
    }

    /**
     * Fallback: load data/questions.js via <script> tag (bypasses CORS).
     * The script sets window.__QUESTIONS_DATA__.
     */
    function loadViaScript() {
        // If already loaded by a previous attempt, use it
        if (window.__QUESTIONS_DATA__) {
            onDataReady(window.__QUESTIONS_DATA__);
            return;
        }

        var script = document.createElement('script');
        script.src = CONFIG.DATA_URL.replace(/\.json$/, '.js');

        script.onload = function () {
            if (window.__QUESTIONS_DATA__) {
                onDataReady(window.__QUESTIONS_DATA__);
            } else {
                showErrorOverlay('문제 데이터를 불러오지 못했습니다.');
            }
        };

        script.onerror = function () {
            showErrorOverlay('문제 데이터를 불러오지 못했습니다.');
            console.error('Failed to load questions via script fallback.');
        };

        document.head.appendChild(script);
    }

    function attemptFetch() {
        showLoadingOverlay();

        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
            if (controller) controller.abort();
        }, CONFIG.FETCH_TIMEOUT_MS);

        var fetchOptions = {};
        if (controller) fetchOptions.signal = controller.signal;

        fetch(CONFIG.DATA_URL, fetchOptions)
            .then(function (response) {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                onDataReady(data);
            })
            .catch(function (err) {
                clearTimeout(timeoutId);
                retryCount++;

                if (retryCount < CONFIG.MAX_RETRY_COUNT) {
                    setTimeout(attemptFetch, CONFIG.RETRY_DELAY_MS);
                } else {
                    // fetch exhausted — try <script> tag fallback
                    console.warn('fetch() failed after ' + CONFIG.MAX_RETRY_COUNT + ' attempts, trying script fallback.', err);
                    loadViaScript();
                }
            });
    }

    function attemptLoad() {
        retryCount = 0;

        // file:// protocol: skip fetch entirely, go straight to script fallback
        if (window.location.protocol === 'file:') {
            showLoadingOverlay();
            loadViaScript();
            return;
        }

        attemptFetch();
    }

    // Wire up retry button
    if (dom.retryLoadBtn) {
        dom.retryLoadBtn.addEventListener('click', attemptLoad);
    }

    attemptLoad();
}

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', function () {
    initDomCache();
    setupEventListeners();
    setupKeyboardNavigation();
    loadQuestions();
});

// ==================== Event Listeners ====================

function setupEventListeners() {
    // Category selection
    if (dom.categoryCards && dom.categoryCards.length > 0) {
        dom.categoryCards.forEach(function (card) {
            card.addEventListener('click', function () {
                dom.categoryCards.forEach(function (c) { c.classList.remove('selected'); });
                card.classList.add('selected');
                gameState.selectedCategory = card.dataset.category;
                updateCategoryAriaPressed();
                announceToScreenReader(card.querySelector('.category-name').textContent + ' 카테고리 선택됨');
            });
        });

        // Default category selection
        dom.categoryCards[0].classList.add('selected');
        dom.categoryCards[0].setAttribute('aria-pressed', 'true');
    }

    // Mode selection
    if (dom.modeCards && dom.modeCards.length > 0) {
        dom.modeCards.forEach(function (card) {
            card.addEventListener('click', function () {
                dom.modeCards.forEach(function (c) { c.classList.remove('selected'); });
                card.classList.add('selected');
                gameState.quizMode = card.dataset.mode;
                updateModeAriaPressed();
                updateCategoryCountDisplay();
                announceToScreenReader(card.querySelector('.mode-name').textContent + ' 모드 선택됨');
            });
        });
    }

    // Name input enter key
    if (dom.nameInput) {
        dom.nameInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                startQuiz();
            }
        });
    }

    // Start button
    if (dom.startBtn) {
        dom.startBtn.addEventListener('click', startQuiz);
    }

    // Next button
    if (dom.nextBtn) {
        dom.nextBtn.addEventListener('click', nextQuestion);
    }

    // Retry button
    if (dom.retryBtn) {
        dom.retryBtn.addEventListener('click', function () {
            showScreen(dom.startScreen);
            resetGame();
        });
    }

    // Home button
    if (dom.homeBtn) {
        dom.homeBtn.addEventListener('click', function () {
            showScreen(dom.startScreen);
            resetGame();
        });
    }

    // View ranking buttons
    if (dom.viewRankingBtn) {
        dom.viewRankingBtn.addEventListener('click', showRankingModal);
    }
    if (dom.viewRankingResultBtn) {
        dom.viewRankingResultBtn.addEventListener('click', showRankingModal);
    }

    // Modal close
    if (dom.closeModalBtn) {
        dom.closeModalBtn.addEventListener('click', hideRankingModal);
    }
    if (dom.closeModal) {
        dom.closeModal.addEventListener('click', hideRankingModal);
    }

    // Modal backdrop click
    if (dom.rankingModal) {
        dom.rankingModal.addEventListener('click', function (e) {
            if (e.target === dom.rankingModal) {
                hideRankingModal();
            }
        });
    }

    // Clear rankings
    if (dom.clearRankingBtn) {
        dom.clearRankingBtn.addEventListener('click', function () {
            confirmAction('정말로 모든 순위 기록을 삭제하시겠습니까?').then(async function (confirmed) {
                if (confirmed) {
                    await clearRanking();
                    announceToScreenReader('순위가 초기화되었습니다');
                }
            });
        });
    }

    // Help button
    if (dom.helpBtn) {
        dom.helpBtn.addEventListener('click', showHelpModal);
    }

    // Help modal close
    if (dom.helpClose) {
        dom.helpClose.addEventListener('click', function () {
            hideModal(dom.helpModal);
        });
    }
    if (dom.helpOk) {
        dom.helpOk.addEventListener('click', function () {
            hideModal(dom.helpModal);
        });
    }

    // Welcome overlay
    if (dom.welcomeStart) {
        dom.welcomeStart.addEventListener('click', function () {
            if (dom.dontShowWelcome && dom.dontShowWelcome.checked) {
                Storage.set(CONFIG.WELCOME_SHOWN_KEY, true);
            }
            dom.welcomeOverlay.classList.add('hidden');
            if (dom.nameInput) {
                dom.nameInput.focus();
            }
        });
    }
}

// ==================== Quiz Logic ====================

/**
 * Starts the quiz after validating the player name and category.
 * Delegates to startLocalQuiz() or startAIQuiz() based on quizMode.
 */
function startQuiz() {
    if (!dom.nameInput) return;

    // Validate player name
    const validation = validateName(dom.nameInput.value);
    if (!validation.valid) {
        showNameError(validation.error);
        dom.nameInput.focus();
        return;
    }

    gameState.playerName = validation.name;

    if (gameState.quizMode === 'ai') {
        startAIQuiz();
    } else {
        startLocalQuiz();
    }
}

/**
 * Starts a local quiz using pre-loaded question data.
 */
function startLocalQuiz() {
    // Show loading state
    if (dom.startBtn) {
        dom.startBtn.classList.add('loading');
        dom.startBtn.disabled = true;
    }

    resetGame();
    announceToScreenReader('퀴즈를 시작합니다');

    // Guard: data must be loaded
    if (!gameState.dataLoaded || !gameState.questionsData) {
        showNameError('문제 데이터가 아직 로드되지 않았습니다.');
        if (dom.startBtn) {
            dom.startBtn.classList.remove('loading');
            dom.startBtn.disabled = false;
        }
        return;
    }

    // Filter questions by selected category
    if (gameState.selectedCategory !== 'all') {
        gameState.questions = gameState.questionsData.filter(function (q) {
            return q.category === gameState.selectedCategory;
        });
    } else {
        gameState.questions = gameState.questionsData.slice();
    }

    // Shuffle questions
    shuffleArrayInPlace(gameState.questions);

    // Display player name
    if (dom.playerDisplayName) {
        dom.playerDisplayName.textContent = gameState.playerName;
    }

    updateProgress();

    // Small delay for loading effect
    managedTimeout(function () {
        if (dom.startBtn) {
            dom.startBtn.classList.remove('loading');
            dom.startBtn.disabled = false;
        }
        showScreen(dom.quizScreen);
        gameState.currentScreen = 'quiz';
        displayQuestion();
    }, 300);
}

// ==================== Gemini AI ====================

/**
 * Builds the Gemini API prompt for the given category and count.
 * @param {string} category - The quiz category or 'all'.
 * @param {number} count - Number of questions to generate.
 * @returns {string} The prompt string.
 */
function buildGeminiPrompt(category, count) {
    var categoryInstruction;
    if (category === 'all') {
        categoryInstruction = '한국사, 과학, 지리, 예술과 문화 4개 카테고리에서 골고루 섞어서';
    } else {
        categoryInstruction = '"' + category + '" 카테고리에서';
    }

    return '상식 퀴즈 문제를 ' + count + '개 생성해주세요.\n' +
        categoryInstruction + ' 출제해주세요.\n\n' +
        '규칙:\n' +
        '- 각 문제는 4지선다입니다\n' +
        '- 난이도는 중간 정도로 해주세요\n' +
        '- 정답 번호(answer)는 0부터 시작하는 인덱스입니다\n' +
        '- 해설(explanation)은 간결하게 1-2문장으로 작성해주세요\n' +
        '- 이전에 출제된 문제와 겹치지 않도록 다양한 주제에서 출제해주세요\n\n' +
        '반드시 아래 JSON 형식의 배열로만 응답해주세요:\n' +
        '[\n' +
        '  {\n' +
        '    "id": 1,\n' +
        '    "category": "한국사",\n' +
        '    "question": "질문 내용",\n' +
        '    "options": ["선택지1", "선택지2", "선택지3", "선택지4"],\n' +
        '    "answer": 0,\n' +
        '    "explanation": "해설 내용"\n' +
        '  }\n' +
        ']';
}

/**
 * Calls the Gemini API to generate quiz questions.
 * @param {string} category - The quiz category or 'all'.
 * @returns {Promise<Array>} Resolves to an array of validated question objects.
 */
// Tracks the last Gemini API request time for global cooldown
var _lastGeminiRequestTime = 0;

function generateAIQuestions(category) {
    var count = CONFIG.AI_QUESTION_COUNT;
    var prompt = buildGeminiPrompt(category, count);
    var url = CONFIG.GEMINI_API_URL + '?key=' + CONFIG.GEMINI_API_KEY;

    _lastGeminiRequestTime = Date.now();

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = setTimeout(function () {
        if (controller) controller.abort();
    }, CONFIG.GEMINI_TIMEOUT_MS);

    var fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: CONFIG.GEMINI_TEMPERATURE,
                responseMimeType: 'application/json'
            }
        })
    };
    if (controller) fetchOptions.signal = controller.signal;

    return fetch(url, fetchOptions)
        .then(function (response) {
            clearTimeout(timeoutId);
            if (response.status === 429) {
                var err = new Error('API 요청 한도 초과 (429)');
                err.is429 = true;
                throw err;
            }
            if (!response.ok) {
                throw new Error('Gemini API HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            var text = data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0] &&
                data.candidates[0].content.parts[0].text;

            if (!text) {
                throw new Error('Gemini 응답에서 텍스트를 찾을 수 없습니다.');
            }

            var parsed = JSON.parse(text);
            var validated = validateQuestionsData(parsed);

            if (validated.length === 0) {
                throw new Error('생성된 문제의 형식이 올바르지 않습니다.');
            }

            return validated;
        });
}

/**
 * Shows a countdown on the loading overlay.
 * @param {number} totalSec - Total seconds to count down.
 * @param {string} message - Message prefix.
 * @param {Function} onDone - Callback when countdown finishes.
 */
function showCountdown(totalSec, message, onDone) {
    var remain = totalSec;
    function tick() {
        if (dom.loadingText) {
            dom.loadingText.textContent = message + ' (' + remain + '초)';
        }
        remain--;
        if (remain >= 0) {
            managedTimeout(tick, 1000);
        } else if (onDone) {
            onDone();
        }
    }
    tick();
}

/**
 * Starts an AI-generated quiz, enforcing a global cooldown between API calls.
 */
function startAIQuiz() {
    resetGame();
    showAILoadingOverlay();

    // Enforce global cooldown — if last request was too recent, wait first
    var elapsed = Date.now() - _lastGeminiRequestTime;
    var cooldownRemain = CONFIG.AI_COOLDOWN_MS - elapsed;

    if (cooldownRemain > 0 && _lastGeminiRequestTime > 0) {
        var waitSec = Math.ceil(cooldownRemain / 1000);
        showCountdown(waitSec, 'API 쿨다운 대기 중...', function () {
            runAIQuizAttempts();
        });
    } else {
        runAIQuizAttempts();
    }
}

function runAIQuizAttempts() {
    var retryCount = 0;

    function attempt() {
        if (dom.loadingText) {
            dom.loadingText.textContent = 'AI가 문제를 생성 중...';
        }

        generateAIQuestions(gameState.selectedCategory)
            .then(function (questions) {
                hideAILoadingOverlay();
                gameState.questions = questions;

                if (dom.playerDisplayName) {
                    dom.playerDisplayName.textContent = gameState.playerName;
                }

                updateProgress();
                showScreen(dom.quizScreen);
                gameState.currentScreen = 'quiz';
                displayQuestion();
                announceToScreenReader('AI가 생성한 퀴즈를 시작합니다');
            })
            .catch(function (err) {
                console.error('AI question generation failed:', err);
                retryCount++;

                if (err.is429 && retryCount <= CONFIG.AI_MAX_RETRY_COUNT) {
                    var delaySec = Math.ceil(CONFIG.AI_RETRY_DELAY_MS / 1000);
                    showCountdown(delaySec, 'API 한도 초과, 재시도 대기 중... (' + retryCount + '/' + CONFIG.AI_MAX_RETRY_COUNT + ')', function () {
                        attempt();
                    });
                } else if (!err.is429 && retryCount <= CONFIG.AI_MAX_RETRY_COUNT) {
                    managedTimeout(attempt, 3000);
                } else {
                    hideAILoadingOverlay();
                    var msg = err.is429
                        ? 'API 요청 한도를 초과했습니다.\n1분 후 다시 시도해주세요.'
                        : 'AI 문제 생성에 실패했습니다.\n' + (err.message || '');
                    showAIErrorFallback(msg);
                }
            });
    }

    attempt();
}

/**
 * Shows the loading overlay with AI-specific text.
 */
function showAILoadingOverlay() {
    if (dom.loadingText) dom.loadingText.textContent = 'AI가 문제를 생성 중...';
    if (dom.loadingOverlay) dom.loadingOverlay.classList.remove('hidden');
    if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');
}

/**
 * Hides the loading overlay and restores default text.
 */
function hideAILoadingOverlay() {
    if (dom.loadingOverlay) dom.loadingOverlay.classList.add('hidden');
    if (dom.loadingText) dom.loadingText.textContent = '문제 로드 중...';
}

/**
 * Shows an error overlay with AI-specific options: retry AI or fallback to local.
 * @param {string} errorMsg - The error message to display.
 */
function showAIErrorFallback(errorMsg) {
    if (dom.errorOverlay) dom.errorOverlay.classList.remove('hidden');
    if (dom.errorMessage) dom.errorMessage.textContent = errorMsg;

    // Change the error title
    var errorTitle = dom.errorOverlay ? dom.errorOverlay.querySelector('.error-title') : null;
    if (errorTitle) errorTitle.textContent = 'AI 문제 생성 실패';

    // Reconfigure retry button for AI retry
    if (dom.retryLoadBtn) {
        var btnText = dom.retryLoadBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = 'AI 다시 시도';

        // Replace event listener by cloning
        var newRetryBtn = dom.retryLoadBtn.cloneNode(true);
        dom.retryLoadBtn.parentNode.replaceChild(newRetryBtn, dom.retryLoadBtn);
        dom.retryLoadBtn = newRetryBtn;

        newRetryBtn.addEventListener('click', function () {
            restoreErrorOverlayDefaults();
            startAIQuiz();
        });
    }

    // Add fallback button if not already present
    var existingFallback = document.getElementById('ai-fallback-btn');
    if (!existingFallback && dom.retryLoadBtn && dom.retryLoadBtn.parentNode) {
        var fallbackBtn = document.createElement('button');
        fallbackBtn.id = 'ai-fallback-btn';
        fallbackBtn.className = 'btn-secondary error-retry-btn';
        fallbackBtn.style.marginTop = '15px';
        fallbackBtn.innerHTML = '<span class="btn-text">기존 문제로 시작</span><span class="btn-icon" aria-hidden="true">📋</span>';
        fallbackBtn.setAttribute('aria-label', '기존 문제로 시작');

        fallbackBtn.addEventListener('click', function () {
            restoreErrorOverlayDefaults();
            if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');

            // Switch mode to local
            gameState.quizMode = 'local';
            if (dom.modeCards) {
                dom.modeCards.forEach(function (c) { c.classList.remove('selected'); });
                dom.modeCards.forEach(function (c) {
                    if (c.dataset.mode === 'local') c.classList.add('selected');
                });
                updateModeAriaPressed();
            }
            updateCategoryCountDisplay();
            startLocalQuiz();
        });

        dom.retryLoadBtn.parentNode.appendChild(fallbackBtn);
    }

    announceToScreenReader('AI 문제 생성 실패. 다시 시도하거나 기존 문제로 시작할 수 있습니다.');
}

/**
 * Restores the error overlay to its default state (for data loading errors).
 */
function restoreErrorOverlayDefaults() {
    if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');

    var errorTitle = dom.errorOverlay ? dom.errorOverlay.querySelector('.error-title') : null;
    if (errorTitle) errorTitle.textContent = '데이터 로드 실패';
    if (dom.errorMessage) dom.errorMessage.textContent = '문제 데이터를 불러오지 못했습니다.';

    // Restore retry button
    if (dom.retryLoadBtn) {
        var btnText = dom.retryLoadBtn.querySelector('.btn-text');
        if (btnText) btnText.textContent = '다시 시도';

        // Re-clone to remove AI retry listener, re-attach loadQuestions
        var newBtn = dom.retryLoadBtn.cloneNode(true);
        dom.retryLoadBtn.parentNode.replaceChild(newBtn, dom.retryLoadBtn);
        dom.retryLoadBtn = newBtn;
        // Note: loadQuestions will re-attach its own listener on next call
    }

    // Remove AI fallback button
    var fallbackBtn = document.getElementById('ai-fallback-btn');
    if (fallbackBtn) fallbackBtn.remove();
}

/**
 * Switches to the specified screen, hiding all others.
 * @param {HTMLElement} screen - The screen element to show.
 */
function showScreen(screen) {
    if (!screen) return;
    dom.allScreens.forEach(function (s) { s.classList.remove('active'); });
    screen.classList.add('active');

    // Update current screen state
    if (screen === dom.startScreen) gameState.currentScreen = 'start';
    else if (screen === dom.quizScreen) gameState.currentScreen = 'quiz';
    else if (screen === dom.resultScreen) gameState.currentScreen = 'result';
}

/**
 * Displays the current question and its options.
 */
function displayQuestion() {
    const question = gameState.questions[gameState.currentQuestionIndex];
    if (!question) return;

    // Reset answering lock
    gameState.isAnswering = false;

    // Update question display using cached DOM references
    if (dom.questionCategory) {
        dom.questionCategory.textContent = question.category;
        dom.questionCategory.setAttribute('aria-label', '카테고리: ' + question.category);
    }
    if (dom.questionText) {
        dom.questionText.textContent = question.question;
        // Focus question for screen readers
        managedTimeout(function () {
            if (dom.questionText) {
                dom.questionText.focus();
            }
        }, 100);
    }
    if (dom.currentQuestion) dom.currentQuestion.textContent = gameState.currentQuestionIndex + 1;
    if (dom.totalQuestions) dom.totalQuestions.textContent = gameState.questions.length;
    if (dom.currentScore) dom.currentScore.textContent = gameState.score;

    // Update progress bar aria attributes
    if (dom.progressBar) {
        var progress = ((gameState.currentQuestionIndex + 1) / gameState.questions.length) * 100;
        dom.progressBar.setAttribute('aria-valuenow', Math.round(progress));
    }

    // Announce question to screen reader
    announceToScreenReader('문제 ' + (gameState.currentQuestionIndex + 1) + '. ' + question.question);

    // Build options
    if (dom.optionsContainer) {
        dom.optionsContainer.innerHTML = '';
        question.options.forEach(function (option, index) {
            var btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.textContent = (index + 1) + '. ' + option;
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            btn.setAttribute('aria-label', '답 ' + (index + 1) + ': ' + option);
            btn.addEventListener('click', function () { selectAnswer(index); });
            dom.optionsContainer.appendChild(btn);
        });
    }

    // Hide explanation and next button
    if (dom.explanation) dom.explanation.classList.add('hidden');
    if (dom.nextBtn) dom.nextBtn.classList.add('hidden');

    updateProgress();
}

/**
 * Handles answer selection with race condition protection.
 * @param {number} selectedIndex - The index of the selected option.
 */
function selectAnswer(selectedIndex) {
    // Prevent double-clicks / race condition during answer animation
    if (gameState.isAnswering) return;
    gameState.isAnswering = true;

    var question = gameState.questions[gameState.currentQuestionIndex];
    if (!question || !dom.optionsContainer) return;

    var optionBtns = dom.optionsContainer.querySelectorAll('.option-btn');

    // Disable all buttons immediately
    optionBtns.forEach(function (btn) { btn.disabled = true; });

    // Check answer
    var isCorrect = selectedIndex === question.answer;

    // Record user answer
    gameState.userAnswers.push({
        question: question.question,
        category: question.category,
        userAnswer: selectedIndex,
        correctAnswer: question.answer,
        isCorrect: isCorrect
    });

    // Reveal answer with animation
    managedTimeout(function () {
        if (isCorrect) {
            if (optionBtns[selectedIndex]) {
                optionBtns[selectedIndex].classList.add('correct');
                optionBtns[selectedIndex].setAttribute('aria-label', '정답: ' + question.options[selectedIndex]);
            }
            gameState.score += CONFIG.POINTS_PER_CORRECT;
            if (dom.currentScore) dom.currentScore.textContent = gameState.score;
            announceToScreenReader('정답입니다! 10점 획득. 현재 점수: ' + gameState.score + '점');
        } else {
            if (optionBtns[selectedIndex]) {
                optionBtns[selectedIndex].classList.add('wrong');
                optionBtns[selectedIndex].setAttribute('aria-label', '오답: ' + question.options[selectedIndex]);
            }
            if (optionBtns[question.answer]) {
                optionBtns[question.answer].classList.add('correct');
                optionBtns[question.answer].setAttribute('aria-label', '정답: ' + question.options[question.answer]);
            }
            announceToScreenReader('오답입니다. 정답은 ' + (question.answer + 1) + '번 ' + question.options[question.answer] + ' 입니다');
        }

        // Show explanation after delay
        managedTimeout(function () {
            if (dom.explanationText) dom.explanationText.textContent = question.explanation;
            if (dom.explanation) {
                dom.explanation.classList.remove('hidden');
                announceToScreenReader('해설: ' + question.explanation);
            }
            if (dom.nextBtn) {
                dom.nextBtn.classList.remove('hidden');
                dom.nextBtn.focus();
            }
        }, CONFIG.DELAY_EXPLANATION_SHOW);
    }, CONFIG.DELAY_ANSWER_REVEAL);
}

/**
 * Advances to the next question or shows results if quiz is complete.
 */
function nextQuestion() {
    gameState.currentQuestionIndex++;

    if (gameState.currentQuestionIndex < gameState.questions.length) {
        displayQuestion();
    } else {
        announceToScreenReader('퀴즈가 완료되었습니다. 결과를 표시합니다');
        showResults();
    }
}

/**
 * Updates the progress bar and text.
 */
function updateProgress() {
    if (!dom.progressFill || gameState.questions.length === 0) return;
    var progress = ((gameState.currentQuestionIndex + 1) / gameState.questions.length) * 100;
    dom.progressFill.style.width = progress + '%';
}

// ==================== Results ====================

/**
 * Displays the quiz results screen.
 */
function showResults() {
    var totalQuestions = gameState.questions.length;
    var correctAnswerCount = 0;
    for (var i = 0; i < gameState.userAnswers.length; i++) {
        if (gameState.userAnswers[i].isCorrect) correctAnswerCount++;
    }
    var percentage = totalQuestions > 0 ? (correctAnswerCount / totalQuestions) * 100 : 0;

    // Player name (safe text content)
    if (dom.resultPlayerName) {
        dom.resultPlayerName.textContent = gameState.playerName + '님의 결과';
    }

    // Scores
    if (dom.finalScore) dom.finalScore.textContent = gameState.score;
    if (dom.correctCount) dom.correctCount.textContent = correctAnswerCount;
    if (dom.totalCount) dom.totalCount.textContent = totalQuestions;

    // Score ring animation
    animateScoreRing(percentage);

    // Grade badge
    var grade = getGrade(percentage);
    if (dom.gradeBadge) {
        dom.gradeBadge.textContent = grade.text;
        dom.gradeBadge.style.background = grade.gradient;
    }

    // Result emoji
    if (dom.resultEmoji) dom.resultEmoji.textContent = grade.emoji;

    // Result message (safe: use textContent for dynamic parts)
    if (dom.resultMessage) {
        dom.resultMessage.innerHTML = '';
        var h3 = document.createElement('h3');
        h3.textContent = grade.title;
        var p = document.createElement('p');
        p.textContent = grade.message;
        dom.resultMessage.appendChild(h3);
        dom.resultMessage.appendChild(p);
    }

    // Category results
    displayCategoryResults();

    // Save ranking
    saveRanking();

    showScreen(dom.resultScreen);
    gameState.currentScreen = 'result';

    // Announce results
    managedTimeout(function () {
        announceToScreenReader('퀴즈 완료. 최종 점수: ' + gameState.score + '점. 정답: ' + correctAnswerCount + '개 / ' + totalQuestions + '개. 등급: ' + grade.text);
    }, 1000);
}

/**
 * Returns the grade object for a given percentage, using CONFIG.GRADES thresholds.
 * @param {number} percentage - The player's correct answer percentage (0-100).
 * @returns {Object} The matching grade definition.
 */
function getGrade(percentage) {
    for (var i = 0; i < CONFIG.GRADES.length; i++) {
        if (percentage >= CONFIG.GRADES[i].threshold) {
            return CONFIG.GRADES[i];
        }
    }
    // Fallback to last grade (F)
    return CONFIG.GRADES[CONFIG.GRADES.length - 1];
}

/**
 * Animates the SVG score ring to the given percentage.
 * @param {number} percentage - Completion percentage (0-100).
 */
function animateScoreRing(percentage) {
    var circumference = 2 * Math.PI * CONFIG.SCORE_RING_RADIUS;
    var offset = circumference - (percentage / 100) * circumference;

    // Add SVG gradient if not present
    var svg = document.querySelector('.score-ring');
    if (svg && !svg.querySelector('defs')) {
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        var gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'scoreGradient');

        var stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('style', 'stop-color:#667eea;stop-opacity:1');

        var stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('style', 'stop-color:#764ba2;stop-opacity:1');

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);
    }

    if (dom.scoreRingProgress) {
        dom.scoreRingProgress.style.strokeDasharray = circumference;
        dom.scoreRingProgress.style.strokeDashoffset = circumference;

        managedTimeout(function () {
            if (dom.scoreRingProgress) {
                dom.scoreRingProgress.style.transition = 'stroke-dashoffset ' + CONFIG.SCORE_RING_TRANSITION_DURATION + ' ease-out';
                dom.scoreRingProgress.style.strokeDashoffset = offset;
            }
        }, CONFIG.DELAY_SCORE_RING_START);
    }
}

/**
 * Displays per-category result breakdown using safe DOM construction.
 */
function displayCategoryResults() {
    if (!dom.categoryResults) return;

    var categories = {};

    // Aggregate by category
    for (var i = 0; i < gameState.userAnswers.length; i++) {
        var answer = gameState.userAnswers[i];
        if (!categories[answer.category]) {
            categories[answer.category] = { total: 0, correct: 0 };
        }
        categories[answer.category].total++;
        if (answer.isCorrect) {
            categories[answer.category].correct++;
        }
    }

    // Build results safely with DOM API (no innerHTML with user data)
    dom.categoryResults.innerHTML = '';
    var categoryNames = Object.keys(categories);
    for (var j = 0; j < categoryNames.length; j++) {
        var categoryName = categoryNames[j];
        var result = categories[categoryName];
        var percentage = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;

        var div = document.createElement('div');
        div.className = 'category-result-item';
        div.setAttribute('role', 'listitem');

        // Determine color from config thresholds
        var color = '#64748b';
        for (var k = 0; k < CONFIG.CATEGORY_COLOR_THRESHOLDS.length; k++) {
            if (percentage >= CONFIG.CATEGORY_COLOR_THRESHOLDS[k].min) {
                color = CONFIG.CATEGORY_COLOR_THRESHOLDS[k].color;
                break;
            }
        }

        var nameSpan = document.createElement('span');
        nameSpan.className = 'category-result-name';
        nameSpan.textContent = categoryName;

        var scoreSpan = document.createElement('span');
        scoreSpan.className = 'category-result-score';
        scoreSpan.style.color = color;
        scoreSpan.textContent = result.correct + ' / ' + result.total + ' (' + percentage + '%)';

        div.appendChild(nameSpan);
        div.appendChild(scoreSpan);
        dom.categoryResults.appendChild(div);
    }
}

// ==================== Game Reset ====================

/**
 * Resets all game state to initial values and cancels pending timeouts.
 */
function resetGame() {
    clearAllTimeouts();
    gameState.currentQuestionIndex = 0;
    gameState.score = 0;
    gameState.userAnswers = [];
    gameState.isAnswering = false;
    gameState.questions = [];
    // Note: quizMode is NOT reset here — it persists across games
}

// ==================== Array Utilities ====================

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 * @param {Array} array - The array to shuffle.
 * @returns {Array} The same array, shuffled.
 */
function shuffleArrayInPlace(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

// ==================== Ranking System (Supabase + localStorage fallback) ====================

/**
 * Saves the current game result to Supabase, with localStorage fallback.
 * Returns a Promise (fire-and-forget from showResults).
 */
function saveRanking() {
    var totalQuestions = gameState.questions.length;
    var correctAnswerCount = 0;
    for (var i = 0; i < gameState.userAnswers.length; i++) {
        if (gameState.userAnswers[i].isCorrect) correctAnswerCount++;
    }
    var percentage = totalQuestions > 0 ? (correctAnswerCount / totalQuestions) * 100 : 0;
    var grade = getGrade(percentage);

    // Calculate per-category scores
    var categoryScores = {};
    for (var j = 0; j < gameState.userAnswers.length; j++) {
        var answer = gameState.userAnswers[j];
        if (!categoryScores[answer.category]) {
            categoryScores[answer.category] = { correct: 0, total: 0 };
        }
        categoryScores[answer.category].total++;
        if (answer.isCorrect) {
            categoryScores[answer.category].correct++;
        }
    }

    var now = new Date().toISOString();

    // Supabase record (snake_case columns)
    var dbRecord = {
        name: gameState.playerName,
        score: gameState.score,
        grade: grade.letter,
        correct_count: correctAnswerCount,
        total_questions: totalQuestions,
        category_scores: categoryScores,
        category: gameState.selectedCategory,
        mode: gameState.quizMode,
        played_at: now
    };

    // localStorage record (camelCase, legacy format)
    var localRecord = {
        name: gameState.playerName,
        score: gameState.score,
        grade: grade.letter,
        correctCount: correctAnswerCount,
        totalQuestions: totalQuestions,
        categoryScores: categoryScores,
        category: gameState.selectedCategory,
        mode: gameState.quizMode,
        date: now,
        timestamp: Date.now()
    };

    // Try Supabase first, fall back to localStorage
    if (supabaseClient) {
        return supabaseClient
            .from('rankings')
            .insert(dbRecord)
            .then(function (result) {
                if (result.error) {
                    console.warn('Supabase insert failed, falling back to localStorage:', result.error);
                    saveRankingToLocalStorage(localRecord);
                }
            })
            .catch(function (err) {
                console.warn('Supabase insert error, falling back to localStorage:', err);
                saveRankingToLocalStorage(localRecord);
            });
    }

    // No Supabase client — use localStorage directly
    saveRankingToLocalStorage(localRecord);
    return Promise.resolve();
}

/**
 * Saves a ranking record to localStorage (fallback).
 * @param {Object} record - The ranking record in localStorage format.
 */
function saveRankingToLocalStorage(record) {
    var rankings = getRankingsFromLocalStorage();
    rankings.push(record);
    rankings.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return b.timestamp - a.timestamp;
    });
    rankings = rankings.slice(0, CONFIG.MAX_RANKINGS);
    if (!Storage.set(CONFIG.STORAGE_KEY, rankings)) {
        console.warn('Failed to save ranking to localStorage.');
    }
}

/**
 * Retrieves rankings from localStorage (synchronous, for fallback).
 * @returns {Array} Validated rankings array.
 */
function getRankingsFromLocalStorage() {
    var rawData = Storage.get(CONFIG.STORAGE_KEY, []);
    return validateRankings(rawData);
}

/**
 * Retrieves rankings from Supabase, with localStorage fallback.
 * @returns {Promise<Array>} Rankings array.
 */
function getRankings() {
    if (supabaseClient) {
        return supabaseClient
            .from('rankings')
            .select('*')
            .order('score', { ascending: false })
            .order('played_at', { ascending: false })
            .limit(CONFIG.MAX_RANKINGS)
            .then(function (result) {
                if (result.error) {
                    console.warn('Supabase select failed, falling back to localStorage:', result.error);
                    return getRankingsFromLocalStorage();
                }
                // Map DB columns (snake_case) to display format (camelCase)
                return (result.data || []).map(function (row) {
                    return {
                        name: row.name,
                        score: row.score,
                        grade: row.grade,
                        correctCount: row.correct_count,
                        totalQuestions: row.total_questions,
                        categoryScores: row.category_scores || {},
                        category: row.category,
                        mode: row.mode,
                        date: row.played_at,
                        timestamp: new Date(row.played_at).getTime()
                    };
                });
            })
            .catch(function (err) {
                console.warn('Supabase select error, falling back to localStorage:', err);
                return getRankingsFromLocalStorage();
            });
    }

    return Promise.resolve(getRankingsFromLocalStorage());
}

/**
 * Shows the ranking modal with safe DOM construction (XSS-protected).
 */
async function showRankingModal() {
    var rankings = await getRankings();
    var rankingList = getElement('ranking-list');
    var emptyRanking = getElement('empty-ranking');

    if (!rankingList || !emptyRanking) return;

    if (rankings.length === 0) {
        rankingList.innerHTML = '';
        emptyRanking.classList.remove('hidden');
        announceToScreenReader('순위 기록이 없습니다');
    } else {
        emptyRanking.classList.add('hidden');
        rankingList.innerHTML = '';
        announceToScreenReader('명예의 전당 ' + rankings.length + '개 기록');

        for (var i = 0; i < rankings.length; i++) {
            var record = rankings[i];
            var rank = i + 1;
            var date = new Date(record.date);
            var dateStr = date.getFullYear() + '.' +
                String(date.getMonth() + 1).padStart(2, '0') + '.' +
                String(date.getDate()).padStart(2, '0') + ' ' +
                String(date.getHours()).padStart(2, '0') + ':' +
                String(date.getMinutes()).padStart(2, '0');

            var percentage = record.totalQuestions > 0
                ? Math.round((record.correctCount / record.totalQuestions) * 100)
                : 0;

            // Build the ranking item entirely with DOM API -- no innerHTML with user data
            var item = document.createElement('div');
            item.className = 'ranking-item' + (rank <= 3 ? ' top-' + rank : '');
            item.setAttribute('role', 'listitem');
            item.setAttribute('aria-label', '순위 ' + rank + ', ' + record.name + ', 점수 ' + record.score);

            // Rank display
            var rankDiv = document.createElement('div');
            rankDiv.className = 'ranking-rank';
            if (rank === 1) rankDiv.textContent = '🥇';
            else if (rank === 2) rankDiv.textContent = '🥈';
            else if (rank === 3) rankDiv.textContent = '🥉';
            else rankDiv.textContent = rank;

            // Info section
            var infoDiv = document.createElement('div');
            infoDiv.className = 'ranking-info';

            var nameDiv = document.createElement('div');
            nameDiv.className = 'ranking-name';
            nameDiv.textContent = record.name;  // Safe: textContent, not innerHTML

            var detailsDiv = document.createElement('div');
            detailsDiv.className = 'ranking-details';

            // Date detail
            var dateDetail = document.createElement('div');
            dateDetail.className = 'ranking-detail-item';
            var dateIcon = document.createElement('span');
            dateIcon.textContent = '📅';
            var dateText = document.createElement('span');
            dateText.textContent = dateStr;
            dateDetail.appendChild(dateIcon);
            dateDetail.appendChild(dateText);

            // Score detail
            var scoreDetail = document.createElement('div');
            scoreDetail.className = 'ranking-detail-item';
            var scoreIcon = document.createElement('span');
            scoreIcon.textContent = '✅';
            var scoreText = document.createElement('span');
            scoreText.textContent = record.correctCount + '/' + record.totalQuestions + ' (' + percentage + '%)';
            scoreDetail.appendChild(scoreIcon);
            scoreDetail.appendChild(scoreText);

            // Category detail
            var catDetail = document.createElement('div');
            catDetail.className = 'ranking-detail-item';
            var catIcon = document.createElement('span');
            catIcon.textContent = '📂';
            var catText = document.createElement('span');
            catText.textContent = record.category === 'all' ? '전체' : record.category;
            catDetail.appendChild(catIcon);
            catDetail.appendChild(catText);

            // Mode detail
            var modeDetail = document.createElement('div');
            modeDetail.className = 'ranking-detail-item';
            var modeIcon = document.createElement('span');
            modeIcon.textContent = record.mode === 'ai' ? '🤖' : '📋';
            var modeText = document.createElement('span');
            modeText.textContent = record.mode === 'ai' ? 'AI' : '기존';
            modeDetail.appendChild(modeIcon);
            modeDetail.appendChild(modeText);

            detailsDiv.appendChild(dateDetail);
            detailsDiv.appendChild(scoreDetail);
            detailsDiv.appendChild(catDetail);
            detailsDiv.appendChild(modeDetail);

            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(detailsDiv);

            // Score section
            var scoreDiv = document.createElement('div');
            scoreDiv.className = 'ranking-score';

            var scoreValueDiv = document.createElement('div');
            scoreValueDiv.className = 'ranking-score-value';
            scoreValueDiv.textContent = record.score;

            var gradeDiv = document.createElement('div');
            gradeDiv.className = 'ranking-grade grade-' + escapeHtml(record.grade);
            gradeDiv.textContent = record.grade + ' 등급';

            scoreDiv.appendChild(scoreValueDiv);
            scoreDiv.appendChild(gradeDiv);

            // Assemble
            item.appendChild(rankDiv);
            item.appendChild(infoDiv);
            item.appendChild(scoreDiv);

            rankingList.appendChild(item);
        }
    }

    if (dom.rankingModal) {
        showModal(dom.rankingModal);
    }
}

/**
 * Hides the ranking modal.
 */
function hideRankingModal() {
    if (dom.rankingModal) {
        hideModal(dom.rankingModal);
    }
}

/**
 * Clears all ranking data from Supabase and localStorage, then refreshes the modal.
 */
async function clearRanking() {
    Storage.remove(CONFIG.STORAGE_KEY);

    if (supabaseClient) {
        try {
            var result = await supabaseClient.from('rankings').delete().gte('id', 0);
            if (result.error) {
                console.warn('Supabase delete failed:', result.error);
            }
        } catch (err) {
            console.warn('Supabase delete error:', err);
        }
    }

    await showRankingModal();
}

// ==================== UX Enhancements ====================

/**
 * Announces a message to screen readers.
 * @param {string} message - The message to announce.
 */
function announceToScreenReader(message) {
    if (!dom.srAnnouncements) return;
    dom.srAnnouncements.textContent = message;
    // Clear after announcement to allow repeat announcements
    managedTimeout(function () {
        if (dom.srAnnouncements) {
            dom.srAnnouncements.textContent = '';
        }
    }, 1000);
}

/**
 * Shows an error message for the name input.
 * @param {string} message - The error message to display.
 */
function showNameError(message) {
    if (!dom.nameInput || !dom.nameError) return;

    dom.nameInput.setAttribute('aria-invalid', 'true');
    dom.nameInput.style.borderColor = '#ef4444';
    dom.nameError.textContent = message;
    dom.nameError.classList.remove('hidden');

    announceToScreenReader('오류: ' + message);

    managedTimeout(function () {
        if (dom.nameInput && dom.nameError) {
            dom.nameInput.style.borderColor = '';
            dom.nameInput.setAttribute('aria-invalid', 'false');
            dom.nameError.classList.add('hidden');
        }
    }, CONFIG.DELAY_INPUT_ERROR_RESET);
}

/**
 * Custom confirmation dialog to replace browser confirm().
 * @param {string} message - The confirmation message.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise.
 */
function confirmAction(message) {
    return new Promise(function (resolve) {
        if (!dom.confirmModal || !dom.confirmMessage) {
            resolve(confirm(message)); // Fallback to browser confirm
            return;
        }

        dom.confirmMessage.textContent = message;
        showModal(dom.confirmModal);

        function handleYes() {
            cleanup();
            resolve(true);
        }

        function handleNo() {
            cleanup();
            resolve(false);
        }

        function cleanup() {
            if (dom.confirmYes) dom.confirmYes.removeEventListener('click', handleYes);
            if (dom.confirmNo) dom.confirmNo.removeEventListener('click', handleNo);
            if (dom.confirmClose) dom.confirmClose.removeEventListener('click', handleNo);
            hideModal(dom.confirmModal);
        }

        if (dom.confirmYes) dom.confirmYes.addEventListener('click', handleYes);
        if (dom.confirmNo) dom.confirmNo.addEventListener('click', handleNo);
        if (dom.confirmClose) dom.confirmClose.addEventListener('click', handleNo);
    });
}

/**
 * Shows a modal with proper focus management.
 * @param {HTMLElement} modal - The modal element to show.
 */
function showModal(modal) {
    if (!modal) return;

    // Save current focus
    gameState.focusedElementBeforeModal = document.activeElement;

    // Show modal
    modal.classList.add('active');

    // Focus first focusable element in modal
    managedTimeout(function () {
        var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }, 100);

    // Trap focus in modal
    trapFocus(modal);
}

/**
 * Hides a modal and restores focus.
 * @param {HTMLElement} modal - The modal element to hide.
 */
function hideModal(modal) {
    if (!modal) return;

    modal.classList.remove('active');

    // Restore focus
    if (gameState.focusedElementBeforeModal && gameState.focusedElementBeforeModal.focus) {
        gameState.focusedElementBeforeModal.focus();
    }
    gameState.focusedElementBeforeModal = null;
}

/**
 * Traps keyboard focus within a modal.
 * @param {HTMLElement} modal - The modal element.
 */
function trapFocus(modal) {
    if (!modal) return;

    var focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableElements.length === 0) return;

    var firstFocusable = focusableElements[0];
    var lastFocusable = focusableElements[focusableElements.length - 1];

    function handleTabKey(e) {
        if (!modal.classList.contains('active')) {
            document.removeEventListener('keydown', handleTabKey);
            return;
        }

        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    }

    document.addEventListener('keydown', handleTabKey);
}

/**
 * Sets up keyboard navigation shortcuts.
 */
function setupKeyboardNavigation() {
    document.addEventListener('keydown', function (e) {
        // F1 - Help
        if (e.key === 'F1') {
            e.preventDefault();
            showHelpModal();
            return;
        }

        // Escape - Close modals
        if (e.key === 'Escape') {
            if (dom.rankingModal && dom.rankingModal.classList.contains('active')) {
                hideRankingModal();
            }
            if (dom.helpModal && dom.helpModal.classList.contains('active')) {
                hideModal(dom.helpModal);
            }
            if (dom.confirmModal && dom.confirmModal.classList.contains('active')) {
                hideModal(dom.confirmModal);
            }
            return;
        }

        // Number keys for quiz options (1-4)
        if (gameState.currentScreen === 'quiz' && !gameState.isAnswering) {
            var num = parseInt(e.key);
            if (num >= 1 && num <= 4) {
                var optionBtns = dom.optionsContainer ? dom.optionsContainer.querySelectorAll('.option-btn') : [];
                if (optionBtns[num - 1] && !optionBtns[num - 1].disabled) {
                    selectAnswer(num - 1);
                    announceToScreenReader('답 ' + num + '번 선택됨');
                }
            }
        }

        // Enter for next button in quiz
        if (gameState.currentScreen === 'quiz' && e.key === 'Enter') {
            if (dom.nextBtn && !dom.nextBtn.classList.contains('hidden')) {
                nextQuestion();
            }
        }
    });
}

/**
 * Shows the help modal.
 */
function showHelpModal() {
    if (!dom.helpModal) return;
    showModal(dom.helpModal);
    announceToScreenReader('도움말이 열렸습니다');
}

/**
 * Checks if this is the user's first visit and shows welcome overlay.
 */
function checkFirstTimeUser() {
    var hasSeenWelcome = Storage.get(CONFIG.WELCOME_SHOWN_KEY, false);

    if (!hasSeenWelcome && dom.welcomeOverlay) {
        managedTimeout(function () {
            dom.welcomeOverlay.classList.remove('hidden');
            announceToScreenReader('Quiz Master에 오신 것을 환영합니다');
        }, 500);
    }
}

/**
 * Updates category button aria-pressed states.
 */
function updateCategoryAriaPressed() {
    if (!dom.categoryCards) return;

    dom.categoryCards.forEach(function (card) {
        var isSelected = card.classList.contains('selected');
        card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

/**
 * Updates mode button aria-pressed states.
 */
function updateModeAriaPressed() {
    if (!dom.modeCards) return;

    dom.modeCards.forEach(function (card) {
        var isSelected = card.classList.contains('selected');
        card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

/**
 * Updates category count display based on quiz mode.
 * AI mode: all categories show AI_QUESTION_COUNT.
 * Local mode: restores original counts from loaded data.
 */
function updateCategoryCountDisplay() {
    if (!dom.categoryCards) return;

    dom.categoryCards.forEach(function (card) {
        var countEl = card.querySelector('.category-count');
        if (!countEl) return;

        if (gameState.quizMode === 'ai') {
            countEl.textContent = CONFIG.AI_QUESTION_COUNT + '문제';
        } else {
            // Restore original counts from data
            var category = card.dataset.category;
            if (category === 'all') {
                var total = gameState.questionsData ? gameState.questionsData.length : 40;
                countEl.textContent = total + '문제';
            } else {
                var count = 0;
                if (gameState.questionsData) {
                    for (var i = 0; i < gameState.questionsData.length; i++) {
                        if (gameState.questionsData[i].category === category) count++;
                    }
                }
                countEl.textContent = (count || 10) + '문제';
            }
        }
    });
}
