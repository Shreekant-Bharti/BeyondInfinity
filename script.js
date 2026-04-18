let lastLevel_T01 = null;
let lastChangeTime_T01 = Date.now();
let dryRunTriggered_T01 = false;

class TankSystem {
    constructor() {
        this.tanks = [
            { id: 'T-01', name: 'Main Overhead Tank', location: 'Central Campus', level: 78, capacity: 50000, pumpStatus: 'OFF', dataSource: 'LIVE', history: Array(7).fill(78), coordinates: [23.7592, 86.4305] },
            { id: 'T-02', name: 'Boys Hostel Block-A', location: 'North Wing', level: 45, capacity: 20000, pumpStatus: 'OFF', dataSource: 'SIMULATED', history: Array(7).fill(45), coordinates: [23.7600, 86.4310] },
            { id: 'T-03', name: 'Boys Hostel Block-B', location: 'North Wing', level: 18, capacity: 20000, pumpStatus: 'ON', dataSource: 'SIMULATED', history: Array(7).fill(18), coordinates: [23.7605, 86.4315] },
            { id: 'T-04', name: 'Girls Hostel', location: 'South Wing', level: 12, capacity: 25000, pumpStatus: 'ON', dataSource: 'SIMULATED', history: Array(7).fill(12), coordinates: [23.7580, 86.4290] },
            { id: 'T-05', name: 'Admin Block', location: 'Main Gate', level: 91, capacity: 15000, pumpStatus: 'OFF', dataSource: 'SIMULATED', history: Array(7).fill(91), coordinates: [23.7575, 86.4320] },
            { id: 'T-06', name: 'Library & Lab Block', location: 'Academic Area', level: 55, capacity: 18000, pumpStatus: 'OFF', dataSource: 'SIMULATED', history: Array(7).fill(55), coordinates: [23.7585, 86.4300] }
        ];
        this.chart = null;
        this.map = null;
        this.markers = {};
        this.chartLabels = ['-30m', '-25m', '-20m', '-15m', '-10m', '-5m', 'Now'];
        this.colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
    }

