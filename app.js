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
    restartBtn: document.getElementById("restart-btn"),
    muteBtn: document.getElementById("mute-btn"),
    quizScreen: document.getElementById("quiz-screen"),
    resultsScreen: document.getElementById("results-screen"),
    finalScore: document.getElementById("final-score"),
    finalMsg: document.getElementById("final-msg"),
    playAgain: document.getElementById("play-again"),
  };

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

  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function start() {
    order = shuffle(QUESTIONS.map((_, i) => i));
    idx = 0;
    score = 0;
    answered = false;
    els.resultsScreen.classList.add("hidden");
    els.quizScreen.classList.remove("hidden");
    renderQuestion();
  }

  function renderQuestion() {
    answered = false;
    els.feedback.classList.add("hidden");
    const q = QUESTIONS[order[idx]];

    // Shuffle options but remember which one is correct.
    const optsWithMeta = q.options.map((text, i) => ({ text, isCorrect: i === q.correct }));
    const shuffledOpts = shuffle(optsWithMeta);

    els.pair.textContent = q.pair;
    els.options.innerHTML = "";

    shuffledOpts.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.innerHTML =
        '<span class="letter">' + HEB_LETTERS[i] + '.</span>' +
        '<span class="opt-text"></span>';
      btn.querySelector(".opt-text").textContent = opt.text;
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
    buttons.forEach(function (b) {
      b.disabled = true;
      const txt = b.querySelector(".opt-text").textContent;
      if (txt === question.options[question.correct]) {
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

    els.fbPair.textContent = question.pair;
    els.fbCorrect.textContent = question.options[question.correct];
    els.explanation.textContent = question.explanation;
    els.feedback.classList.remove("hidden");
    els.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });

    updateStats();
  }

  function updateStats() {
    els.progress.textContent = "שאלה " + (idx + 1) + " מתוך " + QUESTIONS.length;
    els.score.textContent = "ניקוד: " + score;
    const pct = ((idx + (answered ? 1 : 0)) / QUESTIONS.length) * 100;
    els.progressFill.style.width = pct + "%";
  }

  function nextQuestion() {
    idx++;
    if (idx >= QUESTIONS.length) {
      showResults();
      return;
    }
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showResults() {
    els.quizScreen.classList.add("hidden");
    els.resultsScreen.classList.remove("hidden");
    const pct = Math.round((score / QUESTIONS.length) * 100);
    els.finalScore.textContent = score + " / " + QUESTIONS.length + "  (" + pct + "%)";
    els.finalMsg.textContent = encouragement(pct);
    audio.finish();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function encouragement(pct) {
    if (pct === 100) return "מושלם! איזה מבחן ענק עברת בהצלחה.";
    if (pct >= 90) return "מצוין! שליטה מרשימה ביחסי מילים.";
    if (pct >= 75) return "כל הכבוד! המשך לתרגל ותגיע למצוין.";
    if (pct >= 50) return "יפה מאוד. שווה לחזור על השאלות שטעית בהן.";
    return "אל תוותר – כל סבב הוא תרגול שמקדם.";
  }

  els.nextBtn.addEventListener("click", nextQuestion);
  els.restartBtn.addEventListener("click", start);
  els.playAgain.addEventListener("click", start);

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
  start();
})();
