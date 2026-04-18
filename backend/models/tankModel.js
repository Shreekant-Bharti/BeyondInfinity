'use strict';

const logger            = require('../utils/logger');
const HistoryRepository = require('../db/historyRepository');

const HISTORY_LIMIT           = 20;
const AUTO_PUMP_ON_AT         = 20;
const AUTO_PUMP_OFF_AT        = 90;
const MODE_SWITCH_COOLDOWN_MS = 2000;

const INITIAL_TANKS = [
  {
    id: 'T-01', name: 'Main OHT (Civil Block)', location: 'Civil Engineering Block — Roof',
    capacity: 5000, level: 50, pumpStatus: 'OFF', mode: 'AUTO', source: 'HARDWARE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'T-02', name: 'Hostel Block A OHT', location: 'Hostel Block A — Roof',
    capacity: 3000, level: 72, pumpStatus: 'OFF', mode: 'AUTO', source: 'HARDWARE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'T-03', name: 'Admin Block OHT', location: 'Administration Building — Roof',
    capacity: 2000, level: 15, pumpStatus: 'ON', mode: 'AUTO', source: 'HARDWARE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'T-04', name: 'Hostel Block B OHT', location: 'Hostel Block B — Roof',
    capacity: 3000, level: 88, pumpStatus: 'OFF', mode: 'AUTO', source: 'SIMULATED',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'T-05', name: 'Library Block OHT', location: 'Central Library — Roof',
    capacity: 1500, level: 45, pumpStatus: 'OFF', mode: 'AUTO', source: 'SIMULATED',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'T-06', name: 'Workshop Block OHT', location: 'Workshop & Labs Block',
    capacity: 2500, level: 60, pumpStatus: 'OFF', mode: 'AUTO', source: 'SIMULATED',
    updatedAt: new Date().toISOString(),
  },
];

const tankStore       = new Map();
const historyStore    = new Map();
const lastModeSwitchAt = new Map();

INITIAL_TANKS.forEach((tank) => {
  tankStore.set(tank.id, { ...tank });
  historyStore.set(tank.id, []);
  lastModeSwitchAt.set(tank.id, 0);
});

function pushHistory(tankId, tank) {
  const history = historyStore.get(tankId);
  if (!history) return;

  history.push({
    tankId:     tank.id,
    level:      tank.level,
    pumpStatus: tank.pumpStatus,
    mode:       tank.mode,
    timestamp:  Date.now(),
  });

  if (history.length > HISTORY_LIMIT) history.shift();

  logger.info(`History updated for ${tankId}`, {
    level: tank.level, pumpStatus: tank.pumpStatus, bufferSize: history.length,
  });
}

function applyAutoLogic(tank) {
  let desired = tank.pumpStatus;

  if (tank.level < AUTO_PUMP_ON_AT)       desired = 'ON';
  else if (tank.level > AUTO_PUMP_OFF_AT) desired = 'OFF';

  if (desired !== tank.pumpStatus) {
    const prev = tank.pumpStatus;
    tank.pumpStatus = desired;
    logger.pump(tank.id, prev, desired,
      `AUTO:level=${tank.level}% (on<${AUTO_PUMP_ON_AT}%, off>${AUTO_PUMP_OFF_AT}%)`);
    return true;
  }
  return false;
}