    init() {
        this.initTabs();
        this.initClock();
        this.buildGauges();
        this.buildTable();
        this.initChart();
        setTimeout(() => this.initMap(), 500); // give DOM time to render
        this.updateUI();

        // Remove Loader
        const loader = document.getElementById('loader');
        if (loader) {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }, 1500);
        }

        // Start simulation loop
        setInterval(() => this.simulate(), 5000);
    }

    initTabs() {
        const tabs = document.querySelectorAll('.nav-bar .tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                const target = tab.getAttribute('data-target');
                tab.classList.add('active');
                document.getElementById(target).classList.add('active');

                if (target === 'tab-map' && this.map) {
                    this.map.invalidateSize();
                }
            });
        });
    }

    initClock() {
        setInterval(() => {
            const now = new Date();
            const clockEl = document.getElementById('clock');
            const dateEl  = document.getElementById('date');
            const tsEl    = document.getElementById('tableTimestamp');
            if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-IN');
            if (dateEl)  dateEl.textContent  = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
            if (tsEl)    tsEl.textContent    = now.toLocaleTimeString('en-IN') + ' ' + now.toLocaleDateString('en-IN');
        }, 1000);
    }

    getStatusProps(level) {
        if (level < 20) return { label: 'Critical', class: 'fill-critical', mapColor: 'red' };
        if (level < 50) return { label: 'Low',      class: 'fill-low',      mapColor: 'red' };
        if (level < 70) return { label: 'Medium',   class: 'fill-medium',   mapColor: 'green' };
        if (level < 90) return { label: 'Normal',   class: 'fill-normal',   mapColor: 'green' };
        return             { label: 'Full',      class: 'fill-full',     mapColor: 'green' };
    }

    getProgressBarColor(level) {
        if (level < 20) return '#c0392b';
        if (level < 50) return '#e67e22';
        if (level < 70) return '#f1c40f';
        return '#2d7a3a';
    }

    applyTestData() {
        const levelInput = document.getElementById('testLevel');
        const pumpInput  = document.getElementById('testPump');
        if (!levelInput || !pumpInput) return;

        let level = parseInt(levelInput.value);
        let motor = parseInt(pumpInput.value);

        if (isNaN(level)) { alert('Enter valid level'); return; }

        level = Math.max(0, Math.min(100, level));

        const tank = this.tanks.find(t => t.id === 'T-01');
        if (!tank) return;

        tank.level      = level;
        tank.pumpStatus = motor === 1 ? 'ON' : 'OFF';
        tank.dataSource = 'MANUAL';

        tank.history.shift();
        tank.history.push(tank.level);

        this.updateUI();
    }

    buildGauges() {
        const grid = document.getElementById('gaugesGrid');
        if (!grid) return;
        grid.innerHTML = '';
        this.tanks.forEach((tank) => {
            const status      = this.getStatusProps(tank.level);
            const sourceBadge = tank.dataSource === 'LIVE'
                ? '<span class="badge bg-green-text">🟢 LIVE</span>'
                : '<span class="badge bg-blue-text">🔵 SIMULATED</span>';
            const pumpIcon  = tank.pumpStatus === 'ON' ? '<div class="dot"></div> 🟢 ON (Auto)' : '🔴 OFF';
            const pumpClass = tank.pumpStatus === 'ON' ? 'pump-on' : 'pump-off';

            grid.innerHTML += `
                <div class="gauge-card">
                    <div class="gauge-title">${tank.id} - ${tank.name}</div>
                    <div style="margin-bottom: 10px;">${sourceBadge}</div>
                    <div class="tank-container">
                        <div class="tank-fill" id="fill_${tank.id}" style="height: ${tank.level}%;">
                            <div class="tank-text" id="text_${tank.id}">${tank.level}%</div>
                        </div>
                    </div>
                    <div class="tank-bottom-pipe"></div>
                    <div class="pump-indicator ${pumpClass}" id="pumpInd_${tank.id}" style="justify-content:center; margin-top:10px;">
                        ${pumpIcon}
                    </div>
                    <div class="gauge-bot-info">
                        <span class="badge ${status.class}" id="badgeG_${tank.id}">${status.label}</span>
                        <div style="margin-top:5px; color:var(--text-muted)">Cap: ${tank.capacity.toLocaleString()} L</div>
                    </div>
                </div>
            `;
        });
    }

    buildTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        this.tanks.forEach((tank, idx) => {
            const status      = this.getStatusProps(tank.level);
            const sourceBadge = tank.dataSource === 'LIVE'
                ? '<span class="badge bg-green-text">🟢 LIVE HARDWARE</span>'
                : '<span class="badge bg-blue-text">🔵 SIMULATED</span>';
            const pumpClass = tank.pumpStatus === 'ON' ? 'pump-on' : 'pump-off';
            const pumpText  = tank.pumpStatus === 'ON' ? '<div class="dot"></div> 🟢 ON (Auto)' : '🔴 OFF';

            tbody.innerHTML += `
                <tr>
                    <td>${idx + 1}</td>
                    <td class="monospace">${tank.id}</td>
                    <td><strong>${tank.name}</strong><br><small style="color:var(--text-muted)">${tank.location}</small></td>
                    <td>${sourceBadge}</td>
                    <td>
                        <div class="progress-container">
                            <span id="tblLvl_${tank.id}" style="font-weight:bold; width:35px">${tank.level}%</span>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" id="tblBar_${tank.id}" style="width: ${tank.level}%; background-color: ${this.getProgressBarColor(tank.level)}"></div>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge ${status.class}" id="tblBadge_${tank.id}">${status.label}</span></td>
                    <td><div class="pump-indicator ${pumpClass}" id="tblPump_${tank.id}">${pumpText}</div></td>
                    <td>${tank.capacity.toLocaleString()} L</td>
                    <td id="tblTime_${tank.id}">Just now</td>
                    <td><button class="btn-small" onclick="system.openModal('${tank.id}')">View Details</button></td>
                </tr>
            `;
        });
    }

    initChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;
        const datasets = this.tanks.map((tank, i) => ({
            label:           tank.id + ' (' + tank.name + ')',
            data:            [...tank.history],
            borderColor:     this.colors[i],
            backgroundColor: this.colors[i] + '33',
            borderWidth:     2,
            tension:         0.4,
            fill:            false
        }));

        this.chart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { labels: this.chartLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title:  { display: true, text: 'Real-time Water Level Monitoring — BIT Sindri Campus' },
                    legend: { position: 'bottom' }
                },
                scales: {
                    y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    initMap() {
        const mapEl = document.getElementById('map');
        if (!mapEl) return;

        this.map = L.map('map').setView([23.7589, 86.4308], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        this.tanks.forEach(tank => {
            const colorClass = this.getStatusProps(tank.level).mapColor;
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html:      `<div class="map-marker ${colorClass}" id="marker_${tank.id}"></div>
                            <div class="map-marker-label">${tank.id}</div>`,
                iconSize:  [20, 20],
                iconAnchor:[10, 10]
            });
            const marker = L.marker(tank.coordinates, { icon }).addTo(this.map);
            marker.bindPopup(`
                <div style="font-family:'Noto Sans', sans-serif">
                    <strong>${tank.id} - ${tank.name}</strong><br>
                    Level: <strong id="popupLvl_${tank.id}">${tank.level}%</strong><br>
                    Pump: <strong id="popupPump_${tank.id}">${tank.pumpStatus}</strong><br>
                    <button class="btn-small" style="margin-top:5px; width:100%" onclick="system.openModal('${tank.id}')">View Details</button>
                </div>
            `);
            this.markers[tank.id] = marker;
        });

        setTimeout(() => this.map.invalidateSize(), 1000);
    }

    addLogEntry(msg, type = 'sync') {
        const log = document.getElementById('systemLog');
        if (!log) return;
        const time = new Date().toLocaleTimeString('en-IN');
        let classColor = 'log-msg-sync';
        if (type === 'on')    classColor = 'log-msg-on';
        if (type === 'off')   classColor = 'log-msg-off';
        if (type === 'alert') classColor = 'log-msg-alert';
        log.insertAdjacentHTML('afterbegin',
            `<div class="log-entry"><span class="log-time">[${time}]</span> <span class="${classColor}">${msg}</span></div>`
        );
    }

    simulate() {
        this.tanks.forEach(tank => {
            // Skip LIVE tank — data comes from Blynk / backend
            if (tank.dataSource === 'LIVE') return;

            const change = tank.pumpStatus === 'ON'
                ? Math.floor(Math.random() * 5) + 2
                : -(Math.floor(Math.random() * 3) + 1);

            tank.level = Math.max(0, Math.min(100, tank.level + change));

            if (tank.level < 20) tank.pumpStatus = 'ON';
            if (tank.level > 90) tank.pumpStatus = 'OFF';

            tank.history.shift();
            tank.history.push(tank.level);
        });

        this.updateUI();
    }

    updateUI() {
        let totalLevel = 0;
        let alerts     = 0;
        let pumpsOn    = 0;

        const alertsList = document.getElementById('alertsList');
        if (alertsList) alertsList.innerHTML = '';

        this.tanks.forEach((tank, i) => {
            totalLevel += tank.level;
            const status = this.getStatusProps(tank.level);
            if (tank.level < 20) alerts++;
            if (tank.pumpStatus === 'ON') pumpsOn++;

            // 1. Gauges
            const fillEl = document.getElementById(`fill_${tank.id}`);
            const textEl = document.getElementById(`text_${tank.id}`);
            const badgeGEl = document.getElementById(`badgeG_${tank.id}`);
            const pumpEl = document.getElementById(`pumpInd_${tank.id}`);
            if (fillEl)  fillEl.style.height  = tank.level + '%';
            if (textEl)  textEl.innerText      = tank.level + '%';
            if (badgeGEl){ badgeGEl.className  = `badge ${status.class}`; badgeGEl.innerText = status.label; }
            if (pumpEl) {
                if (tank.pumpStatus === 'ON') {
                    pumpEl.className = 'pump-indicator pump-on';
                    pumpEl.innerHTML = '<div class="dot"></div> 🟢 ON (Auto)';
                } else {
                    pumpEl.className = 'pump-indicator pump-off';
                    pumpEl.innerHTML = '🔴 OFF';
                }
            }

            // 2. Table
            const lvlEl   = document.getElementById(`tblLvl_${tank.id}`);
            const barEl   = document.getElementById(`tblBar_${tank.id}`);
            const badgeTEl= document.getElementById(`tblBadge_${tank.id}`);
            const tPumpEl = document.getElementById(`tblPump_${tank.id}`);
            const timeEl  = document.getElementById(`tblTime_${tank.id}`);
            if (lvlEl)   lvlEl.innerText = tank.level + '%';
            if (barEl)   { barEl.style.width = tank.level + '%'; barEl.style.backgroundColor = this.getProgressBarColor(tank.level); }
            if (badgeTEl){ badgeTEl.className = `badge ${status.class}`; badgeTEl.innerText = status.label; }
            if (tPumpEl) {
                if (tank.pumpStatus === 'ON') {
                    tPumpEl.className = 'pump-indicator pump-on';
                    tPumpEl.innerHTML = '<div class="dot"></div> 🟢 ON (Auto)';
                } else {
                    tPumpEl.className = 'pump-indicator pump-off';
                    tPumpEl.innerHTML = '🔴 OFF';
                }
            }
            if (timeEl) timeEl.innerText = new Date().toLocaleTimeString('en-IN');

            // 3. Chart
            if (this.chart) this.chart.data.datasets[i].data = [...tank.history];

            // 4. Map
            if (this.map) {
                const markerDiv = document.getElementById(`marker_${tank.id}`);
                if (markerDiv) markerDiv.className = `map-marker ${status.mapColor}`;
                const pLvl  = document.getElementById(`popupLvl_${tank.id}`);
                const pPump = document.getElementById(`popupPump_${tank.id}`);
                if (pLvl)  pLvl.innerText  = tank.level + '%';
                if (pPump) pPump.innerText  = tank.pumpStatus;
            }

            // 5. Alerts (Dynamic Safe Injection)
            const alertsList = document.getElementById("alertsContainer");
            if (alertsList && tank.level <= 25) {
                const isCrit = tank.level < 20;
                const dotClass = isCrit ? 'danger-dot' : 'warning-dot';
                const title = isCrit ? 'Critical Water Level' : 'Low Water Level';
                const action = tank.pumpStatus === 'ON' ? 'Pump auto-activated.' : 'Awaiting auto-control.';
                const borderClass = isCrit ? '' : 'style="border-left-color: #f39c12; background-color: #fffaf0;"';
                
                if (!document.getElementById(`dyn_alert_${tank.id}`)) {
                    const alertDiv = document.createElement('div');
                    alertDiv.id = `dyn_alert_${tank.id}`;
                    alertDiv.className = 'alert-card';
                    if (!isCrit) {
                        alertDiv.style.borderLeftColor = "#f39c12";
                        alertDiv.style.backgroundColor = "#fffaf0";
                    }
                    
                    alertDiv.innerHTML = `
                        <div class="alert-left-icon">
                            <div class="${dotClass}"></div>
                        </div>
                        <div class="alert-content">
                            <h4>Tank ${tank.id} — ${title}</h4>
                            <p class="alert-desc">Level at ${tank.level}%. Below threshold (20%). ${action}</p>
                            <p class="alert-time">${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}</p>
                            <div class="alert-btn-row">
                                <button onclick="system.acknowledgeAlert('${tank.id}')">Acknowledge</button>
                                <button onclick="system.openModal('${tank.id}')">View Tank</button>
                            </div>
                        </div>
                    `;
                    alertsList.appendChild(alertDiv);
                } else {
                    // Update content if level changes
                    const existing = document.getElementById(`dyn_alert_${tank.id}`);
                    if (existing) {
                        const desc = existing.querySelector('.alert-desc');
                        if (desc) desc.innerText = `Level at ${tank.level}%. Below threshold (20%). ${action}`;
                    }
                }
            } else if (alertsList && tank.level > 25) {
                const exist = document.getElementById(`dyn_alert_${tank.id}`);
                if (exist) exist.remove();
            }
        });

        // Stats
        const avgEl   = document.getElementById('statAvgLevel');
        const altEl   = document.getElementById('statAlerts');
        const pumEl   = document.getElementById('statPumps');
        if (avgEl) avgEl.innerText = Math.round(totalLevel / this.tanks.length) + '%';
        if (altEl) altEl.innerText = alerts;
        if (pumEl) pumEl.innerText = pumpsOn;

        // Alert styling
        const pulseEl = document.getElementById('iconAlertPulse');
        const cardEl  = document.getElementById('cardAlerts');
        if (alerts > 0) {
            if (pulseEl) pulseEl.classList.add('pulse-red');
            if (cardEl)  cardEl.style.borderTopColor = 'var(--danger)';
        } else {
            if (pulseEl) pulseEl.classList.remove('pulse-red');
            if (cardEl)  cardEl.style.borderTopColor = 'var(--text-muted)';
            if (alertsList) alertsList.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No active alerts. All levels normal.</p>';
        }

        const spinEl = document.getElementById('iconPumpSpin');
        if (spinEl) {
            pumpsOn > 0 ? spinEl.classList.add('fa-spin') : spinEl.classList.remove('fa-spin');
        }

        if (this.chart) this.chart.update();

        // Update open modal
        const modalLvl = document.getElementById('modalLvl');
        if (modalLvl && modalLvl.dataset.tankId) {
            const t = this.tanks.find(x => x.id === modalLvl.dataset.tankId);
            if (t) this.updateModalData(t);
        }
    }

    acknowledgeAlert(id) {
        const el = document.getElementById(`alert_${id}`);
        if (el) {
            el.style.opacity = '0.5';
            el.innerHTML = '<div style="padding:10px;">Alert Acknowledged by User</div>';
            this.addLogEntry(`USER_ACK → Alert for ${id} acknowledged.`, 'sync');
        }
    }

    openModal(tankId) {
        const tank = this.tanks.find(t => t.id === tankId);
        if (!tank) return;
        const titleEl = document.getElementById('modalTitle');
        if (titleEl) {
            titleEl.innerHTML = `${tank.id} - ${tank.name}
                ${tank.dataSource === 'LIVE'
                    ? '<span class="badge bg-green-text" style="background:#fff; margin-left:10px;">🟢 LIVE HARDWARE</span>'
                    : '<span class="badge bg-blue-text" style="background:#fff; margin-left:10px;">🔵 SIMULATED</span>'}`;
        }
        const modalLvl = document.getElementById('modalLvl');
        if (modalLvl) modalLvl.dataset.tankId = tank.id;
        this.updateModalData(tank);
        const modal = document.getElementById('tankModal');
        if (modal) modal.classList.add('active');
    }

    updateModalData(tank) {
        const fillEl   = document.getElementById('modalTankFill');
        const textEl   = document.getElementById('modalTankText');
        const lvlEl    = document.getElementById('modalLvl');
        const capEl    = document.getElementById('modalCap');
        const pumpEl   = document.getElementById('modalPump');
        const srcEl    = document.getElementById('modalSource');
        if (fillEl)  fillEl.style.height = tank.level + '%';
        if (textEl)  textEl.innerText    = tank.level + '%';
        if (lvlEl)   lvlEl.innerHTML     = `<strong>${tank.level}%</strong>`;
        if (capEl)   capEl.innerText     = tank.capacity.toLocaleString() + ' L';
        if (pumpEl)  pumpEl.innerHTML    = tank.pumpStatus === 'ON'
            ? '<span style="color:var(--success);font-weight:bold">🟢 ON (Auto)</span>'
            : '<span style="color:var(--danger);font-weight:bold">🔴 OFF</span>';
        if (srcEl)   srcEl.innerText     = tank.dataSource === 'LIVE' ? 'Connected (ESP32 Node 1)' : 'Offline (Simulated)';
    }

    closeModal() {
        const modal    = document.getElementById('tankModal');
        const modalLvl = document.getElementById('modalLvl');
        if (modal)    modal.classList.remove('active');
        if (modalLvl) modalLvl.dataset.tankId = '';
    }
}

