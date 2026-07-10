// ============================================================
// True Realtime Translate — Core Application Logic
// Uses: Web Speech API (STT + TTS) + MyMemory API (Translation)
// ============================================================

(() => {
  'use strict';

  // ---- Language Configuration ----
  const LANGUAGES = [
    { code: 'en',    recognition: 'en-US',    name: 'English' },
    { code: 'es',    recognition: 'es-ES',    name: 'Spanish' },
    { code: 'fr',    recognition: 'fr-FR',    name: 'French' },
    { code: 'de',    recognition: 'de-DE',    name: 'German' },
    { code: 'it',    recognition: 'it-IT',    name: 'Italian' },
    { code: 'pt',    recognition: 'pt-BR',    name: 'Portuguese' },
    { code: 'ja',    recognition: 'ja-JP',    name: 'Japanese' },
    { code: 'ko',    recognition: 'ko-KR',    name: 'Korean' },
    { code: 'zh-CN', recognition: 'zh-CN',    name: 'Chinese (Mandarin)' },
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

  // ---- DOM Elements ----
  const $ = (sel) => document.querySelector(sel);
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
  let currentFinalTranscript = '';

  // ---- Initialization ----
  function init() {
    populateLanguageSelectors();
    loadSettings();
    checkCompatibility();
    bindEvents();
    updateBadges();
    setStatus('Ready', 'ready');
  }

  function populateLanguageSelectors() {
    LANGUAGES.forEach(lang => {
      const opt1 = new Option(lang.name, lang.code);
      const opt2 = new Option(lang.name, lang.code);
      $sourceLang.appendChild(opt1);
      $targetLang.appendChild(opt2);
    });
    $sourceLang.value = 'en';
    $targetLang.value = 'es';
  }

  function checkCompatibility() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      $compatBanner.classList.add('show');
      $micBtn.disabled = true;
      $micBtn.style.opacity = '0.4';
      $micBtn.style.cursor = 'not-allowed';
      setStatus('Browser not supported', 'error');
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
        if (s.sourceLang) $sourceLang.value = s.sourceLang;
        if (s.targetLang) $targetLang.value = s.targetLang;
        if (s.autoSpeak !== undefined) $autoSpeak.checked = s.autoSpeak;
        if (s.apiUrl) $apiUrl.value = s.apiUrl;
      } catch (e) { /* ignore corrupt data */ }
    }
  }

  function saveSettings() {
    localStorage.setItem('trt-settings', JSON.stringify({
      sourceLang: $sourceLang.value,
      targetLang: $targetLang.value,
      autoSpeak: $autoSpeak.checked,
      apiUrl: $apiUrl.value,
    }));
  }

  // ---- Event Bindings ----
  function bindEvents() {
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

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    const srcLang = getLangByCode($sourceLang.value);
    recognition.lang = srcLang ? srcLang.recognition : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    currentFinalTranscript = '';

    recognition.onstart = () => {
      isListening = true;
      $micBtn.classList.add('active');
      $micStatus.textContent = 'Listening...';
      $micStatus.className = 'mic-status listening';
      setStatus('Listening', 'ready');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let newFinalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (newFinalTranscript) {
        currentFinalTranscript += newFinalTranscript;
      }

      // Display transcript
      const displayFinal = currentFinalTranscript;
      const displayInterim = interimTranscript;

      if (displayFinal || displayInterim) {
        $sourceText.classList.remove('placeholder');
        $sourceText.innerHTML = escapeHtml(displayFinal) +
          (displayInterim ? `<span class="interim">${escapeHtml(displayInterim)}</span>` : '');
      }

      // Translate on final result (only the new chunk)
      if (newFinalTranscript) {
        translateText(newFinalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // This is normal — just means silence
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicStatus('Microphone access denied', 'error');
        setStatus('Mic blocked', 'error');
        stopListening();
        return;
      }
      if (event.error === 'network') {
        setMicStatus('Network error', 'error');
        // Will auto-restart via onend
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListening && !pendingRestart) {
        pendingRestart = true;
        setTimeout(() => {
          pendingRestart = false;
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              console.warn('Failed to restart recognition:', e);
              stopListening();
            }
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      $sourceText.textContent = 'Speak now...';
      $sourceText.classList.add('placeholder');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setStatus('Failed to start', 'error');
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) {
      try { recognition.stop(); } catch (e) { /* ignore */ }
      recognition = null;
    }
    $micBtn.classList.remove('active');
    $micStatus.textContent = 'Tap to start';
    $micStatus.className = 'mic-status';
    setStatus('Ready', 'ready');
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

    setStatus('Translating...', 'ready');

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

      setStatus('Listening', 'ready');
    } catch (err) {
      console.error('Translation error:', err);
      $targetText.textContent = `[Translation error: ${err.message}]`;
      $targetText.classList.remove('placeholder');
      setStatus('Translation failed', 'error');
      setTimeout(() => {
        if (isListening) setStatus('Listening', 'ready');
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
    // MyMemory uses simple lang codes; handle zh-CN → zh
    const fromCode = from.split('-')[0];
    const toCode = to.split('-')[0];
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

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

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
      if (isListening) setMicStatus('Speaking & Listening...', 'speaking');
      else setMicStatus('Speaking translation...', 'speaking');
    };

    utterance.onend = () => {
      isSpeaking = false;
      if (isListening) {
        setMicStatus('Listening...', 'listening');
        setStatus('Listening', 'ready');
      } else {
        setMicStatus('Tap to start', '');
      }
    };

    utterance.onerror = (e) => {
      isSpeaking = false;
      console.warn('TTS error:', e);
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

    // Keep max 20 items
    while ($historyList.children.length > 20) {
      $historyList.removeChild($historyList.lastChild);
    }
  }

  // ---- UI Helpers ----
  function clearAll() {
    currentFinalTranscript = '';
    $sourceText.textContent = isListening ? 'Speak now...' : 'Your speech will appear here...';
    $sourceText.classList.add('placeholder');
    $targetText.textContent = 'Translation will appear here...';
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
