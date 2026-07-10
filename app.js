// ============================================================
// True Realtime Translate — Core Application Logic
// Uses: Web Speech API (STT + TTS) + MyMemory API (Translation)
// ============================================================

(() => {
  'use strict';

  // ---- Language Configuration ----
  const LANGUAGES = [
    { code: 'en',    recognition: 'en-US',    name: 'English' },
    { code: 'zh-TW', recognition: 'zh-TW',    name: 'Chinese (Traditional)' },
    { code: 'zh-CN', recognition: 'zh-CN',    name: 'Chinese (Mandarin)' },
    { code: 'es',    recognition: 'es-ES',    name: 'Spanish' },
    { code: 'fr',    recognition: 'fr-FR',    name: 'French' },
    { code: 'de',    recognition: 'de-DE',    name: 'German' },
    { code: 'it',    recognition: 'it-IT',    name: 'Italian' },
    { code: 'pt',    recognition: 'pt-BR',    name: 'Portuguese' },
    { code: 'ja',    recognition: 'ja-JP',    name: 'Japanese' },
    { code: 'ko',    recognition: 'ko-KR',    name: 'Korean' },
    { code: 'ru',    recognition: 'ru-RU',    name: 'Russian' },
    { code: 'ar',    recognition: 'ar-SA',    name: 'Arabic' },
    { code: 'hi',    recognition: 'hi-IN',    name: 'Hindi' },
    { code: 'fil',   recognition: 'fil-PH',   name: 'Filipino' },
    { code: 'th',    recognition: 'th-TH',    name: 'Thai' },
    { code: 'vi',    recognition: 'vi-VN',    name: 'Vietnamese' },
    { code: 'id',    recognition: 'id-ID',    name: 'Indonesian' },
    { code: 'ms',    recognition: 'ms-MY',    name: 'Malay' },
    { code: 'nl',    recognition: 'nl-NL',    name: 'Dutch' },
    { code: 'pl',    recognition: 'pl-PL',    name: 'Polish' },
    { code: 'tr',    recognition: 'tr-TR',    name: 'Turkish' },
    { code: 'uk',    recognition: 'uk-UA',    name: 'Ukrainian' },
    { code: 'sv',    recognition: 'sv-SE',    name: 'Swedish' },
    { code: 'cs',    recognition: 'cs-CZ',    name: 'Czech' },
    { code: 'ro',    recognition: 'ro-RO',    name: 'Romanian' },
  ];

  // ---- UI Strings for Localization ----
  const UI_STRINGS = {
    'en': {
      title: "Realtime Translate",
      subtitle: "Speak naturally, translate instantly",
      compatBanner: "Your browser doesn't support the Web Speech API. Please try using Chrome or Edge for full functionality.",
      youSpeak: "You Speak",
      translateTo: "Translate To",
      tapToStart: "Tap to start",
      listening: "Listening...",
      speakingAndListening: "Speaking & Listening...",
      speakingTranslation: "Speaking translation...",
      speech: "Speech",
      speechPlaceholder: "Your speech will appear here...",
      translation: "Translation",
      translationPlaceholder: "Translation will appear here...",
      speakBtn: "Speak",
      clearBtn: "Clear",
      historyLog: "History Log",
      advancedSettings: "Advanced Settings",
      autoSpeak: "Auto-speak translation",
      customApi: "Custom LibreTranslate URL (Optional)",
      customApiHint: "Leave blank to use the free MyMemory translation API.",
      initializing: "Initializing...",
      ready: "Ready",
      browserNotSupported: "Browser not supported",
      micBlocked: "Mic blocked",
      networkError: "Network error",
      failedToStart: "Failed to start",
      translating: "Translating...",
      translationFailed: "Translation failed",
      speakNow: "Speak now..."
    },
    'zh-TW': {
      title: "即時翻譯",
      subtitle: "自然說話，即時翻譯",
      compatBanner: "您的瀏覽器不支援 Web Speech API。請嘗試使用 Chrome 或 Edge 以獲得完整功能。",
      youSpeak: "您說",
      translateTo: "翻譯為",
      tapToStart: "點擊開始",
      listening: "聆聽中...",
      speakingAndListening: "說話與聆聽中...",
      speakingTranslation: "朗讀翻譯中...",
      speech: "語音",
      speechPlaceholder: "您的語音將顯示於此...",
      translation: "翻譯",
      translationPlaceholder: "翻譯結果將顯示於此...",
      speakBtn: "朗讀",
      clearBtn: "清除",
      historyLog: "歷史記錄",
      advancedSettings: "進階設定",
      autoSpeak: "自動朗讀翻譯",
      customApi: "自訂 LibreTranslate 網址 (選填)",
      customApiHint: "留白以使用免費的 MyMemory 翻譯 API。",
      initializing: "初始化中...",
      ready: "就緒",
      browserNotSupported: "瀏覽器不支援",
      micBlocked: "麥克風被阻擋",
      networkError: "網路錯誤",
      failedToStart: "啟動失敗",
      translating: "翻譯中...",
      translationFailed: "翻譯失敗",
      speakNow: "請開始說話..."
    }
  };

  let currentUiLang = 'en';

  // ---- DOM Elements ----
  const $ = (sel) => document.querySelector(sel);
  const $uiLang        = $('#ui-lang');
  const $sourceLang    = $('#source-lang');
  const $targetLang    = $('#target-lang');
  const $swapBtn       = $('#swap-btn');
  const $micBtn        = $('#mic-btn');
  const $micStatus     = $('#mic-status');
  const $sourceText    = $('#source-text');
  const $targetText    = $('#target-text');
  const $sourceBadge   = $('#source-badge');
  const $targetBadge   = $('#target-badge');
  const $speakBtn      = $('#speak-btn');
  const $clearBtn      = $('#clear-btn');
  const $settingsToggle = $('#settings-toggle');
  const $settingsBody  = $('#settings-body');
  const $autoSpeak     = $('#auto-speak');
  const $apiUrl        = $('#api-url');
  const $statusDot     = $('#status-dot');
  const $statusText    = $('#status-text');
  const $compatBanner  = $('#compat-banner');
  const $historyList   = $('#history-list');

  // ---- State ----
  let isListening = false;
  let recognition = null;
  let isSpeaking = false;
  let pendingRestart = false;
  let translationDebounce = null;

  // Transcript management — split into "committed" (from previous recognition
  // sessions) and "current session" (from the active recognition object).
  // This prevents Android Chrome's buggy result replaying from causing duplication.
  let committedTranscript = '';      // Finalized text from previous sessions
  let sessionProcessedCount = 0;     // How many final results we've already translated in this session
  let currentSessionFinal = '';      // Track final text of the active session

  // ---- Initialization ----
  function init() {
    populateLanguageSelectors();
    loadSettings();
    applyUiLanguage();
    checkCompatibility();
    bindEvents();
    updateBadges();
    setStatus(t('ready'), 'ready');
  }

  function t(key) {
    return UI_STRINGS[currentUiLang][key] || UI_STRINGS['en'][key] || key;
  }

  function applyUiLanguage() {
    const strings = UI_STRINGS[currentUiLang] || UI_STRINGS['en'];
    
    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (strings[key]) {
        el.textContent = strings[key];
      }
    });

    // Update dynamic text
    if ($sourceText.classList.contains('placeholder')) {
      $sourceText.textContent = isListening ? t('speakNow') : t('speechPlaceholder');
    }
    if ($targetText.classList.contains('placeholder')) {
      $targetText.textContent = t('translationPlaceholder');
    }

    if (!isListening && !isSpeaking) {
      $micStatus.textContent = t('tapToStart');
    } else if (isListening && !isSpeaking) {
      $micStatus.textContent = t('listening');
    } else if (isListening && isSpeaking) {
      $micStatus.textContent = t('speakingAndListening');
    } else if (isSpeaking) {
      $micStatus.textContent = t('speakingTranslation');
    }

    if ($statusDot.classList.contains('ready')) {
      $statusText.textContent = t('ready');
    }
  }

  function populateLanguageSelectors() {
    LANGUAGES.forEach(lang => {
      const opt1 = new Option(lang.name, lang.code);
      const opt2 = new Option(lang.name, lang.code);
      $sourceLang.appendChild(opt1);
      $targetLang.appendChild(opt2);
    });
    $sourceLang.value = 'en';
    $targetLang.value = 'zh-TW';
  }

  function checkCompatibility() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $compatBanner.classList.add('show');
      $micBtn.disabled = true;
      $micBtn.style.opacity = '0.4';
      $micBtn.style.cursor = 'not-allowed';
      setStatus(t('browserNotSupported'), 'error');
      return false;
    }
    if (!window.speechSynthesis) {
      console.warn('SpeechSynthesis not available — TTS will be disabled');
    }
    return true;
  }

  // ---- Settings Persistence ----
  function loadSettings() {
    const saved = localStorage.getItem('trt-settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.uiLang) {
          currentUiLang = s.uiLang;
          $uiLang.value = s.uiLang;
        }
        if (s.sourceLang) $sourceLang.value = s.sourceLang;
        if (s.targetLang) $targetLang.value = s.targetLang;
        if (s.autoSpeak !== undefined) $autoSpeak.checked = s.autoSpeak;
        if (s.apiUrl) $apiUrl.value = s.apiUrl;
      } catch (e) { /* ignore corrupt data */ }
    }
  }

  function saveSettings() {
    localStorage.setItem('trt-settings', JSON.stringify({
      uiLang: $uiLang.value,
      sourceLang: $sourceLang.value,
      targetLang: $targetLang.value,
      autoSpeak: $autoSpeak.checked,
      apiUrl: $apiUrl.value,
    }));
  }

  // ---- Event Bindings ----
  function bindEvents() {
    $uiLang.addEventListener('change', () => {
      currentUiLang = $uiLang.value;
      applyUiLanguage();
      saveSettings();
    });

    $micBtn.addEventListener('click', toggleListening);
    $swapBtn.addEventListener('click', swapLanguages);
    $speakBtn.addEventListener('click', () => speakText($targetText.textContent, $targetLang.value));
    $clearBtn.addEventListener('click', clearAll);

    $settingsToggle.addEventListener('click', () => {
      $settingsToggle.classList.toggle('open');
      $settingsBody.classList.toggle('open');
    });

    $sourceLang.addEventListener('change', () => {
      updateBadges();
      saveSettings();
      if (isListening) { stopListening(); startListening(); }
    });

    $targetLang.addEventListener('change', () => {
      updateBadges();
      saveSettings();
    });

    $autoSpeak.addEventListener('change', saveSettings);
    $apiUrl.addEventListener('change', saveSettings);

    // Prevent page sleep on mobile
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isListening) {
        // Some browsers stop recognition when tab is hidden
        // We'll let it continue and rely on auto-restart
      }
    });
  }

  // ---- Language Helpers ----
  function getLangByCode(code) {
    return LANGUAGES.find(l => l.code === code);
  }

  // De-duplicates overlapping boundary text between two consecutive recognition sessions.
  // Handles space-separated languages (word-level) and character-based languages (Chinese, Japanese).
  function mergeOverlap(str1, str2, langCode) {
    const isSpaceSeparated = !(['zh', 'ja', 'ko'].some(prefix => langCode.startsWith(prefix)));
    
    if (isSpaceSeparated) {
      const words1 = str1.trim().split(/\s+/).filter(Boolean);
      const words2 = str2.trim().split(/\s+/).filter(Boolean);
      
      if (words1.length === 0) return str2;
      if (words2.length === 0) return str1;
      
      const maxOverlap = Math.min(words1.length, words2.length);
      let overlapCount = 0;
      
      for (let len = 1; len <= maxOverlap; len++) {
        let match = true;
        for (let i = 0; i < len; i++) {
          const w1 = words1[words1.length - len + i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
          const w2 = words2[i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
          if (w1 !== w2) {
            match = false;
            break;
          }
        }
        if (match) {
          overlapCount = len;
        }
      }
      
      if (overlapCount > 0) {
        const nonOverlapping = words2.slice(overlapCount).join(' ');
        return str1.trim() + (nonOverlapping ? ' ' + nonOverlapping : '') + ' ';
      }
      return str1.trim() + ' ' + str2.trim() + ' ';
    } else {
      const s1 = str1.trim();
      const s2 = str2.trim();
      if (!s1) return s2;
      if (!s2) return s1;
      
      const maxOverlap = Math.min(s1.length, s2.length);
      let overlapCount = 0;
      
      for (let len = 1; len <= maxOverlap; len++) {
        const sub1 = s1.slice(-len);
        const sub2 = s2.slice(0, len);
        if (sub1 === sub2) {
          overlapCount = len;
        }
      }
      
      if (overlapCount > 0) {
        return s1 + s2.slice(overlapCount);
      }
      return s1 + s2;
    }
  }

  // Returns only the non-overlapping part of newStr to prevent translating/speaking
  // duplicate text already sent in a previous session.
  function getNonOverlappingPart(baseStr, newStr, langCode) {
    const isSpaceSeparated = !(['zh', 'ja', 'ko'].some(prefix => langCode.startsWith(prefix)));
    
    if (isSpaceSeparated) {
      const wordsBase = baseStr.trim().split(/\s+/).filter(Boolean);
      const wordsNew = newStr.trim().split(/\s+/).filter(Boolean);
      
      if (wordsBase.length === 0) return newStr;
      if (wordsNew.length === 0) return '';
      
      const maxOverlap = Math.min(wordsBase.length, wordsNew.length);
      let overlapCount = 0;
      
      for (let len = 1; len <= maxOverlap; len++) {
        let match = true;
        for (let i = 0; i < len; i++) {
          const w1 = wordsBase[wordsBase.length - len + i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
          const w2 = wordsNew[i].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
          if (w1 !== w2) {
            match = false;
            break;
          }
        }
        if (match) {
          overlapCount = len;
        }
      }
      
      if (overlapCount > 0) {
        return wordsNew.slice(overlapCount).join(' ');
      }
      return newStr;
    } else {
      const s1 = baseStr.trim();
      const s2 = newStr.trim();
      if (!s1) return s2;
      if (!s2) return '';
      
      const maxOverlap = Math.min(s1.length, s2.length);
      let overlapCount = 0;
      
      for (let len = 1; len <= maxOverlap; len++) {
        const sub1 = s1.slice(-len);
        const sub2 = s2.slice(0, len);
        if (sub1 === sub2) {
          overlapCount = len;
        }
      }
      
      if (overlapCount > 0) {
        return s2.slice(overlapCount);
      }
      return s2;
    }
  }

  function updateBadges() {
    const src = getLangByCode($sourceLang.value);
    const tgt = getLangByCode($targetLang.value);
    $sourceBadge.textContent = src ? src.code.toUpperCase() : '';
    $targetBadge.textContent = tgt ? tgt.code.toUpperCase() : '';
  }

  function swapLanguages() {
    const tmp = $sourceLang.value;
    $sourceLang.value = $targetLang.value;
    $targetLang.value = tmp;
    updateBadges();
    saveSettings();

    // Also swap the displayed text
    const tmpText = $sourceText.textContent;
    const isSrcPlaceholder = $sourceText.classList.contains('placeholder');
    const isTgtPlaceholder = $targetText.classList.contains('placeholder');

    if (!isTgtPlaceholder) {
      $sourceText.textContent = $targetText.textContent;
      $sourceText.classList.remove('placeholder');
    }
    if (!isSrcPlaceholder) {
      $targetText.textContent = tmpText;
      $targetText.classList.remove('placeholder');
    }

    if (isListening) {
      stopListening();
      startListening();
    }
  }

  // ---- Speech Recognition ----
  function toggleListening() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // Creates a fresh SpeechRecognition object and wires up all handlers.
  // Called both on initial start and on auto-restart after silence/error.
  function createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    const srcLang = getLangByCode($sourceLang.value);
    rec.lang = srcLang ? srcLang.recognition : 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      isListening = true;
      sessionProcessedCount = 0; // Reset for this fresh session
      $micBtn.classList.add('active');
      $micStatus.textContent = t('listening');
      $micStatus.className = 'mic-status listening';
      setStatus(t('listening'), 'ready');
    };

    rec.onresult = (event) => {
      let sessionFinal = '';
      let interimTranscript = '';
      let newChunks = [];

      // Always iterate from 0 — Android Chrome's resultIndex is unreliable
      for (let i = 0; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          sessionFinal += text + ' ';
          // Only translate chunks we haven't processed yet in THIS session
          if (i >= sessionProcessedCount) {
            newChunks.push(text);
            sessionProcessedCount = i + 1;
          }
        } else {
          interimTranscript += text;
        }
      }

      currentSessionFinal = sessionFinal;

      // Build display: merge committed (previous sessions) with this session's finals, then merge with interim
      const langCode = $sourceLang.value;
      const displayFinal = mergeOverlap(committedTranscript, currentSessionFinal, langCode);
      const displayTotal = mergeOverlap(displayFinal, interimTranscript, langCode);

      if (displayTotal) {
        $sourceText.classList.remove('placeholder');
        
        // Find where the interim portion starts to highlight it
        if (interimTranscript) {
          const finalClean = displayFinal.trim();
          const totalClean = displayTotal.trim();
          if (totalClean.startsWith(finalClean) && totalClean.length > finalClean.length) {
            const interimPart = totalClean.slice(finalClean.length);
            $sourceText.innerHTML = escapeHtml(finalClean) + ' ' + `<span class="interim">${escapeHtml(interimPart.trim())}</span>`;
          } else {
            $sourceText.textContent = displayTotal;
          }
        } else {
          $sourceText.textContent = displayTotal;
        }
      }

      // Translate only genuinely new chunks
      newChunks.forEach(chunk => {
        const trimmed = chunk.trim();
        if (trimmed) {
          // De-duplicate the chunk against what we have already committed + previous finals in this session
          const context = mergeOverlap(committedTranscript, currentSessionFinal.replace(chunk, ''), langCode);
          const uniqueChunk = getNonOverlappingPart(context, trimmed, langCode);
          if (uniqueChunk.trim()) {
            translateText(uniqueChunk.trim());
          }
        }
      });
    };

    rec.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicStatus(t('micBlocked'), 'error');
        setStatus(t('micBlocked'), 'error');
        stopListening();
        return;
      }
      if (event.error === 'network') {
        setMicStatus(t('networkError'), 'error');
      }
    };

    rec.onend = () => {
      if (!isListening) return; // User pressed stop — don't restart

      // Merge currentSessionFinal into committedTranscript using mergeOverlap
      committedTranscript = mergeOverlap(committedTranscript, currentSessionFinal, $sourceLang.value);
      currentSessionFinal = '';
      sessionProcessedCount = 0;

      // Create a brand-new recognition object to avoid Android replaying old results
      if (!pendingRestart) {
        pendingRestart = true;
        setTimeout(() => {
          pendingRestart = false;
          if (isListening) {
            try {
              recognition = createRecognition();
              if (recognition) recognition.start();
            } catch (e) {
              console.warn('Failed to restart recognition:', e);
              stopListening();
            }
          }
        }, 300);
      }
    };

    return rec;
  }

  function startListening() {
    committedTranscript = '';
    sessionProcessedCount = 0;

    recognition = createRecognition();
    if (!recognition) return;

    try {
      recognition.start();
      $sourceText.textContent = t('speakNow');
      $sourceText.classList.add('placeholder');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setStatus(t('failedToStart'), 'error');
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) {
      try { recognition.stop(); } catch (e) { /* ignore */ }
      recognition = null;
    }
    $micBtn.classList.remove('active');
    $micStatus.textContent = t('tapToStart');
    $micStatus.className = 'mic-status';
    setStatus(t('ready'), 'ready');
  }

  function setMicStatus(text, cls) {
    $micStatus.textContent = text;
    $micStatus.className = `mic-status ${cls || ''}`;
  }

  // ---- Translation ----
  function debouncedTranslate(text) {
    clearTimeout(translationDebounce);
    translationDebounce = setTimeout(() => translateText(text), 400);
  }

  async function translateText(text) {
    if (!text) return;

    const sourceLang = $sourceLang.value;
    const targetLang = $targetLang.value;

    if (sourceLang === targetLang) {
      $targetText.textContent = text;
      $targetText.classList.remove('placeholder');
      if ($autoSpeak.checked) speakText(text, targetLang);
      return;
    }

    setStatus(t('translating'), 'ready');

    try {
      const translated = await callTranslationAPI(text, sourceLang, targetLang);
      $targetText.textContent = translated;
      $targetText.classList.remove('placeholder');

      // Add to history
      addHistory(text, translated);

      // Auto-speak if enabled
      if ($autoSpeak.checked) {
        speakText(translated, targetLang);
      }

      setStatus(t('listening'), 'ready');
    } catch (err) {
      console.error('Translation error:', err);
      $targetText.textContent = `[${t('translationFailed')}: ${err.message}]`;
      $targetText.classList.remove('placeholder');
      setStatus(t('translationFailed'), 'error');
      setTimeout(() => {
        if (isListening) setStatus(t('listening'), 'ready');
      }, 3000);
    }
  }

  async function callTranslationAPI(text, from, to) {
    const customUrl = $apiUrl.value.trim();

    if (customUrl) {
      // LibreTranslate-compatible API
      return callLibreTranslate(customUrl, text, from, to);
    }

    // Default: MyMemory API (free, no key)
    return callMyMemory(text, from, to);
  }

  async function callMyMemory(text, from, to) {
    // MyMemory uses simple lang codes; handle zh-CN → zh, zh-TW → zh-TW
    const fromCode = from === 'zh-CN' ? 'zh' : from;
    const toCode = to === 'zh-CN' ? 'zh' : to;
    const langPair = `${fromCode}|${toCode}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.responseStatus === 200 && data.responseData) {
      const translated = data.responseData.translatedText;
      // MyMemory sometimes returns all-caps for short text
      if (translated === translated.toUpperCase() && translated.length > 3) {
        return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
      }
      return translated;
    }
    throw new Error(data.responseDetails || 'Translation failed');
  }

  async function callLibreTranslate(baseUrl, text, from, to) {
    const fromCode = from.split('-')[0];
    const toCode = to.split('-')[0];
    const url = baseUrl.replace(/\/+$/, '') + '/translate';

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: fromCode, target: toCode, format: 'text' }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.translatedText;
  }

  // ---- Text-to-Speech ----
  function speakText(text, langCode) {
    if (!text || !window.speechSynthesis) return;

    // We no longer cancel ongoing speech. 
    // The Web Speech API will naturally queue the utterances.

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = getLangByCode(langCode);
    utterance.lang = lang ? lang.recognition : langCode;
    utterance.rate = 0.95;
    utterance.pitch = 1;

    // Try to find a matching voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = langCode.split('-')[0];
    const matchedVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (matchedVoice) utterance.voice = matchedVoice;

    // We no longer pause recognition here, allowing true continuous listening.
    // Ensure you use headphones or devices with good echo cancellation.

    utterance.onstart = () => {
      isSpeaking = true;
      if (isListening) setMicStatus(t('speakingAndListening'), 'speaking');
      else setMicStatus(t('speakingTranslation'), 'speaking');
    };

    utterance.onend = () => {
      // Only reset speaking state if there's nothing left in the queue
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        isSpeaking = false;
        if (isListening) {
          setMicStatus(t('listening'), 'listening');
          setStatus(t('listening'), 'ready');
        } else {
          setMicStatus(t('tapToStart'), '');
        }
      }
    };

    utterance.onerror = (e) => {
      console.warn('TTS error:', e);
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        isSpeaking = false;
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  // ---- History ----
  function addHistory(original, translated) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div>${escapeHtml(translated)}</div>
      <div class="original">${escapeHtml(original)}</div>
    `;
    $historyList.prepend(item);

    // Keep up to 100 items for a full session chat history
    while ($historyList.children.length > 100) {
      $historyList.removeChild($historyList.lastChild);
    }
  }

  // ---- UI Helpers ----
  function clearAll() {
    committedTranscript = '';
    sessionProcessedCount = 0;
    $sourceText.textContent = isListening ? t('speakNow') : t('speechPlaceholder');
    $sourceText.classList.add('placeholder');
    $targetText.textContent = t('translationPlaceholder');
    $targetText.classList.add('placeholder');
    $historyList.innerHTML = '';
  }

  function setStatus(text, state) {
    $statusText.textContent = text;
    $statusDot.className = `status-dot ${state || ''}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Preload TTS Voices ----
  if (window.speechSynthesis) {
    // Voices may not be available immediately
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

  // ---- Boot ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
