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
    quizScreen: document.getElementById("quiz-screen"),
    resultsScreen: document.getElementById("results-screen"),
    finalScore: document.getElementById("final-score"),
    finalMsg: document.getElementById("final-msg"),
    playAgain: document.getElementById("play-again"),
  };

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
    } else {
      button.classList.add("wrong");
      els.feedbackTitle.textContent = "תשובה לא נכונה ✗";
      els.feedbackTitle.className = "feedback-title bad";
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

  start();
})();
