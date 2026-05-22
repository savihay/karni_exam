(function () {
  "use strict";

  const HEB_LETTERS = ["א", "ב", "ג", "ד"];

  const els = {
    pair: document.getElementById("pair"),
    options: document.getElementById("options"),
    progress: document.getElementById("progress"),
    score: document.getElementById("score"),
    progressFill: document.getElementById("progress-fill"),
    feedback: document.getElementById("feedback"),
    feedbackTitle: document.getElementById("feedback-title"),
    fbPair: document.getElementById("fb-pair"),
    fbCorrect: document.getElementById("fb-correct"),
    explanation: document.getElementById("explanation"),
    nextBtn: document.getElementById("next-btn"),
    backBtn: document.getElementById("back-btn"),
    muteBtn: document.getElementById("mute-btn"),
    promptLabel: document.getElementById("prompt-label"),
    topbar: document.querySelector(".topbar"),
    topbarTitle: document.getElementById("topbar-title"),
    subjectsScreen: document.getElementById("subjects-screen"),
    subjectList: document.getElementById("subject-list"),
    homeScreen: document.getElementById("home-screen"),
    chaptersTitle: document.getElementById("chapters-title"),
    chapterList: document.getElementById("chapter-list"),
    overallProgress: document.getElementById("overall-progress"),
    resetBtn: document.getElementById("reset-btn"),
    quizScreen: document.getElementById("quiz-screen"),
    resultsScreen: document.getElementById("results-screen"),
    resultsTitle: document.getElementById("results-title"),
    finalScore: document.getElementById("final-score"),
    finalMsg: document.getElementById("final-msg"),
    nextChapterBtn: document.getElementById("next-chapter-btn"),
    playAgain: document.getElementById("play-again"),
  };

  // ─── Subjects & chapters ─────────────────────────────
  const CHAPTER_SIZE = 10;
  function buildChapters(questions) {
    const out = [];
    for (let i = 0; i < questions.length; i += CHAPTER_SIZE) {
      out.push({
        index: out.length,
        title: "פרק " + (out.length + 1),
        questionIndices: questions.map((_, j) => j).slice(i, i + CHAPTER_SIZE),
      });
    }
    return out;
  }

  const SUBJECTS = [
    {
      id: "yachasei-milim",
      title: "יחסי מילים",
      description: "מציאת הקשר הלוגי בין זוגות מילים",
      icon: "🔤",
      type: "relations",
      promptLabel: "מצא את הזוג בעל היחס הדומה:",
      questions: QUESTIONS,
      chapters: buildChapters(QUESTIONS),
    },
    {
      id: "baayot-milulot",
      title: "חשיבה כמותית ובעיות מילוליות",
      description: "פתרון בעיות חשבון בסיפור",
      icon: "🧮",
      type: "paragraph",
      promptLabel: "קרא בעיון ופתור את הבעיה:",
      questions: WORD_PROBLEMS,
      chapters: buildChapters(WORD_PROBLEMS),
    },
    {
      id: "hashlamat-mishpatim",
      title: "השלמת משפטים בעברית",
      description: "השלמת המילה החסרה לפי ההקשר",
      icon: "📝",
      type: "paragraph",
      promptLabel: "השלם את המשפט במילה המתאימה ביותר:",
      questions: SENTENCE_COMPLETION,
      chapters: buildChapters(SENTENCE_COMPLETION),
    },
  ];

  const PROGRESS_KEY = "karni_subject_progress";
  function loadAllProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveAllProgress(p) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
      return true;
    } catch (e) {
      // localStorage may be unavailable (private mode) or full.
      console.warn("Failed to save progress:", e);
      return false;
    }
  }
  function loadProgress(subjectId) {
    return loadAllProgress()[subjectId] || {};
  }
  function markCompleted(subjectId, chapterIdx, score, total) {
    const all = loadAllProgress();
    const subj = all[subjectId] || {};
    const prev = subj[chapterIdx];
    const best = prev ? Math.max(prev.bestScore, score) : score;
    subj[chapterIdx] = { bestScore: best, lastScore: score, total: total, completedAt: Date.now() };
    all[subjectId] = subj;
    saveAllProgress(all);
  }
  function clearSubjectProgress(subjectId) {
    const all = loadAllProgress();
    delete all[subjectId];
    saveAllProgress(all);
  }
  function firstIncompleteChapter(subject) {
    const p = loadProgress(subject.id);
    for (let i = 0; i < subject.chapters.length; i++) {
      if (!p[i]) return i;
    }
    return -1;
  }

  // Migrate older single-subject progress key if present.
  (function migrateLegacyProgress() {
    const LEGACY = "karni_chapter_progress";
    const legacy = localStorage.getItem(LEGACY);
    if (legacy && !localStorage.getItem(PROGRESS_KEY)) {
      try {
        const parsed = JSON.parse(legacy);
        saveAllProgress({ "yachasei-milim": parsed });
      } catch (e) { /* ignore */ }
    }
    if (legacy) localStorage.removeItem(LEGACY);
  })();

  // ─── Audio engine (Web Audio API, no external files) ────────
  const audio = (function () {
    let ctx = null;
    let enabled = localStorage.getItem("karni_sound") !== "off";

    function getCtx() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone(freq, startOffset, duration, peak) {
      if (!enabled) return;
      const c = getCtx();
      if (!c) return;
      const t0 = c.currentTime + startOffset;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(c.destination);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    }

    return {
      correct: function () {
        // gentle two-note ascending chime: E5 → A5
        tone(659.25, 0, 0.18, 0.12);
        tone(880.0, 0.11, 0.22, 0.12);
      },
      wrong: function () {
        // soft mellow descending: A4 → E4
        tone(440.0, 0, 0.18, 0.09);
        tone(329.63, 0.12, 0.26, 0.09);
      },
      finish: function () {
        // pleasant arpeggio: C5 E5 G5 C6
        tone(523.25, 0.0, 0.18, 0.11);
        tone(659.25, 0.16, 0.18, 0.11);
        tone(783.99, 0.32, 0.18, 0.11);
        tone(1046.5, 0.48, 0.38, 0.13);
      },
      isEnabled: function () { return enabled; },
      setEnabled: function (v) {
        enabled = !!v;
        localStorage.setItem("karni_sound", enabled ? "on" : "off");
      },
      unlock: function () { getCtx(); },
    };
  })();

  function refreshMuteBtn() {
    const on = audio.isEnabled();
    els.muteBtn.textContent = on ? "🔊" : "🔇";
    els.muteBtn.classList.toggle("muted", !on);
  }

  let order = [];
  let idx = 0;
  let score = 0;
  let answered = false;
  let sessionSize = CHAPTER_SIZE;
  let currentChapter = 0;
  let currentSubject = null;
  let currentScreen = "subjects"; // "subjects" | "chapters" | "quiz" | "results"

  // Wrap arithmetic expressions in LTR isolates (U+2066 ... U+2069) so that
  // operators like ×, ÷, +, −, = render in their natural left-to-right order
  // inside an RTL Hebrew line. Match runs of digits and math punctuation that
  // contain at least one operator, bookended by digits.
  const MATH_RE = /\d[\d\s+\-−×÷*\/=.,()]*[+\-−×÷*\/=][\d\s+\-−×÷*\/=.,()]*\d/g;
  function formatMath(text) {
    if (!text) return text;
    return text.replace(MATH_RE, function (m) { return "⁦" + m + "⁩"; });
  }

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function hideAllScreens() {
    els.subjectsScreen.classList.add("hidden");
    els.homeScreen.classList.add("hidden");
    els.quizScreen.classList.add("hidden");
    els.resultsScreen.classList.add("hidden");
  }

  function showSubjects() {
    currentScreen = "subjects";
    currentSubject = null;
    renderSubjectList();
    hideAllScreens();
    els.subjectsScreen.classList.remove("hidden");
    els.topbar.classList.add("home-mode");
    els.topbarTitle.textContent = "תרגול מחוננים";
    els.backBtn.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderSubjectList() {
    els.subjectList.innerHTML = "";
    SUBJECTS.forEach(function (s) {
      const p = loadProgress(s.id);
      const completedCount = Object.keys(p).length;
      const btn = document.createElement("button");
      btn.className = "subject-btn";
      btn.type = "button";

      btn.innerHTML =
        '<span class="subject-icon"></span>' +
        '<span class="subject-info">' +
          '<span class="subject-title"></span>' +
          '<span class="subject-desc"></span>' +
          '<span class="subject-status"></span>' +
        '</span>' +
        '<span class="subject-action">←</span>';
      btn.querySelector(".subject-icon").textContent = s.icon;
      btn.querySelector(".subject-title").textContent = s.title;
      btn.querySelector(".subject-desc").textContent = s.description;
      btn.querySelector(".subject-status").textContent =
        completedCount + " / " + s.chapters.length + " פרקים הושלמו";

      btn.addEventListener("click", function () {
        audio.unlock();
        showChapters(s);
      });
      els.subjectList.appendChild(btn);
    });
  }

  function showChapters(subject) {
    currentSubject = subject;
    currentScreen = "chapters";
    renderChapterList();
    hideAllScreens();
    els.homeScreen.classList.remove("hidden");
    els.topbar.classList.add("home-mode");
    els.topbarTitle.textContent = subject.title;
    els.backBtn.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderChapterList() {
    const subject = currentSubject;
    const p = loadProgress(subject.id);
    const nextIdx = firstIncompleteChapter(subject);
    els.chaptersTitle.textContent = subject.title;
    els.chapterList.innerHTML = "";

    subject.chapters.forEach(function (ch) {
      const completed = !!p[ch.index];
      const isNext = ch.index === nextIdx;
      const btn = document.createElement("button");
      btn.className = "chapter-btn";
      btn.type = "button";
      if (completed) btn.classList.add("completed");
      if (isNext) btn.classList.add("next-up");

      const icon = completed ? "✓" : String(ch.index + 1);
      let meta;
      if (completed) {
        meta = "הושלם · ניקוד שיא " + p[ch.index].bestScore + "/" + p[ch.index].total;
      } else {
        meta = ch.questionIndices.length + " שאלות";
      }
      const actionText = completed ? "תרגול חוזר" : "התחל";

      btn.innerHTML =
        '<span class="chapter-icon"></span>' +
        '<span class="chapter-info">' +
          '<span class="chapter-title"></span>' +
          '<span class="chapter-meta"></span>' +
        '</span>' +
        '<span class="chapter-action"></span>';
      btn.querySelector(".chapter-icon").textContent = icon;
      btn.querySelector(".chapter-title").textContent = ch.title;
      btn.querySelector(".chapter-meta").textContent = meta;
      btn.querySelector(".chapter-action").textContent = actionText + " ←";

      btn.addEventListener("click", function () {
        audio.unlock();
        startChapter(ch.index);
      });
      els.chapterList.appendChild(btn);
    });

    const completedCount = Object.keys(p).length;
    els.overallProgress.textContent =
      "השלמת " + completedCount + " מתוך " + subject.chapters.length + " פרקים";
  }

  function startChapter(chapterIdx) {
    currentChapter = chapterIdx;
    currentScreen = "quiz";
    const ch = currentSubject.chapters[chapterIdx];
    order = shuffle(ch.questionIndices.slice());
    sessionSize = order.length;
    idx = 0;
    score = 0;
    answered = false;
    hideAllScreens();
    els.quizScreen.classList.remove("hidden");
    els.topbar.classList.remove("home-mode");
    els.topbarTitle.textContent = currentSubject.title;
    els.backBtn.classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    answered = false;
    els.feedback.classList.add("hidden");
    const q = currentSubject.questions[order[idx]];

    // Shuffle options but remember which one is correct.
    const optsWithMeta = q.options.map((text, i) => ({ text, isCorrect: i === q.correct }));
    const shuffledOpts = shuffle(optsWithMeta);

    els.pair.textContent = formatMath(q.pair);
    els.pair.classList.toggle("paragraph", currentSubject.type !== "relations");
    els.promptLabel.textContent = currentSubject.promptLabel;
    els.options.innerHTML = "";

    shuffledOpts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML =
        '<span class="letter">' + HEB_LETTERS[i] + '.</span>' +
        '<span class="opt-text"></span>';
      btn.querySelector(".opt-text").textContent = formatMath(opt.text);
      btn.addEventListener("click", function () {
        onAnswer(btn, opt.isCorrect, opt.text, q);
      });
      els.options.appendChild(btn);
    });

    updateStats();
  }

  function onAnswer(button, isCorrect, chosenText, question) {
    if (answered) return;
    answered = true;

    const buttons = els.options.querySelectorAll(".option");
    const correctText = formatMath(question.options[question.correct]);
    buttons.forEach(function (b) {
      b.disabled = true;
      const txt = b.querySelector(".opt-text").textContent;
      if (txt === correctText) {
        b.classList.add("correct");
      }
    });

    if (isCorrect) {
      button.classList.add("correct");
      score++;
      els.feedbackTitle.textContent = "תשובה נכונה! ✓";
      els.feedbackTitle.className = "feedback-title ok";
      audio.correct();
    } else {
      button.classList.add("wrong");
      els.feedbackTitle.textContent = "תשובה לא נכונה ✗";
      els.feedbackTitle.className = "feedback-title bad";
      audio.wrong();
    }

    const fbPairRow = els.fbPair.parentElement;
    if (currentSubject.type === "relations") {
      fbPairRow.classList.remove("hidden");
      els.fbPair.textContent = formatMath(question.pair);
    } else {
      fbPairRow.classList.add("hidden");
    }
    els.fbCorrect.textContent = formatMath(question.options[question.correct]);
    els.explanation.textContent = formatMath(question.explanation);
    els.feedback.classList.remove("hidden");
    els.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });

    updateStats();
  }

  function updateStats() {
    els.progress.textContent = "שאלה " + (idx + 1) + " מתוך " + sessionSize;
    els.score.textContent = "ניקוד: " + score;
    const pct = ((idx + (answered ? 1 : 0)) / sessionSize) * 100;
    els.progressFill.style.width = pct + "%";
  }

  function nextQuestion() {
    idx++;
    if (idx >= sessionSize) {
      showResults();
      return;
    }
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showResults() {
    markCompleted(currentSubject.id, currentChapter, score, sessionSize);
    currentScreen = "results";

    hideAllScreens();
    els.resultsScreen.classList.remove("hidden");
    els.topbar.classList.add("home-mode");
    els.backBtn.classList.remove("hidden");

    const pct = Math.round((score / sessionSize) * 100);
    const chapterTitle = currentSubject.chapters[currentChapter].title;
    els.resultsTitle.textContent = "סיימת את " + chapterTitle + "! 🎉";
    els.finalScore.textContent = score + " / " + sessionSize + "  (" + pct + "%)";
    els.finalMsg.textContent = encouragement(pct);

    const nextIdx = firstIncompleteChapter(currentSubject);
    if (nextIdx !== -1) {
      els.nextChapterBtn.textContent =
        "לפרק הבא ← (" + currentSubject.chapters[nextIdx].title + ")";
      els.nextChapterBtn.dataset.next = String(nextIdx);
      els.nextChapterBtn.classList.remove("hidden");
    } else {
      els.nextChapterBtn.classList.add("hidden");
      els.finalMsg.textContent = "כל הכבוד! סיימת את כל הפרקים. " + els.finalMsg.textContent;
    }

    audio.finish();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function encouragement(pct) {
    if (pct === 100) return "מושלם! איזה מבחן ענק עברת בהצלחה.";
    if (pct >= 90) return "מצוין! שליטה מרשימה בנושא.";
    if (pct >= 75) return "כל הכבוד! המשך לתרגל ותגיע למצוין.";
    if (pct >= 50) return "יפה מאוד. שווה לחזור על השאלות שטעית בהן.";
    return "אל תוותר – כל סבב הוא תרגול שמקדם.";
  }

  els.nextBtn.addEventListener("click", nextQuestion);
  els.playAgain.addEventListener("click", function () {
    if (currentSubject) showChapters(currentSubject);
    else showSubjects();
  });

  els.backBtn.addEventListener("click", function () {
    if (currentScreen === "chapters") {
      showSubjects();
    } else if (currentScreen === "quiz") {
      if (confirm("לצאת מהפרק? ההתקדמות בפרק הזה לא תישמר.")) {
        showChapters(currentSubject);
      }
    } else if (currentScreen === "results") {
      showChapters(currentSubject);
    }
  });

  els.nextChapterBtn.addEventListener("click", function () {
    const next = parseInt(els.nextChapterBtn.dataset.next, 10);
    if (!Number.isNaN(next)) startChapter(next);
  });

  els.resetBtn.addEventListener("click", function () {
    if (!currentSubject) return;
    if (confirm("לאפס את ההתקדמות בנושא \"" + currentSubject.title + "\"?")) {
      clearSubjectProgress(currentSubject.id);
      renderChapterList();
    }
  });

  els.muteBtn.addEventListener("click", function () {
    audio.setEnabled(!audio.isEnabled());
    refreshMuteBtn();
    if (audio.isEnabled()) {
      audio.unlock();
      audio.correct(); // tiny confirmation chime
    }
  });

  // Mobile browsers require a user gesture before audio can play.
  document.addEventListener("click", function unlockOnce() {
    audio.unlock();
    document.removeEventListener("click", unlockOnce);
  }, { once: true });

  refreshMuteBtn();
  showSubjects();
})();
