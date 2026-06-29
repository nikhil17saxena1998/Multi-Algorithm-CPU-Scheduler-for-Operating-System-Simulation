/**
 * ApexScheduler - Simulation Logic & Visualizer Controller
 */

// Application State
let processesList = [];
let nextPID = 1;
let currentTrace = null;
let currentStepIdx = 0; // Current index in time units
let simInterval = null;
let isPlaying = false;
let isSingleAlgorithmRun = true; // True if running one algorithm, False if comparison dashboard active

// DOM Elements
const algoSelect = document.getElementById('algo-select');
const quantumGroup = document.getElementById('quantum-group');
const agingGroup = document.getElementById('aging-group');
const quantumInput = document.getElementById('quantum-input');
const agingInput = document.getElementById('aging-input');

const inputArrival = document.getElementById('input-arrival');
const inputBurst = document.getElementById('input-burst');
const inputPriority = document.getElementById('input-priority');
const inputPriorityGroup = document.getElementById('input-priority-group');
const addProcBtn = document.getElementById('add-proc-btn');
const procInputBody = document.getElementById('proc-input-body');

const speedRange = document.getElementById('speed-range');
const speedVal = document.getElementById('speed-val');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStep = document.getElementById('btn-step');
const btnStop = document.getElementById('btn-stop');
const btnCompareAll = document.getElementById('btn-compare-all');

const liveClock = document.getElementById('live-clock');
const liveActivePid = document.getElementById('live-active-pid');
const liveAgingCounter = document.getElementById('live-aging-counter');
const ganttViewport = document.getElementById('gantt-viewport');

const procOutputBody = document.getElementById('proc-output-body');
const metricAvgWt = document.getElementById('metric-avg-wt');
const metricAvgTat = document.getElementById('metric-avg-tat');
const metricThroughput = document.getElementById('metric-throughput');

const comparisonView = document.getElementById('comparison-view');
const comparisonBars = document.getElementById('comparison-chart-bars');

const presetStarveBtn = document.getElementById('preset-starve-btn');
const presetNormalBtn = document.getElementById('preset-normal-btn');
const resetAllBtn = document.getElementById('reset-all-btn');

// --- Initialization & Event Listeners ---
window.addEventListener('DOMContentLoaded', () => {
    loadPresetNormal();
    updateFormVisibility();

    algoSelect.addEventListener('change', updateFormVisibility);
    addProcBtn.addEventListener('click', handleAddProcess);

    speedRange.addEventListener('input', () => {
        const ms = parseInt(speedRange.value);
        speedVal.textContent = (ms / 1000).toFixed(1) + 's';
        if (isPlaying) {
            pauseSimulation();
            playSimulation();
        }
    });

    btnPlay.addEventListener('click', playSimulation);
    btnPause.addEventListener('click', pauseSimulation);
    btnStep.addEventListener('click', stepSimulation);
    btnStop.addEventListener('click', resetSimulation);
    btnCompareAll.addEventListener('click', runAndCompareAll);

    presetStarveBtn.addEventListener('click', loadPresetStarve);
    presetNormalBtn.addEventListener('click', loadPresetNormal);
    resetAllBtn.addEventListener('click', resetAll);

    // Setup Comparison Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderComparisonChart(e.target.dataset.compare);
        });
    });
});

// Show/Hide fields based on algorithm selection
function updateFormVisibility() {
    const algo = algoSelect.value;

    // Quantum Visibility (only RR)
    if (algo === 'rr') {
        quantumGroup.style.display = 'flex';
    } else {
        quantumGroup.style.display = 'none';
    }

    // Aging Visibility (only Priority)
    if (algo === 'priority-np' || algo === 'priority-p') {
        agingGroup.style.display = 'flex';
        inputPriorityGroup.style.display = 'flex';
    } else {
        agingGroup.style.display = 'none';
        // Keep priority input but maybe dim it, or just show always for consistency
        inputPriorityGroup.style.display = 'flex';
    }
}

// Add logs helper — no-op (console logger removed)
function addLog(message, type = 'system') { }
function clearLogs() { }