// require("dotenv").config({
//   path: require("path").join(__dirname, "..", ".env"),
// });
// ─── Blynk IoT Configuration ─────────────────────────────────────────────────
// Token for hardware tank T-01 (ESP32 connected via Blynk Cloud)
// const TOKEN = process.env.TOKEN;
// const TOKEN = "vS3152tcqEXTh_CmhnST4qJ1C5Ltrrwa";

// Virtual pins:
//   V0 → Water level (%)
//   V1 → Motor status from auto logic (0/1)
//   V2 → Mode switch: 1 = AUTO, 0 = MANUAL
//   V3 → Manual motor command (0/1)

// ─── Backend API base URL ─────────────────────────────────────────────────────
// Relative path — works from http://localhost:3000 (served by Express).
// Falls back gracefully when backend is offline.
const BACKEND_URL = "/api";

// ─── getData — Polls Blynk Cloud for live T-01 sensor data ───────────────────
async function getData() {
    try {
        const [levelRes, motorRes, modeRes, manualRes] = await Promise.all([
            fetch(`https://blynk.cloud/external/api/get?token=${TOKEN}&V0`),
            fetch(`https://blynk.cloud/external/api/get?token=${TOKEN}&V1`),
            fetch(`https://blynk.cloud/external/api/get?token=${TOKEN}&V2`),
            fetch(`https://blynk.cloud/external/api/get?token=${TOKEN}&V3`)
        ]);

        const levelData  = await levelRes.text();
        const motorData  = await motorRes.text();
        const modeData   = await modeRes.text();
        const manualData = await manualRes.text();

        let level       = parseInt(levelData);
        let motor       = parseInt(motorData);
        let mode        = parseInt(modeData);
        let manualMotor = parseInt(manualData);

        if (isNaN(level)) return;

        const tank = system.tanks.find(t => t.id === 'T-01');
        if (!tank) return;

        level      = Math.max(0, Math.min(100, level));
        tank.level = level;
        tank.dataSource = 'LIVE';

        // Mode handling
        if (mode === 1) {
            tank.mode       = 'AUTO';
            if (!isNaN(motor)) tank.pumpStatus = motor === 1 ? 'ON' : 'OFF';
        } else {
            tank.mode       = 'MANUAL';
            if (!isNaN(manualMotor)) tank.pumpStatus = manualMotor === 1 ? 'ON' : 'OFF';
        }

        // Sync mode toggle UI
        const toggle = document.getElementById('modeToggle');
        const label  = document.getElementById('modeLabel');
        if (toggle) toggle.checked    = (mode === 1);
        if (label)  label.innerText   = mode === 1 ? 'AUTO' : 'MANUAL';

        // Also POST to local backend so MongoDB gets the reading
        fetch(`${BACKEND_URL}/tank`, {
            method:  'POST',
            headers: window.getAuthHeaders ? window.getAuthHeaders() : { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                id:         'T-01',
                level:      level,
                pumpStatus: tank.pumpStatus
            })
        }).catch(() => {});

        tank.history.shift();
        tank.history.push(level);

        /* 🚨 DRY RUN DETECTION for T-01 — uncomment to enable
        if (lastLevel_T01 === null) {
            lastLevel_T01 = level;
            lastChangeTime_T01 = Date.now();
        }

        // Level increasing → reset timer
        if (level > lastLevel_T01) {
            lastChangeTime_T01 = Date.now();
            dryRunTriggered_T01 = false;
        }

        lastLevel_T01 = level;

        if (
            tank.pumpStatus === "ON" &&
            (Date.now() - lastChangeTime_T01 > 15000) &&
            !dryRunTriggered_T01
        ) {
            triggerDryRunProtection_T01(tank.mode);
        }
        */

        console.log(`[Blynk] Level: ${level}% | Mode: ${tank.mode} | Pump: ${tank.pumpStatus}`);

    } catch (err) {
        console.warn('getData: Blynk unreachable —', err.message);
    }
}

