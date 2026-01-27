/* ---------- CORE DATA ENGINE ---------- */
const getData = () => JSON.parse(localStorage.getItem("intimations")) || [];
const saveData = (data) => localStorage.setItem("intimations", JSON.stringify(data));

/* ---------- DYNAMIC GRAMMAR (1 Day vs 2 Days) ---------- */
function updateUnitGrammar() {
    const val = document.getElementById("durationValue").value;
    const unitSelect = document.getElementById("durationUnit");
    if (!unitSelect) return;
    
    for (let opt of unitSelect.options) {
        let base = opt.value; 
        opt.text = val == 1 
            ? base.slice(0, -1).charAt(0).toUpperCase() + base.slice(1, -1) 
            : base.charAt(0).toUpperCase() + base.slice(1);
    }
}

/* ---------- AUDITORY INTIMATION ---------- */
function playIntimationSound() {
    const audio = document.getElementById("alertSound");
    if (audio) {
        audio.play().catch(() => console.log("Sound blocked: Requires user interaction."));
    }
}

/* ---------- DEPLOY NEW INTIMATION ---------- */
function addNotification() {
    // 1. Capture all form inputs
    const appName = document.getElementById("appName").value.trim();
    const sender = document.getElementById("sender").value.trim();
    const description = document.getElementById("description").value.trim();
    const priority = document.getElementById("priority").value;
    const alertTime = document.getElementById("alertTime").value;
    const intervalHours = parseInt(document.getElementById("alertInterval").value) || 0;
    const dVal = parseInt(document.getElementById("durationValue").value);
    const dUnit = document.getElementById("durationUnit").value;

    // 2. STRICTOR VALIDATION
    // Check if App Name is missing
    if (!appName) {
        alert("Configuration Error: Please specify System Source / Application.");
        return;
    }

    // Check if Priority is empty (placeholder is still selected)
    if (!priority || priority === "") {
        alert("Configuration Error: Please select a Priority Tier (Critical, Standard, or Info).");
        return;
    }

    // Check if Duration is valid
    if (isNaN(dVal) || dVal <= 0) {
        alert("Configuration Error: Please specify a valid Visibility Duration.");
        return;
    }

    // 3. DATA PROCESSING
    let data = getData();
    const expiry = new Date();

    // Calculate Expiry Date math
    if (dUnit === "days") expiry.setDate(expiry.getDate() + dVal);
    else if (dUnit === "months") expiry.setMonth(expiry.getMonth() + dVal);
    else if (dUnit === "years") expiry.setFullYear(expiry.getFullYear() + dVal);

    // 4. SAVE OBJECT
    data.push({
        id: Date.now(),
        appName,
        sender: sender || "System Generated",
        description: description || "No detailed description provided.",
        priority,
        alertTime: alertTime || "Immediate",
        intervalHours: intervalHours,
        alertCount: 0,
        lastAlertTimestamp: null,
        hasBeenViewed: false, 
        expiry: expiry.toISOString()
    });

    saveData(data);
    
    // 5. REDIRECT
    window.location.href = "index.html";
}

/* ---------- POOL LIST MANAGEMENT ---------- */
function loadIntimations(priority) {
    const list = document.getElementById("list");
    if (!list) return;
    
    let data = getData();
    const now = new Date();
    
    // Filter by priority and ensure not expired
    const filtered = data.filter(n => n.priority === priority && new Date(n.expiry) > now);
    list.innerHTML = "";

    filtered.forEach(n => {
        let shouldBeep = false;
        
        // --- ALERT CALCULATION LOGIC ---
        if (n.intervalHours > 0 && !n.hasBeenViewed) {
            const maxAlerts = (n.priority === 'high') ? 3 : (n.priority === 'medium' ? 2 : 0);
            
            if (maxAlerts > 0) {
                const lastAlert = n.lastAlertTimestamp ? new Date(n.lastAlertTimestamp) : null;
                const intervalMs = n.intervalHours * 60 * 60 * 1000;

                // Daily Reset: If last alert was a different day, reset count
                if (lastAlert && lastAlert.toDateString() !== now.toDateString()) {
                    n.alertCount = 0;
                }

                if (n.alertCount < maxAlerts) {
                    if (!lastAlert || (now - lastAlert) >= intervalMs) {
                        shouldBeep = true;
                        n.alertCount++;
                        n.lastAlertTimestamp = now.toISOString();
                    }
                }
            }
        }

        // KILL-SWITCH: Once rendered, it's considered "seen" for this session
        n.hasBeenViewed = true;

        // Save states
        saveData(data.map(item => item.id === n.id ? n : item));

        if (shouldBeep) playIntimationSound();

        // --- RENDER ---
        const div = document.createElement("div");
        div.className = `intimation-item ${priority} ${shouldBeep ? 'pulse' : ''}`;
        div.innerHTML = `
            <div style="flex:1;">
                <div style="font-size: 1.2rem; font-weight: 850; margin-bottom: 2px;">${n.appName}</div>
                <div style="font-size: 0.85rem; font-weight: 700; opacity:0.8; margin-bottom: 8px;">From: ${n.sender}</div>
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.4;">${n.description}</p>
                <div style="display:flex; gap:8px; margin-top:12px;">
                    <span class="status-badge ${n.hasBeenViewed ? 'status-seen' : ''}">
                        ${n.hasBeenViewed ? '● SEEN' : '○ UNREAD'}
                    </span>
                    <span style="font-size:10px; background:rgba(0,0,0,0.05); padding:4px 8px; border-radius:5px; font-weight:700;">
                        ALERTS: ${n.alertCount} / ${(n.priority==='high'?3:2)}
                    </span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteItem(${n.id}, '${priority}')">×</button>
        `;
        list.appendChild(div);
    });
}

/* ---------- DASHBOARD & CACHE ---------- */
function updateDashboardCounters() {
    const data = getData();
    const now = new Date();
    const active = data.filter(n => new Date(n.expiry) > now);
    
    if(document.getElementById("highCount")) {
        document.getElementById("highCount").innerText = active.filter(n => n.priority === "high").length;
        document.getElementById("mediumCount").innerText = active.filter(n => n.priority === "medium").length;
        document.getElementById("lowCount").innerText = active.filter(n => n.priority === "low").length;
    }
}

function clearAllData() {
    if(confirm("Are you sure? This will wipe all system intimations.")) {
        localStorage.removeItem("intimations");
        location.reload();
    }
}

window.deleteItem = (id, prio) => {
    let data = getData().filter(n => n.id !== id);
    saveData(data);
    loadIntimations(prio);
};

/* ---------- INITIALIZATION ---------- */
document.addEventListener("DOMContentLoaded", () => {
    updateDashboardCounters();
    
    // Auto-update grammar on Add page
    const durVal = document.getElementById("durationValue");
    if (durVal) {
        durVal.addEventListener("input", updateUnitGrammar);
        updateUnitGrammar();
    }
});