// Render input table
function renderInputTable() {
    procInputBody.innerHTML = '';
    processesList.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>P${p.pid}</td>
            <td>${p.arrival}</td>
            <td>${p.burst}</td>
            <td>${p.priority}</td>
            <td><button class="td-btn" onclick="deleteProcess(${p.pid})">×</button></td>
        `;
        procInputBody.appendChild(tr);
    });
}

function handleAddProcess() {
    const arr = parseInt(inputArrival.value);
    const bur = parseInt(inputBurst.value);
    const pri = parseInt(inputPriority.value);

    if (isNaN(arr) || isNaN(bur) || isNaN(pri) || arr < 0 || bur <= 0 || pri < 0) {
        alert("Please enter valid process attributes (Arrival >= 0, Burst > 0, Priority >= 0).");
        return;
    }

    processesList.push({ pid: nextPID++, arrival: arr, burst: bur, priority: pri });
    renderInputTable();

    // Scroll table to bottom
    const wrapper = procInputBody.closest('.table-scroll-wrapper');
    wrapper.scrollTop = wrapper.scrollHeight;
}

window.deleteProcess = function (pid) {
    processesList = processesList.filter(p => p.pid !== pid);
    renderInputTable();
};

function resetAll() {
    processesList = [];
    nextPID = 1;
    resetSimulation();
    renderInputTable();
    addLog("[System] All processes cleared.");
}

// --- PRESETS ---
function loadPresetNormal() {
    resetAll();
    processesList = [
        { pid: 1, arrival: 0, burst: 8, priority: 3 },
        { pid: 2, arrival: 1, burst: 4, priority: 2 },
        { pid: 3, arrival: 2, burst: 9, priority: 1 },
        { pid: 4, arrival: 3, burst: 5, priority: 4 },
        { pid: 5, arrival: 4, burst: 2, priority: 2 }
    ];
    nextPID = 6;
    renderInputTable();
    addLog("[System] Loaded standard workload preset.");
}

function loadPresetStarve() {
    resetAll();
    // P1 arrives at 0, has low priority (5) and long burst.
    // High-priority (1) processes arrive frequently, starving P1 unless Aging is enabled.
    processesList = [
        { pid: 1, arrival: 0, burst: 15, priority: 5 },
        { pid: 2, arrival: 2, burst: 3, priority: 1 },
        { pid: 3, arrival: 5, burst: 3, priority: 1 },
        { pid: 4, arrival: 8, burst: 3, priority: 1 },
        { pid: 5, arrival: 11, burst: 3, priority: 1 },
        { pid: 6, arrival: 14, burst: 3, priority: 1 }
    ];
    nextPID = 7;
    renderInputTable();
    algoSelect.value = 'priority-p';
    agingInput.value = 3;
    updateFormVisibility();
    addLog("[System] Loaded Starvation Demo workload preset.");
    addLog("[Tip] Try running 'Priority (Preemptive) with Aging' at aging interval = 3 vs disabled (e.g. 100) to see how Aging saves P1 from starving!");
}


// --- SCHEDULING ALGORITHMS IMPLEMENTATION ---

/**
 * Common Output Model:
 * trace: array of length totalTime, where trace[t] = activePID at that time unit (-1 = idle)
 * metrics: list of processed output structures
 * logs: array of log messages
 * agingEventsCount: total priority boosts
 */

// 1. FCFS
function solveFCFS(procs) {
    let list = procs.map(p => ({ ...p }));
    list.sort((a, b) => a.arrival === b.arrival ? a.pid - b.pid : a.arrival - b.arrival);

    let t = 0;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));

    logs.push({ time: 0, msg: "Scheduler initialized with FCFS", type: "system" });

    list.forEach(p => {
        if (t < p.arrival) {
            logs.push({ time: t, msg: `CPU idle. Waiting for P${p.pid}`, type: "system" });
            while (t < p.arrival) {
                trace.push(-1);
                t++;
            }
        }

        logs.push({ time: t, msg: `Process P${p.pid} selected for execution`, type: "run" });
        let row = table.find(r => r.pid === p.pid);
        row.rt = t - p.arrival;

        for (let b = 0; b < p.burst; b++) {
            trace.push(p.pid);
            t++;
        }

        row.completion = t;
        row.tat = row.completion - row.arrival;
        row.wt = row.tat - row.burst;
        logs.push({ time: t, msg: `Process P${p.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
    });

    return { name: "FCFS", trace, table, logs, agingEventsCount: 0 };
}