// ─── Controls — write back to Blynk Cloud ────────────────────────────────────

async function setMode(val) {
    try {
        await fetch(`https://blynk.cloud/external/api/update?token=${TOKEN}&V2=${val}`);
        console.log('Mode:', val === 0 ? 'AUTO' : 'MANUAL');

        // Mirror to local backend as well
        const mode = val === 1 ? 'MANUAL' : 'AUTO';
        fetch(`${BACKEND_URL}/mode`, {
            method:  'POST',
            headers: window.getAuthHeaders ? window.getAuthHeaders() : { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: 'T-01', mode })
        }).catch(() => {});
    } catch (err) {
        console.warn('setMode: Blynk unreachable —', err.message);
    }
}

async function setMotor(val) {
    if (localStorage.getItem('wt_role') === "STUDENT") {
        alert("Access Denied");
        return;
    }
    try {
        await fetch(`https://blynk.cloud/external/api/update?token=${TOKEN}&V3=${val}`);
        console.log('Motor:', val === 1 ? 'ON' : 'OFF');

        // Mirror to local backend as well
        const pumpStatus = val === 1 ? 'ON' : 'OFF';
        fetch(`${BACKEND_URL}/pump`, {
            method:  'POST',
            headers: window.getAuthHeaders ? window.getAuthHeaders() : { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: 'T-01', pumpStatus })
        }).catch(() => {});
    } catch (err) {
        console.warn('setMotor: Blynk unreachable —', err.message);
    }
}

