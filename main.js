// probably remove legend, use descrete steps (if wrong key, smoke the pan and put an X on pan), add timer, add background, change alien (can be square), end with time, calculate accuracy


// main.js - Queue-carousel (3 visible shapes: S -> M -> L center)
// Spawns from the right; M and S are visible and slide into place on each advance.
// Snappy motion selected (MOVE_SPEED high). Shape sizes: L=85%, M=65%, S=45% of target box.

document.addEventListener("DOMContentLoaded", () => {

    // DOM refs ----------------------------------------------------
    const screens = {
      landing: document.getElementById("landing-screen"),
      consent: document.getElementById("consent-screen"),
      demographics: document.getElementById("demographics-screen"),
      instructions: document.getElementById("instructions-screen"),
      game: document.getElementById("game-screen"),
      finish: document.getElementById("finish-screen")
    };
  
    const startBtn = document.getElementById("start-btn");
    const agreeBtn = document.getElementById("agree-btn");
    const demographicsForm = document.getElementById("demographics-form");
    const practiceBtn = document.getElementById("practice-btn");
    const mainBtn = document.getElementById("main-btn");
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const overlayZone = document.getElementById("target-zone");
  
    const scoreValue = document.getElementById("score-value");
    const timeLeftNode = document.getElementById("time-left");
    const endCorrect = document.getElementById("end-correct");
    const endAccuracy = document.getElementById("end-accuracy");
    const downloadBtn = document.getElementById("download-btn");
    const restartBtn = document.getElementById("restart-btn");
  
  
    // Constants ----------------------------------------------------
    const SHAPE_KEYS = { Circle: "d", Triangle: "f", Square: "j", Star: "k" };
    const SHAPE_COLORS = { Circle: "#3498db", Triangle: "#e67e22", Square: "#2ecc71", Star: "#f1c40f" };
    const SHAPES = Object.keys(SHAPE_KEYS);
    const PARTICIPANT_ID = Math.floor(Math.random() * 1000000);
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
  
    const transitionMatrix = {
      Circle:   { Circle: 0.1, Triangle: 0.5, Square: 0.3, Star: 0.1 },
      Triangle: { Circle: 0.2, Triangle: 0.2, Square: 0.4, Star: 0.2 },
      Square:   { Circle: 0.25, Triangle: 0.25, Square: 0.25, Star: 0.25 },
      Star:     { Circle: 0.4, Triangle: 0.2, Square: 0.3, Star: 0.1 }
    };
  
    // Game state ---------------------------------------------------
    let gameActive = false;
    let practice = false;
    let runStartTime = 0;
    let runDuration = 0;
    let trialStartTime = 0;
    let currentShape = SHAPES[0];
    let trialNumber = 0;
    let dataLog = [];
  
    let correctCount = 0;
    let incorrectCount = 0;
  
    // Size ratios
    const SHAPE_FILL_RATIO_L = 0.85;
    const SHAPE_FILL_RATIO_M = 0.65;
    const SHAPE_FILL_RATIO_S = 0.45;
  
    // Motion
    const MOVE_SPEED = 25;
    const MOVE_SIZE_SPEED = 0.18;
  
    // Durations
    const DURATION_MAIN = 60000;
    const DURATION_PRACTICE = 15000;
  
    // Queue
    let shapeQueue = [];
  
    // Smoke puff particles
    const smokePuffs = [];
  
    // Canvas sizing ------------------------------------------------
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      if (gameActive) drawFrame();
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
  
    // Screen switching ---------------------------------------------
    function showScreen(screen) {
      Object.values(screens).forEach(s => s.classList.remove("active"));
      screen.classList.add("active");
    }
  
    // Target zone helper -------------------------------------------
    function getTargetZone() {
      const width = overlayZone.offsetWidth || 160;
      const height = overlayZone.offsetHeight || 160;
      return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        width,
        height
      };
    }
  
    // Transition sampling ------------------------------------------
    function sampleNextShape(current) {
      const probs = transitionMatrix[current];
      const r = Math.random();
      let cum = 0;
      for (let k in probs) {
        cum += probs[k];
        if (r < cum) return k;
      }
      return SHAPES[0];
    }
  
    // --------------------------------------------------------------
    // DRAWING
    // --------------------------------------------------------------
    function drawFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      const z = getTargetZone();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x - z.width/2, z.y - z.height/2, z.width, z.height);
  
      shapeQueue.forEach(s => drawShape(s));
    }
  
    function updateSmoke() {
      for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const p = smokePuffs[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;
  
        ctx.beginPath();
        ctx.fillStyle = `rgba(120,120,120,${p.alpha})`;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
  
        if (p.alpha <= 0) smokePuffs.splice(i, 1);
      }
    }
  
    function spawnSmoke(x, y) {
      for (let i = 0; i < 20; i++) {
        smokePuffs.push({
            x, y,
            radius: 10 + Math.random() * 14,   // bigger
            vx: (Math.random() - 0.5) * 5,     // faster
            vy: (Math.random() - 0.5) * 5,
            alpha: 1
        });
      }
    }
  
    // --------------------------------------------------------------
    // RESET
    // --------------------------------------------------------------
    function resetGame(isPractice) {
      practice = !!isPractice;
      gameActive = true;
      runStartTime = performance.now();
      runDuration = practice ? DURATION_PRACTICE : DURATION_MAIN;
      trialStartTime = 0;
      trialNumber = 0;
      dataLog = [];
      correctCount = 0;
      incorrectCount = 0;
  
      currentShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      shapeQueue = [];
  
      overlayZone.classList.remove("flash-error");
      updateScoreboard();
    }
  
    // --------------------------------------------------------------
    // QUEUE SETUP
    // --------------------------------------------------------------
    function makeQueuedShape(index) {
      const name = sampleNextShape(currentShape);
      currentShape = name;
  
      const z = getTargetZone();
      const baseSize = Math.min(z.width, z.height);
  
      let targetX, targetSize, state;
  
      if (index === 0) {
        state = "L";
        targetX = z.x;
        targetSize = baseSize * SHAPE_FILL_RATIO_L;
      } else if (index === 1) {
        state = "M";
        targetX = z.x + z.width * 2.2;
        targetSize = baseSize * SHAPE_FILL_RATIO_M;
      } else {
        state = "S";
        targetX = z.x + z.width * 4.4;
        targetSize = baseSize * SHAPE_FILL_RATIO_S;
      }
  
      return {
        name,
        x: canvas.width + baseSize + (index * 10),
        y: z.y,
        size: targetSize,
        targetX,
        targetSize,
        state,
        entering: true,
        activeStarted: false
      };
    }
  
    function setupInitialQueue() {
      shapeQueue = [];
  
      for (let i = 0; i < 3; i++) {
        const s = makeQueuedShape(i);
        s.x = s.targetX;
        s.size = s.targetSize;
        s.entering = false;
        shapeQueue.push(s);
      }
  
      drawFrame();
    }
  
    // --------------------------------------------------------------
    // ADVANCE QUEUE
    // --------------------------------------------------------------
    function advanceQueue() {
      trialNumber++;
  
      if ((performance.now() - runStartTime) >= runDuration) {
        endRun();
        return;
      }
  
      shapeQueue.shift();
  
      shapeQueue.forEach((s, i) => {
        const z = getTargetZone();
        const baseSize = Math.min(z.width, z.height);
  
        s.state = i === 0 ? "L" : (i === 1 ? "M" : "S");
        s.targetX = z.x + (i * z.width * 2.2);
        s.targetSize = baseSize *
          (i === 0 ? SHAPE_FILL_RATIO_L :
           i === 1 ? SHAPE_FILL_RATIO_M :
                     SHAPE_FILL_RATIO_S);
  
        s.x = s.targetX;
        s.size = s.targetSize;
      });
  
      const newShape = makeQueuedShape(3);
      newShape.x = newShape.targetX;
      newShape.size = newShape.targetSize;
      shapeQueue.push(newShape);
  
      trialStartTime = performance.now();
      drawFrame();
    }
  
    // --------------------------------------------------------------
    // ANIMATION LOOP
    // --------------------------------------------------------------
    function gameLoop() {
      if (!gameActive) return;
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      const z = getTargetZone();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeRect(z.x - z.width/2, z.y - z.height/2, z.width, z.height);
  
      shapeQueue.forEach(s => {
        if (s.entering) {
          const dx = s.targetX - s.x;
  
          if (Math.abs(dx) > 0.5) {
            s.x += Math.sign(dx) * Math.min(MOVE_SPEED, Math.abs(dx));
          }
  
          s.size += (s.targetSize - s.size) * MOVE_SIZE_SPEED;
  
          if (Math.abs(dx) < 2 && Math.abs(s.size - s.targetSize) < 1) {
            s.x = s.targetX;
            s.size = s.targetSize;
            s.entering = false;
  
            if (s.state === "L" && !s.activeStarted) {
              trialStartTime = performance.now();
              s.activeStarted = true;
            }
          }
        } else if (s.state === "L" && !s.activeStarted) {
          trialStartTime = performance.now();
          s.activeStarted = true;
        }
  
        drawShape(s);
        updateSmoke();        
      });
  
      requestAnimationFrame(gameLoop);
    }
  
    function drawShape(o) {
      ctx.fillStyle = SHAPE_COLORS[o.name];
  
      if (o.name === "Circle") {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size / 2, 0, Math.PI * 2);
        ctx.fill();
  
      } else if (o.name === "Square") {
        ctx.fillRect(o.x - o.size/2, o.y - o.size/2, o.size, o.size);
  
      } else if (o.name === "Triangle") {
        ctx.beginPath();
        ctx.moveTo(o.x, o.y - o.size/2);
        ctx.lineTo(o.x - o.size/2, o.y + o.size/2);
        ctx.lineTo(o.x + o.size/2, o.y + o.size/2);
        ctx.closePath();
        ctx.fill();
  
      } else if (o.name === "Star") {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 - 90) * Math.PI/180;
          const innerAngle = angle + 36 * Math.PI/180;
          const outer = o.size/2;
          const inner = o.size/5;
          ctx.lineTo(o.x + Math.cos(angle)*outer, o.y + Math.sin(angle)*outer);
          ctx.lineTo(o.x + Math.cos(innerAngle)*inner, o.y + Math.sin(innerAngle)*inner);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  
    // --------------------------------------------------------------
    // KEYBOARD HANDLER
    // --------------------------------------------------------------
    document.addEventListener("keydown", (e) => {
      if (!gameActive) return;
  
      const active = shapeQueue[0];
      const key = e.key.toLowerCase();
      const expected = SHAPE_KEYS[active.name];
  
      const now = performance.now();
      const rt = now - trialStartTime;
      const correct = (key === expected);
  
      const z = getTargetZone();
  
      if (!correct) {
        incorrectCount++;
        overlayZone.classList.add("flash-error");
        spawnSmoke(z.x, z.y);
      
        setTimeout(() => {
          overlayZone.classList.remove("flash-error");
        }, 200);
      } else {
        correctCount++;
      }
      
  
      dataLog.push({
        participant_id: PARTICIPANT_ID,
        trial: trialNumber,
        expected_shape: active.name,
        expected_key: expected,
        pressed_key: key,
        correct: correct ? 1 : 0,
        rt_ms: Math.round(rt),
        device_type: deviceType,
        timestamp_ms: now
      });
  
      updateScoreboard();
      advanceQueue();
    });
  
    // --------------------------------------------------------------
    // START + TIMER + END
    // --------------------------------------------------------------
    function startGame(isPractice) {
      resetGame(isPractice);
      showScreen(screens.game);
  
      runStartTime = performance.now();
      runDuration = practice ? DURATION_PRACTICE : DURATION_MAIN;
  
      setupInitialQueue();
      gameLoop();
      tickTimer();
    }
  
    let timerTickId = null;
    function tickTimer() {
      if (timerTickId) cancelAnimationFrame(timerTickId);
  
      function tick() {
        if (!gameActive) return;
  
        const elapsed = performance.now() - runStartTime;
        const remain = Math.max(0, Math.round((runDuration - elapsed)/1000));
        timeLeftNode.textContent = `${remain}s`;
  
        if (elapsed >= runDuration) {
          endRun();
          return;
        }
  
        timerTickId = requestAnimationFrame(tick);
      }
      timerTickId = requestAnimationFrame(tick);
    }
  
    function endRun() {
      gameActive = false;
  
      const totalTrials = correctCount + incorrectCount;
      const accuracy = totalTrials === 0 ? 0 : Math.round((correctCount / totalTrials) * 100);
  
      endCorrect.textContent = `Correct: ${correctCount}`;
      endAccuracy.textContent = `Accuracy: ${accuracy}%`;
  
      showScreen(screens.finish);
  
      dataLog.push({
        participant_id: PARTICIPANT_ID,
        event: "run_end",
        correct: correctCount,
        incorrect: incorrectCount,
        total_trials: totalTrials,
        accuracy_pct: accuracy,
        timestamp_ms: performance.now()
      });
    }
  
    // --------------------------------------------------------------
    // SCORE + EXPORT
    // --------------------------------------------------------------
    function updateScoreboard() {
      scoreValue.textContent = String(correctCount);
    }
  
    function downloadCSV() {
      if (!dataLog.length) return alert("No data to download");
  
      const keys = Array.from(new Set(dataLog.flatMap(obj => Object.keys(obj))));
      const rows = dataLog.map(obj =>
        keys.map(k => `"${String(obj[k] ?? "").replace(/"/g,'""')}"`).join(",")
      );
  
      const csv = [keys.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
  
      const a = document.createElement("a");
      a.href = url;
      a.download = `participant_${PARTICIPANT_ID}.csv`;
      a.click();
  
      URL.revokeObjectURL(url);
    }
  
    // --------------------------------------------------------------
    // EVENT BINDINGS
    // --------------------------------------------------------------
    startBtn.addEventListener("click", () => showScreen(screens.consent));
    agreeBtn.addEventListener("click", () => showScreen(screens.demographics));
  
    demographicsForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(demographicsForm);
      for (const [k, v] of fd.entries()) {
        dataLog.push({ participant_id: PARTICIPANT_ID, field: k, value: v });
      }
      showScreen(screens.instructions);
    });
  
    practiceBtn.addEventListener("click", () => startGame(true));
    mainBtn.addEventListener("click", () => startGame(false));
    restartBtn.addEventListener("click", () => showScreen(screens.instructions));
    downloadBtn.addEventListener("click", downloadCSV);
  
    // --------------------------------------------------------------
    // Incorrect flash style
    // --------------------------------------------------------------
    const styleNode = document.createElement("style");
    styleNode.textContent = `
      #target-zone.flash-error {
        box-shadow: 0 0 0 12px rgba(255,0,0,0.25);
        border-color: #ff3b30;
        }
    `;
    document.head.appendChild(styleNode);
  
    // expose for debugging
    window._game = { startGame, endRun, shapeQueue, resetGame };
  });
  
  
  