const TankModel = {

  getAllTanks() {
    return Array.from(tankStore.values()).map((t) => ({ ...t }));
  },

  getTankById(id) {
    const tank = tankStore.get(id);
    return tank ? { ...tank } : null;
  },

  getHistory(tankId) {
    if (tankId) {
      const history = historyStore.get(tankId);
      return history ? [...history].reverse() : [];
    }
    const all = [];
    historyStore.forEach((records) => all.push(...records));
    return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, HISTORY_LIMIT);
  },

  updateSensorData(id, level, pumpStatus) {
    const tank = tankStore.get(id);
    if (!tank) return { success: false, error: `Tank '${id}' not found` };

    if (typeof level !== 'number' || level < 0 || level > 100) {
      return { success: false, error: `Invalid level '${level}'. Must be a number between 0 and 100` };
    }
    if (pumpStatus !== 'ON' && pumpStatus !== 'OFF') {
      return { success: false, error: `Invalid pumpStatus '${pumpStatus}'. Must be "ON" or "OFF"` };
    }

    tank.level     = level;
    tank.updatedAt = new Date().toISOString();

    if (tank.mode === 'AUTO') {
      applyAutoLogic(tank);
    } else {
      const prev = tank.pumpStatus;
      if (pumpStatus !== prev) {
        tank.pumpStatus = pumpStatus;
        logger.pump(tank.id, prev, pumpStatus, 'MANUAL:hardware-confirmation');
      }
    }

    pushHistory(id, tank);

    HistoryRepository.save({
      tankId:     tank.id,
      tankName:   tank.name,
      level:      tank.level,
      pumpStatus: tank.pumpStatus,
      mode:       tank.mode,
      source:     tank.source || 'HARDWARE',
    }).catch((err) => logger.error('Background DB save threw', err));

    return { success: true, tank: { ...tank } };
  },

  setPumpManual(id, pumpStatus) {
    const tank = tankStore.get(id);
    if (!tank) return { success: false, error: `Tank '${id}' not found` };

    if (pumpStatus !== 'ON' && pumpStatus !== 'OFF') {
      return { success: false, error: `Invalid pumpStatus '${pumpStatus}'. Must be "ON" or "OFF"` };
    }

    if (tank.mode !== 'MANUAL') {
      logger.warn(`Pump command BLOCKED for ${id} — tank is in AUTO mode`,
        { requestedStatus: pumpStatus, currentMode: tank.mode, currentLevel: tank.level });
      return {
        success: false,
        message: 'Pump control disabled in AUTO mode',
        error:   `Tank '${id}' is in AUTO mode. Switch to MANUAL before overriding pump.`,
      };
    }

    if (tank.pumpStatus !== pumpStatus) {
      const prev = tank.pumpStatus;
      tank.pumpStatus = pumpStatus;
      tank.updatedAt  = new Date().toISOString();
      logger.pump(tank.id, prev, pumpStatus, 'MANUAL:api-command');
    } else {
      logger.info(`Pump command for ${id} — no state change (already ${pumpStatus})`);
    }

    return { success: true, tank: { ...tank } };
  },

  setMode(id, mode) {
    const tank = tankStore.get(id);
    if (!tank) return { success: false, error: `Tank '${id}' not found` };

    if (mode !== 'AUTO' && mode !== 'MANUAL') {
      return { success: false, error: `Invalid mode '${mode}'. Must be "AUTO" or "MANUAL"` };
    }

    if (tank.mode === mode) {
      logger.info(`Mode for ${id} already ${mode} — no change needed`);
      return { success: true, tank: { ...tank } };
    }

    const now      = Date.now();
    const lastSwap = lastModeSwitchAt.get(id) || 0;
    const elapsed  = now - lastSwap;

    if (elapsed < MODE_SWITCH_COOLDOWN_MS) {
      const retryAfterMs = MODE_SWITCH_COOLDOWN_MS - elapsed;
      logger.warn(`Mode switch REJECTED for ${id} — cooldown active`,
        { requestedMode: mode, currentMode: tank.mode, retryAfterMs });
      return {
        success: false,
        error:   `Mode switch too frequent. Please wait ${retryAfterMs} ms before switching again.`,
        retryAfterMs,
      };
    }

    const prevMode = tank.mode;
    tank.mode      = mode;
    tank.updatedAt = new Date().toISOString();
    lastModeSwitchAt.set(id, now);

    logger.info(`Mode switched for tank ${id}`, {
      from: prevMode, to: mode, level: tank.level, pumpWas: tank.pumpStatus,
    });

    if (mode === 'AUTO') {
      applyAutoLogic(tank);
      logger.info(`AUTO logic applied immediately after mode switch for ${id}`, { pumpNow: tank.pumpStatus });
    }

    return { success: true, tank: { ...tank } };
  },

  getAnalytics(tankId) {
    const tank = tankStore.get(tankId);
    if (!tank) return null;

    const history      = historyStore.get(tankId) || [];
    const totalRecords = history.length;

    if (totalRecords === 0) {
      return {
        tankId,
        avgLevel: tank.level, minLevel: tank.level, maxLevel: tank.level,
        totalRecords: 0, trend: [],
        currentLevel: tank.level, currentPumpStatus: tank.pumpStatus, currentMode: tank.mode,
      };
    }

    let sum = 0, min = Infinity, max = -Infinity;

    for (let i = 0; i < totalRecords; i++) {
      const lvl = history[i].level;
      sum += lvl;
      if (lvl < min) min = lvl;
      if (lvl > max) max = lvl;
    }

    const avg   = Math.round((sum / totalRecords) * 10) / 10;
    const trend = history.slice(-5).map((r) => r.level);

    return {
      tankId,
      avgLevel: avg, minLevel: min, maxLevel: max,
      totalRecords, trend,
      currentLevel: tank.level, currentPumpStatus: tank.pumpStatus, currentMode: tank.mode,
    };
  },

  getSystemStats() {
    const tanks    = Array.from(tankStore.values());
    const pumpsOn  = tanks.filter((t) => t.pumpStatus === 'ON').length;
    const alerts   = tanks.filter((t) => t.level < AUTO_PUMP_ON_AT).length;
    const avgLevel = tanks.reduce((s, t) => s + t.level, 0) / tanks.length;

    return {
      totalTanks:    tanks.length,
      pumpsActive:   pumpsOn,
      activeAlerts:  alerts,
      avgWaterLevel: Math.round(avgLevel * 10) / 10,
      thresholds:    { pumpOnBelow: AUTO_PUMP_ON_AT, pumpOffAbove: AUTO_PUMP_OFF_AT },
    };
  },
};

module.exports = TankModel;