function toggleMode(el) {
    if (localStorage.getItem('wt_role') === "STUDENT") {
        alert("Access Denied");
        el.checked = !el.checked; // Revert click
        return;
    }
    const value = el.checked ? 1 : 0; // 1 = MANUAL, 0 = AUTO
    setMode(value);
    const label = document.getElementById('modeLabel');
    if (label) label.innerText = value === 1 ? 'MANUAL' : 'AUTO';
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const system = new TankSystem();

window.onload = () => {
    system.init();

    // Poll Blynk for live T-01 data
    setInterval(getData, 1000);

    // Initial render for persistent alerts
    updateAlertUI();
    // updateDryRunHistoryUI(); // uncomment when DRY RUN block is re-enabled

    // Simulate all non-LIVE tanks + refresh UI
    setInterval(() => {
        system.simulate();
        system.updateUI();
    }, 1000);
};

// ─── DRY RUN PROTECTION SYSTEM ────────────────────────────────────────────────
/* ── Uncomment below to re-enable dry run protection ──
async function triggerDryRunProtection_T01(currentMode = null) {
    dryRunTriggered_T01 = true;
    console.log("🚨 DRY RUN DETECTED: T-01");

    if (currentMode !== 'MANUAL') {
        // 1. FORCE MANUAL MODE (mode = 0)
        await fetch("/api/mode", {
            method: "POST",
            headers: window.getAuthHeaders ? window.getAuthHeaders() : { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: 0 })
        });
        setMode(0); // also update hardware
    }

    // 2. TURN OFF PUMP
    await fetch("/api/pump", {
        method: "POST",
        headers: window.getAuthHeaders ? window.getAuthHeaders() : { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: "T-01",
            pumpStatus: "OFF"
        })
    });
    setMotor(0); // also update hardware

    // 3. CREATE ALERT
    createDryRunAlert_T01();

    // 4. SHOW TOAST (NO UI CHANGE)
    alert("⚠ Dry Run Detected! Water level is not increasing. Pump turned OFF automatically.");
}

function createDryRunAlert_T01() {
    let alerts = JSON.parse(localStorage.getItem("alerts")) || [];

    // Prevent duplicate alerts
    let exists = alerts.some(a => a.tankId === "T-01" && a.fault === "DRY_RUN");
    if (exists) return;

    let newAlert = {
        id: "DRYRUN_T01_" + Date.now(),
        type: "CRITICAL",
        fault: "DRY_RUN",
        title: "Tank T-01 — Dry Run Detected",
        message: "Water level is not increasing. Please contact the technician!",
        tankId: "T-01",
        timestamp: new Date().toLocaleTimeString('en-IN') + ' ' + new Date().toLocaleDateString('en-IN'),
        status: "ACTIVE"
    };

    alerts.push(newAlert);
    localStorage.setItem("alerts", JSON.stringify(alerts));
    console.log("Alert created: Dry run detected for T-01");
    updateAlertUI();
}
── End of dry run protection ── */

function updateAlertUI() {
    const container = document.getElementById("alertsContainer");

    // ❗ VERY IMPORTANT CHECK
    if (!container) {
        console.warn("alertsContainer not found — skipping render");
        return;
    }

    let alerts = JSON.parse(localStorage.getItem("alerts")) || [];

    // Only clear persistent alerts to keep dynamic ones from flickering
    let persistentChildren = Array.from(container.children).filter(c => c.id && c.id.startsWith("persist_alert_"));
    persistentChildren.forEach(child => child.remove());

    alerts.forEach(alert => {
        let currentUser = { role: localStorage.getItem('wt_role') };
        let canRemove = (currentUser.role === "ADMIN" || currentUser.role === "WARDEN");
        let ts = alert.timestamp || new Date().toLocaleTimeString();

        const div = document.createElement("div");
        div.className = "alert-card alert-critical";
        div.id = `persist_alert_${alert.id}`;

        div.innerHTML = `
            <div class="alert-left-icon">
                <div class="danger-dot"></div>
            </div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p class="alert-desc"><strong>FAULT:</strong> ${alert.fault}. ${alert.message}</p>
                <p class="alert-time">${alert.timestamp}</p>
                <div class="alert-btn-row">
                    ${
                        (currentUser.role === "ADMIN" || currentUser.role === "WARDEN")
                        ? `<button class="btn-remove" onclick="removeAlert('${alert.id}')">Remove Alert</button>`
                        : ""
                    }
                </div>
            </div>
        `;


        container.appendChild(div);
    });

    updateAlertBadge();
}

function removeAlert(id) {
    let alerts = JSON.parse(localStorage.getItem("alerts")) || [];
    let alertToRemove = alerts.find(a => a.id === id);

    if (!alertToRemove) return;

    let userObj = JSON.parse(localStorage.getItem('wt_user') || '{}');
    let currentUser = { 
        role: localStorage.getItem('wt_role'),
        name: userObj.name || 'Unknown'
    };
    
    if (
        currentUser.role !== "ADMIN" &&
        currentUser.role !== "WARDEN"
    ) {
        alert("Unauthorized action");
        return;
    }

    /* ── DRY RUN deletion logic — uncomment to re-enable ──
    if (alertToRemove.fault === "DRY_RUN") {
        // ─── STEP 1: Collect proof details via prompt (temporary until modal UI is built) ───
        const repairDetails = (prompt("📋 Enter issue / repair details (required):", "") || "").trim();
        if (!repairDetails) {
            alert("❌ Deletion cancelled! Repair details are required before removing a DRY RUN alert.");
            return;
        }

        const repairCostRaw = (prompt("💰 Enter repair cost in ₹ (required, must be > 0):", "") || "").trim();
        if (!repairCostRaw) {
            alert("❌ Deletion cancelled! Repair cost is required before removing a DRY RUN alert.");
            return;
        }
        const repairCost = Number(repairCostRaw);
        if (isNaN(repairCost) || repairCost <= 0) {
            alert("❌ Invalid repair cost! Please enter a valid number greater than 0.");
            return;
        }

        // ─── STEP 2: Debug log ───────────────────────────────────────────────────────────
        console.log("Deleting DRY RUN with:", { repairDetails, repairCost });

        // ─── STEP 3: Save to localStorage history ────────────────────────────────────────
        let history = JSON.parse(localStorage.getItem("dryRunHistory")) || [];
        let historyEntry = {
            id: alertToRemove.id,
            tankId: alertToRemove.tankId,
            title: alertToRemove.title,
            fault: alertToRemove.fault,
            message: alertToRemove.message,
            deletedBy: currentUser.name,
            deletedRole: currentUser.role,
            repairDetails: repairDetails,
            repairCost: repairCost,
            deletedAt: new Date().toLocaleString()
        };
        history.unshift(historyEntry);
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem("dryRunHistory", JSON.stringify(history));

        // ─── STEP 4: Sync to backend MongoDB with real data ──────────────────────────────
        let backendEntry = { ...historyEntry, billImage: "N/A" };
        fetch("/api/dryrun/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("wt_token")
            },
            body: JSON.stringify(backendEntry)
        }).catch(err => console.error("Failed to sync DRY RUN history to backend:", err));
    }
    ── End of DRY RUN deletion logic ── */

    alerts = alerts.filter(a => a.id !== id);
    localStorage.setItem("alerts", JSON.stringify(alerts));

    updateAlertUI();
    // updateDryRunHistoryUI(); // uncomment when DRY RUN block is re-enabled
}

/* ── updateDryRunHistoryUI — uncomment to re-enable ──
function updateDryRunHistoryUI() {
    const container = document.getElementById("dryRunHistoryBox");
    if (!container) return;

    let history = JSON.parse(localStorage.getItem("dryRunHistory")) || [];
    container.innerHTML = "";

    if (history.length === 0) {
        container.innerHTML = "<p style='color:var(--text-muted); font-size:12px;'>No history available</p>";
        return;
    }

    history.forEach(item => {
        let html = `
        <div style="margin-bottom:10px; color:#c9d1d9; font-size:12px;">
            <strong style="color:white; font-size:13px;">${item.title}</strong><br/>
            <span>Fault: ${item.fault}</span><br/>
            <span>Deleted by: ${item.deletedRole} (${item.deletedBy})</span><br/>
            <small style="color:#8b949e;">${item.deletedAt}</small>
        </div>
        <hr style="border-color: #30363d; margin:5px 0 10px 0;" />
        `;
        container.innerHTML += html;
    });
}
── End of updateDryRunHistoryUI ── */

function updateAlertBadge() {
    let alerts = JSON.parse(localStorage.getItem("alerts")) || [];
    const badge = document.getElementById("alertCount");
    
    if (badge) {
        badge.innerText = alerts.length;
    }
}

function downloadReport() {
    window.open("/api/reports/download?all=true&token=" + localStorage.getItem("wt_token"), "_blank");
}