// 2. SJF Non-Preemptive
function solveSJFNonPreemptive(procs) {
    let remaining = procs.map(p => ({ ...p, finished: false }));
    let t = 0, completed = 0, n = procs.length;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));

    logs.push({ time: 0, msg: "Scheduler initialized with SJF (Non-Preemptive)", type: "system" });

    while (completed < n) {
        // Find ready processes
        let ready = remaining.filter(p => !p.finished && p.arrival <= t);

        if (ready.length === 0) {
            trace.push(-1);
            if (trace[trace.length - 2] !== -1) {
                logs.push({ time: t, msg: "CPU idle. No processes ready", type: "system" });
            }
            t++;
            continue;
        }

        // Pick smallest burst
        ready.sort((a, b) => a.burst === b.burst ? a.arrival - b.arrival : a.burst - b.burst);
        let active = ready[0];

        logs.push({ time: t, msg: `Process P${active.pid} selected (Burst: ${active.burst})`, type: "run" });
        let row = table.find(r => r.pid === active.pid);
        row.rt = t - active.arrival;

        for (let b = 0; b < active.burst; b++) {
            trace.push(active.pid);
            t++;
        }

        active.finished = true;
        completed++;

        row.completion = t;
        row.tat = row.completion - row.arrival;
        row.wt = row.tat - row.burst;
        logs.push({ time: t, msg: `Process P${active.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
    }

    return { name: "SJF (Non-Preemptive)", trace, table, logs, agingEventsCount: 0 };
}

// 3. SRTF (Preemptive SJF)
function solveSJFPreemptive(procs) {
    let state = procs.map(p => ({ ...p, rem: p.burst, finished: false }));
    let t = 0, completed = 0, n = procs.length;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));
    let lastPID = -2;

    logs.push({ time: 0, msg: "Scheduler initialized with SRTF (Preemptive SJF)", type: "system" });

    while (completed < n) {
        let ready = state.filter(p => !p.finished && p.arrival <= t);

        if (ready.length === 0) {
            trace.push(-1);
            if (lastPID !== -1) {
                logs.push({ time: t, msg: "CPU idle. No processes ready", type: "system" });
                lastPID = -1;
            }
            t++;
            continue;
        }

        ready.sort((a, b) => a.rem === b.rem ? a.arrival - b.arrival : a.rem - b.rem);
        let active = ready[0];

        if (active.pid !== lastPID) {
            if (lastPID > 0) {
                logs.push({ time: t, msg: `P${lastPID} preempted. P${active.pid} selected (Rem: ${active.rem})`, type: "preempt" });
            } else {
                logs.push({ time: t, msg: `P${active.pid} scheduled (Rem: ${active.rem})`, type: "run" });
            }
            lastPID = active.pid;
        }

        let row = table.find(r => r.pid === active.pid);
        if (row.rt === -1) row.rt = t - active.arrival;

        trace.push(active.pid);
        active.rem--;
        t++;

        if (active.rem === 0) {
            active.finished = true;
            completed++;
            row.completion = t;
            row.tat = row.completion - row.arrival;
            row.wt = row.tat - row.burst;
            logs.push({ time: t, msg: `Process P${active.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
            lastPID = -2; // Reset so next process scheduled shows clean log
        }
    }

    return { name: "SRTF (Preemptive)", trace, table, logs, agingEventsCount: 0 };
}

// 4. Priority Non-Preemptive with Aging
function solvePriorityNonPreemptive(procs, agingInterval) {
    let state = procs.map(p => ({ ...p, finished: false }));
    let t = 0, completed = 0, n = procs.length;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));
    let agingEventsCount = 0;

    logs.push({ time: 0, msg: `Scheduler initialized with Priority Non-Preemptive (Aging: ${agingInterval}t)`, type: "system" });

    while (completed < n) {
        let ready = state.filter(p => !p.finished && p.arrival <= t);

        if (ready.length === 0) {
            trace.push(-1);
            if (trace[trace.length - 2] !== -1) {
                logs.push({ time: t, msg: "CPU idle. No processes ready", type: "system" });
            }
            t++;
            continue;
        }

        // Apply aging computation to evaluate dynamic priorities at time t
        let evaluated = ready.map(p => {
            let waitTime = t - p.arrival;
            let ageBoost = Math.floor(waitTime / agingInterval);
            let dynamicPriority = Math.max(0, p.priority - ageBoost);
            return { ...p, dynamicPriority, ageBoost };
        });

        // Log aging events
        evaluated.forEach(p => {
            if (p.ageBoost > 0) {
                logs.push({ time: t, msg: `Priority boost: P${p.pid} priority aged to ${p.dynamicPriority} (was ${p.priority})`, type: "age" });
                agingEventsCount++;
            }
        });

        // Pick highest priority (lowest dynamicPriority value)
        evaluated.sort((a, b) => a.dynamicPriority === b.dynamicPriority ? a.arrival - b.arrival : a.dynamicPriority - b.dynamicPriority);
        let selected = evaluated[0];
        let active = state.find(p => p.pid === selected.pid);

        logs.push({ time: t, msg: `Process P${active.pid} selected (Priority: ${selected.dynamicPriority})`, type: "run" });
        let row = table.find(r => r.pid === active.pid);
        row.rt = t - active.arrival;

        for (let b = 0; b < active.burst; b++) {
            trace.push(active.pid);
            t++;
        }

        active.finished = true;
        completed++;
        row.completion = t;
        row.tat = row.completion - row.arrival;
        row.wt = row.tat - row.burst;
        logs.push({ time: t, msg: `Process P${active.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
    }

    return { name: "Priority NP (Aged)", trace, table, logs, agingEventsCount };
}

// 5. Priority Preemptive with Aging
function solvePriorityPreemptive(procs, agingInterval) {
    let state = procs.map(p => ({ ...p, rem: p.burst, dynPriority: p.priority, waitTime: 0, finished: false }));
    let t = 0, completed = 0, n = procs.length;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));
    let lastPID = -2;
    let agingEventsCount = 0;

    logs.push({ time: 0, msg: `Scheduler initialized with Priority Preemptive (Aging: ${agingInterval}t)`, type: "system" });

    while (completed < n) {
        let ready = state.filter(p => !p.finished && p.arrival <= t);

        if (ready.length === 0) {
            trace.push(-1);
            if (lastPID !== -1) {
                logs.push({ time: t, msg: "CPU idle. No processes ready", type: "system" });
                lastPID = -1;
            }
            t++;
            continue;
        }

        // Pick active process
        ready.sort((a, b) => a.dynPriority === b.dynPriority ? a.arrival - b.arrival : a.dynPriority - b.dynPriority);
        let active = ready[0];

        // Apply Aging to OTHER ready processes for this step
        ready.forEach(p => {
            if (p.pid !== active.pid) {
                p.waitTime++;
                if (p.waitTime >= agingInterval) {
                    let oldPri = p.dynPriority;
                    p.dynPriority = Math.max(0, p.dynPriority - 1);
                    p.waitTime = 0;
                    if (p.dynPriority < oldPri) {
                        logs.push({ time: t, msg: `Aging boost: P${p.pid} priority boosted to ${p.dynPriority}`, type: "age" });
                        agingEventsCount++;
                    }
                }
            }
        });

        if (active.pid !== lastPID) {
            if (lastPID > 0) {
                logs.push({ time: t, msg: `P${lastPID} preempted. P${active.pid} selected (Priority: ${active.dynPriority})`, type: "preempt" });
            } else {
                logs.push({ time: t, msg: `P${active.pid} scheduled (Priority: ${active.dynPriority})`, type: "run" });
            }
            lastPID = active.pid;
        }

        let row = table.find(r => r.pid === active.pid);
        if (row.rt === -1) row.rt = t - active.arrival;

        trace.push(active.pid);
        active.rem--;
        t++;

        if (active.rem === 0) {
            active.finished = true;
            completed++;
            row.completion = t;
            row.tat = row.completion - row.arrival;
            row.wt = row.tat - row.burst;
            logs.push({ time: t, msg: `Process P${active.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
            lastPID = -2;
        }
    }

    return { name: "Priority Preemptive (Aged)", trace, table, logs, agingEventsCount };
}

// 6. Round Robin
function solveRoundRobin(procs, quantum) {
    let state = procs.map(p => ({ ...p, rem: p.burst }));
    let sorted = procs.map(p => ({ ...p })).sort((a, b) => a.arrival - b.arrival);

    let t = 0, completed = 0, n = procs.length;
    let trace = [];
    let logs = [];
    let table = procs.map(p => ({ ...p, completion: 0, tat: 0, wt: 0, rt: -1 }));
    let readyQueue = [];
    let idx = 0;

    logs.push({ time: 0, msg: `Scheduler initialized with Round Robin (Quantum: ${quantum})`, type: "system" });

    // Load initial ready processes at t=0
    while (idx < n && sorted[idx].arrival <= t) {
        readyQueue.push(sorted[idx].pid);
        idx++;
    }

    while (completed < n) {
        if (readyQueue.length === 0) {
            if (idx < n) {
                // CPU Idle jump to next arrival
                let nextArr = sorted[idx].arrival;
                logs.push({ time: t, msg: `CPU idle. Waiting for next arrival at ${nextArr}`, type: "system" });
                while (t < nextArr) {
                    trace.push(-1);
                    t++;
                }
                while (idx < n && sorted[idx].arrival <= t) {
                    readyQueue.push(sorted[idx].pid);
                    idx++;
                }
                continue;
            } else break;
        }

        let activePID = readyQueue.shift();
        let active = state.find(p => p.pid === activePID);
        let row = table.find(r => r.pid === activePID);

        if (row.rt === -1) row.rt = t - active.arrival;

        let run = Math.min(quantum, active.rem);
        logs.push({ time: t, msg: `P${active.pid} scheduled for quantum ${run}t (Remaining: ${active.rem})`, type: "run" });

        for (let r = 0; r < run; r++) {
            trace.push(active.pid);
            t++;
            // Check arrivals during execution
            while (idx < n && sorted[idx].arrival <= t) {
                readyQueue.push(sorted[idx].pid);
                idx++;
            }
        }

        active.rem -= run;

        if (active.rem > 0) {
            readyQueue.push(activePID); // Enqueue again
            logs.push({ time: t, msg: `P${active.pid} quantum expired. Re-entered ready queue.`, type: "system" });
        } else {
            completed++;
            row.completion = t;
            row.tat = row.completion - row.arrival;
            row.wt = row.tat - row.burst;
            logs.push({ time: t, msg: `Process P${active.pid} finished. WT: ${row.wt}, TAT: ${row.tat}`, type: "done" });
        }
    }

    return { name: `Round Robin (q=${quantum})`, trace, table, logs, agingEventsCount: 0 };
}


// --- SIMULATION EXECUTION HANDLERS ---

function runSimulation() {
    if (processesList.length === 0) {
        alert("Please add some processes or load a preset first.");
        return false;
    }

    const algo = algoSelect.value;
    const quantum = parseInt(quantumInput.value) || 3;
    const aging = parseInt(agingInput.value) || 5;

    // Run solver
    if (algo === 'fcfs') {
        currentTrace = solveFCFS(processesList);
    } else if (algo === 'sjf-np') {
        currentTrace = solveSJFNonPreemptive(processesList);
    } else if (algo === 'sjf-p') {
        currentTrace = solveSJFPreemptive(processesList);
    } else if (algo === 'priority-np') {
        currentTrace = solvePriorityNonPreemptive(processesList, aging);
    } else if (algo === 'priority-p') {
        currentTrace = solvePriorityPreemptive(processesList, aging);
    } else if (algo === 'rr') {
        currentTrace = solveRoundRobin(processesList, quantum);
    }

    currentStepIdx = 0;
    isPlaying = false;
    isSingleAlgorithmRun = true;
    comparisonView.style.display = 'none'; // Hide comparison charts

    clearLogs();
    renderOutputMetricsFull(false); // Render empty metrics initially
    renderGanttChartStep(0);

    addLog(`[System] Initialized simulation for ${currentTrace.name}. Ready to run.`);
    return true;
}

function playSimulation() {
    if (!currentTrace || currentStepIdx >= currentTrace.trace.length) {
        if (!runSimulation()) return;
    }

    btnPlay.disabled = true;
    btnPause.disabled = false;
    btnStep.disabled = true;
    algoSelect.disabled = true;

    isPlaying = true;
    const speed = parseInt(speedRange.value);

    simInterval = setInterval(() => {
        if (currentStepIdx < currentTrace.trace.length) {
            stepSimulation();
        } else {
            pauseSimulation();
            addLog("[System] Simulation completed successfully.", "done");
            renderOutputMetricsFull(true); // populate table and metrics fully
        }
    }, speed);
}

function pauseSimulation() {
    clearInterval(simInterval);
    isPlaying = false;
    btnPlay.disabled = false;
    btnPause.disabled = true;
    btnStep.disabled = false;
}

function stepSimulation() {
    if (!currentTrace) {
        if (!runSimulation()) return;
    }

    if (currentStepIdx >= currentTrace.trace.length) {
        addLog("[System] Already at end of simulation.");
        return;
    }

    // Step Gantt Chart
    currentStepIdx++;
    renderGanttChartStep(currentStepIdx);

    // Print logs that correspond to the current time step
    const currentLogs = currentTrace.logs.filter(l => l.time === currentStepIdx - 1);
    currentLogs.forEach(l => {
        addLog(`[t = ${l.time}] ${l.msg}`, l.type);
    });

    // Update live indicators
    liveClock.textContent = currentStepIdx;

    const activePID = currentTrace.trace[currentStepIdx - 1];
    liveActivePid.textContent = activePID === -1 ? "IDLE" : `P${activePID}`;
    if (activePID === -1) {
        liveActivePid.className = "stat-val text-warning";
    } else {
        liveActivePid.className = "stat-val text-accent";
    }

    // Dynamic aging count update
    const pastAges = currentTrace.logs.filter(l => l.time < currentStepIdx && l.type === 'age');
    liveAgingCounter.textContent = pastAges.length;

    // If step hit the end
    if (currentStepIdx === currentTrace.trace.length) {
        pauseSimulation();
        addLog("[System] Simulation completed successfully.", "done");
        renderOutputMetricsFull(true);
    }
}

function resetSimulation() {
    pauseSimulation();
    currentTrace = null;
    currentStepIdx = 0;

    liveClock.textContent = "0";
    liveActivePid.textContent = "-";
    liveActivePid.className = "stat-val text-accent";
    liveAgingCounter.textContent = "0";

    algoSelect.disabled = false;
    btnPlay.disabled = false;
    btnPause.disabled = true;
    btnStep.disabled = false;

    clearLogs();
    ganttViewport.innerHTML = '<div class="gantt-empty-state">Click Run or Step to visualize process scheduling</div>';

    // Clear outcome table
    procOutputBody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center muted">No simulation metrics computed yet</td>
        </tr>
    `;
    metricAvgWt.textContent = "0.00";
    metricAvgTat.textContent = "0.00";
    metricThroughput.textContent = "0.00";

    addLog("[System] Workspace reset. Ready to configure.");
}

// --- VIEW RENDERING ENGINE ---

function renderGanttChartStep(stepLimit) {
    if (!currentTrace || currentTrace.trace.length === 0) return;

    ganttViewport.innerHTML = '';

    let subTrace = currentTrace.trace.slice(0, stepLimit);
    if (subTrace.length === 0) {
        ganttViewport.innerHTML = '<div class="gantt-empty-state">Ready to schedule...</div>';
        return;
    }

    // Collapse trace into segments
    let segments = [];
    let currentPID = subTrace[0];
    let start = 0;

    for (let i = 1; i < subTrace.length; i++) {
        if (subTrace[i] !== currentPID) {
            segments.push({ start, end: i, pid: currentPID });
            currentPID = subTrace[i];
            start = i;
        }
    }
    segments.push({ start, end: subTrace.length, pid: currentPID });

    // Render segments as HTML blocks
    segments.forEach((seg, index) => {
        const block = document.createElement('div');
        const width = (seg.end - seg.start) * 22; // Scaled width
        block.className = 'gantt-block';
        if (index === segments.length - 1 && stepLimit < currentTrace.trace.length) {
            block.classList.add('last-block');
        } else if (stepLimit === currentTrace.trace.length && index === segments.length - 1) {
            block.classList.add('last-block');
        }

        // Dynamic colors
        if (seg.pid === -1) {
            block.style.background = 'var(--proc-idle)';
            block.style.border = '1px dashed var(--text-muted)';
            block.innerHTML = `
                <span class="gantt-pid muted">IDLE</span>
                <span class="gantt-time-start">${seg.start}</span>
            `;
        } else {
            block.style.background = `var(--proc-${(seg.pid - 1) % 8 + 1})`;
            block.innerHTML = `
                <span class="gantt-pid">P${seg.pid}</span>
                <span class="gantt-time-start">${seg.start}</span>
            `;
        }

        block.style.width = `${Math.max(45, width)}px`;
        block.setAttribute('data-time-end', seg.end);
        ganttViewport.appendChild(block);
    });

    // Auto-scroll Gantt container to right
    ganttViewport.scrollLeft = ganttViewport.scrollWidth;
}

function renderOutputMetricsFull(completed) {
    if (!currentTrace) return;

    if (!completed) {
        procOutputBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center muted">Simulation running... metrics will display upon completion.</td>
            </tr>
        `;
        return;
    }

    // Populate Table
    procOutputBody.innerHTML = '';
    currentTrace.table.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>P${row.pid}</strong></td>
            <td>${row.arrival}</td>
            <td>${row.burst}</td>
            <td>${row.priority}</td>
            <td>${row.completion}</td>
            <td>${row.tat}</td>
            <td class="text-accent"><strong>${row.wt}</strong></td>
            <td>${row.rt}</td>
        `;
        procOutputBody.appendChild(tr);
    });

    // Compute Summary stats
    const totalTime = currentTrace.trace.length;
    let sumWT = 0;
    let sumTAT = 0;
    currentTrace.table.forEach(r => {
        sumWT += r.wt;
        sumTAT += r.tat;
    });

    const avgWT = (sumWT / currentTrace.table.length).toFixed(2);
    const avgTAT = (sumTAT / currentTrace.table.length).toFixed(2);
    const throughput = (currentTrace.table.length / totalTime).toFixed(4);

    // Update UI Cards
    metricAvgWt.textContent = avgWT;
    metricAvgTat.textContent = avgTAT;
    metricThroughput.textContent = throughput;

}


// --- MULTI-ALGORITHM COMPARISON ENGINE ---

let comparisonResults = {};

function runAndCompareAll() {
    if (processesList.length === 0) {
        alert("Please add some processes or load a preset first.");
        return;
    }

    resetSimulation();

    const quantum = parseInt(quantumInput.value) || 3;
    const aging = parseInt(agingInput.value) || 5;

    // Run all solvers and save results
    comparisonResults = {
        fcfs: solveFCFS(processesList),
        sjfNp: solveSJFNonPreemptive(processesList),
        srtf: solveSJFPreemptive(processesList),
        priorityNp: solvePriorityNonPreemptive(processesList, aging),
        priorityP: solvePriorityPreemptive(processesList, aging),
        rr: solveRoundRobin(processesList, quantum)
    };

    // Calculate details for each
    Object.keys(comparisonResults).forEach(key => {
        const res = comparisonResults[key];
        let sumWT = 0, sumTAT = 0;
        res.table.forEach(r => { sumWT += r.wt; sumTAT += r.tat; });
        res.avgWT = sumWT / res.table.length;
        res.avgTAT = sumTAT / res.table.length;
        const totalT = res.trace.length;
        res.throughput = res.table.length / totalT;
    });

    isSingleAlgorithmRun = false;
    comparisonView.style.display = 'flex';

    // Default show Average WT comparison
    document.querySelector('.tab-btn[data-compare="wt"]').click();

    addLog("[System] All algorithms simulated for comparison dashboard. Check analytics tab below.", "done");

    // Scroll comparison view into sight
    comparisonView.scrollIntoView({ behavior: 'smooth' });
}

function renderComparisonChart(metricKey) {
    if (!comparisonResults.fcfs) return;

    comparisonBars.innerHTML = '';

    // Extract algorithm scores
    let data = [
        { key: 'FCFS', val: 0, raw: '' },
        { key: 'SJF Non-Preemp', val: 0, raw: '' },
        { key: 'SRTF (Preemp SJF)', val: 0, raw: '' },
        { key: 'Priority NP + Age', val: 0, raw: '' },
        { key: 'Priority Preemp + Age', val: 0, raw: '' },
        { key: 'Round Robin', val: 0, raw: '' }
    ];

    if (metricKey === 'wt') {
        data[0].val = comparisonResults.fcfs.avgWT;
        data[1].val = comparisonResults.sjfNp.avgWT;
        data[2].val = comparisonResults.srtf.avgWT;
        data[3].val = comparisonResults.priorityNp.avgWT;
        data[4].val = comparisonResults.priorityP.avgWT;
        data[5].val = comparisonResults.rr.avgWT;
        data.forEach(d => d.raw = d.val.toFixed(2) + 't');
    } else if (metricKey === 'tat') {
        data[0].val = comparisonResults.fcfs.avgTAT;
        data[1].val = comparisonResults.sjfNp.avgTAT;
        data[2].val = comparisonResults.srtf.avgTAT;
        data[3].val = comparisonResults.priorityNp.avgTAT;
        data[4].val = comparisonResults.priorityP.avgTAT;
        data[5].val = comparisonResults.rr.avgTAT;
        data.forEach(d => d.raw = d.val.toFixed(2) + 't');
    } else if (metricKey === 'throughput') {
        data[0].val = comparisonResults.fcfs.throughput;
        data[1].val = comparisonResults.sjfNp.throughput;
        data[2].val = comparisonResults.srtf.throughput;
        data[3].val = comparisonResults.priorityNp.throughput;
        data[4].val = comparisonResults.priorityP.throughput;
        data[5].val = comparisonResults.rr.throughput;
        data.forEach(d => d.raw = d.val.toFixed(4) + ' proc/t');
    }

    // Determine the "Winner" (best score)
    // For WT and TAT, lower is better. For Util and Throughput, higher is better.
    let bestVal = (metricKey === 'wt' || metricKey === 'tat') ? Math.min(...data.map(d => d.val)) : Math.max(...data.map(d => d.val));

    // Maximum value to scale the bars
    const maxVal = Math.max(...data.map(d => d.val), 0.0001);

    data.forEach(d => {
        const isWinner = d.val === bestVal;
        const percentage = (d.val / maxVal) * 100;

        const row = document.createElement('div');
        row.className = 'chart-bar-container';
        row.innerHTML = `
            <div class="chart-bar-lbl">
                <span>${d.key}</span>
                <span><strong>${d.raw}</strong>${isWinner ? '<span class="winner-badge">🏆 (Best)</span>' : ''}</span>
            </div>
            <div class="chart-bar-wrapper">
                <div class="chart-bar-fill ${isWinner ? 'winner' : ''}" style="width: 0%"></div>
            </div>
        `;
        comparisonBars.appendChild(row);

        // Trigger fill animation
        setTimeout(() => {
            row.querySelector('.chart-bar-fill').style.width = `${percentage}%`;
        }, 50);
    });
}
