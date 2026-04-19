"use strict";

const TankModel = require("../models/tankModel");
const HistoryRepository = require("../db/historyRepository");
const logger = require("../utils/logger");

function send(res, status, body) {
  res.status(status).json(body);
}

function ok(data, message = "OK") {
  return { success: true, message, data };
}

function fail(error, code) {
  return { success: false, error, code };
}

async function sendCircuitDigestSms({ templateId, mobiles, var1, var2 }) {
  const apiKey = process.env.CD_SMS_API_KEY || "";
  const baseUrl = (
    process.env.CD_SMS_BASE_URL || "https://www.circuitdigest.cloud"
  ).replace(/\/$/, "");

  if (!apiKey) {
    return { success: false, error: "Missing CD_SMS_API_KEY configuration" };
  }

  const url = `${baseUrl}/api/v1/send_sms?ID=${encodeURIComponent(templateId)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ mobiles, var1, var2 }),
  });

  let responseData = null;
  try {
    responseData = await res.json();
  } catch {
    responseData = null;
  }

  if (!res.ok) {
    return {
      success: false,
      status: res.status,
      error:
        responseData?.message ||
        responseData?.error ||
        `CircuitDigest request failed with status ${res.status}`,
      providerResponse: responseData,
    };
  }

  return { success: true, providerResponse: responseData };
}

const TankController = {
  getTank(req, res) {
    const { id } = req.query;
    logger.api("GET", "/api/tank", id ? { id } : { all: true });

    if (id) {
      const tank = TankModel.getTankById(id);
      if (!tank) return send(res, 404, fail(`Tank '${id}' not found`, 404));
      return send(res, 200, ok(tank, `Tank ${id} data`));
    }

    const tanks = TankModel.getAllTanks();
    return send(res, 200, ok(tanks, `${tanks.length} tank(s) returned`));
  },

  postSensorData(req, res) {
    logger.api("POST", "/api/tank", { body: req.body });

    const { id, level, pumpStatus } = req.body;

    if (!id) return send(res, 400, fail("Missing required field: id", 400));
    if (level === undefined || level === null)
      return send(res, 400, fail("Missing required field: level", 400));
    if (!pumpStatus)
      return send(res, 400, fail("Missing required field: pumpStatus", 400));

    const numLevel = Number(level);
    if (Number.isNaN(numLevel) || numLevel < 0 || numLevel > 100) {
      return send(
        res,
        422,
        fail(`Invalid 'level': ${level}. Must be a number in range 0–100`, 422),
      );
    }

    const pump = String(pumpStatus).toUpperCase();
    if (pump !== "ON" && pump !== "OFF") {
      return send(
        res,
        422,
        fail(
          `Invalid 'pumpStatus': ${pumpStatus}. Expected "ON" or "OFF"`,
          422,
        ),
      );
    }

    const result = TankModel.updateSensorData(id, numLevel, pump);

    if (!result.success) {
      logger.error("Sensor data update failed", { id, error: result.error });
      const status = result.error.includes("not found") ? 404 : 422;
      return send(res, status, fail(result.error, status));
    }

    logger.info(`Sensor data ingested for ${id}`, {
      level: numLevel,
      pumpStatus: result.tank.pumpStatus,
      mode: result.tank.mode,
    });
    return send(res, 200, ok(result.tank, `Data accepted for ${id}`));
  },

  setPump(req, res) {
    logger.api("POST", "/api/pump", { body: req.body });

    const { id, pumpStatus } = req.body;

    if (!id) return send(res, 400, fail("Missing required field: id", 400));
    if (!pumpStatus)
      return send(res, 400, fail("Missing required field: pumpStatus", 400));

    const pump = String(pumpStatus).toUpperCase();
    if (pump !== "ON" && pump !== "OFF") {
      return send(
        res,
        422,
        fail(
          `Invalid 'pumpStatus': ${pumpStatus}. Expected "ON" or "OFF"`,
          422,
        ),
      );
    }

    const result = TankModel.setPumpManual(id, pump);

    if (!result.success) {
      const isAutoBlock =
        result.message === "Pump control disabled in AUTO mode";
      if (isAutoBlock) {
        logger.warn(
          `[Controller] Pump override blocked for ${id} — AUTO mode active`,
        );
        return res.status(409).json({
          success: false,
          message: result.message,
          error: result.error,
          code: 409,
        });
      }
      logger.warn(`Manual pump command rejected for ${id}`, {
        error: result.error,
      });
      const status = result.error.includes("not found") ? 404 : 409;
      return send(res, status, fail(result.error, status));
    }

    logger.info(`Manual pump command accepted for ${id}`, { pumpStatus: pump });
    return send(res, 200, ok(result.tank, `Pump for ${id} set to ${pump}`));
  },

  setMode(req, res) {
    logger.api("POST", "/api/mode", { body: req.body });

    const { id, mode } = req.body;

    if (!id) return send(res, 400, fail("Missing required field: id", 400));
    if (!mode) return send(res, 400, fail("Missing required field: mode", 400));

    const modeUpper = String(mode).toUpperCase();
    if (modeUpper !== "AUTO" && modeUpper !== "MANUAL") {
      return send(
        res,
        422,
        fail(`Invalid 'mode': ${mode}. Expected "AUTO" or "MANUAL"`, 422),
      );
    }

    const result = TankModel.setMode(id, modeUpper);

    if (!result.success) {
      if (result.retryAfterMs !== undefined) {
        logger.warn(`Mode switch rate-limited for ${id}`, {
          retryAfterMs: result.retryAfterMs,
        });
        return res
          .status(429)
          .set("Retry-After", Math.ceil(result.retryAfterMs / 1000))
          .json({
            success: false,
            error: result.error,
            retryAfterMs: result.retryAfterMs,
            code: 429,
          });
      }
      logger.warn(`Mode change rejected for ${id}`, { error: result.error });
      const status = result.error.includes("not found") ? 404 : 422;
      return send(res, status, fail(result.error, status));
    }

    logger.info(`Mode changed for ${id}`, {
      mode: modeUpper,
      pumpNow: result.tank.pumpStatus,
    });
    return send(
      res,
      200,
      ok(result.tank, `Tank ${id} mode set to ${modeUpper}`),
    );
  },

  getHistory(req, res) {
    const { id } = req.query;
    logger.api("GET", "/api/history", id ? { id } : { scope: "global" });

    if (id) {
      const tank = TankModel.getTankById(id);
      if (!tank) return send(res, 404, fail(`Tank '${id}' not found`, 404));
    }

    const history = TankModel.getHistory(id || undefined);
    return res.status(200).json({
      success: true,
      message: `${history.length} history record(s) returned`,
      count: history.length,
      data: history,
    });
  },

  getAnalytics(req, res) {
    const { id } = req.query;
    logger.api("GET", "/api/analytics", { id: id || "missing" });

    if (!id) {
      return send(
        res,
        400,
        fail(
          "Missing required query param: id (e.g. /api/analytics?id=T-01)",
          400,
        ),
      );
    }

    const tank = TankModel.getTankById(id);
    if (!tank) return send(res, 404, fail(`Tank '${id}' not found`, 404));

    const analytics = TankModel.getAnalytics(id);

    logger.info(`Analytics computed for ${id}`, {
      avgLevel: analytics.avgLevel,
      minLevel: analytics.minLevel,
      maxLevel: analytics.maxLevel,
      totalRecords: analytics.totalRecords,
    });

    return send(res, 200, ok(analytics, `Analytics for tank ${id}`));
  },

  health(req, res) {
    logger.api("GET", "/health");

    const stats = TankModel.getSystemStats();
    const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptimeSec = Math.floor(process.uptime());

    return send(
      res,
      200,
      ok(
        {
          status: "OK",
          timestamp: new Date().toISOString(),
          uptime: `${uptimeSec}s`,
          memory: `${memMB} MB`,
          system: stats,
        },
        "System healthy",
      ),
    );
  },

  async getDbHistory(req, res) {
    const { id } = req.query;
    logger.api("GET", "/api/db/history", { id: id || "all" });

    const records = id
      ? await HistoryRepository.getLast10(id)
      : await HistoryRepository.getAll();

    return res.status(200).json({
      success: true,
      message: `${records.length} DB record(s) returned`,
      count: records.length,
      data: records,
    });
  },

  async sendHardwareAlert(req, res) {
    logger.api("POST", "/api/hardware/alert", { body: req.body });

    const {
      tankId,
      faultType,
      message,
      level,
      templateId,
      mobileNumber,
      var1,
      var2,
    } = req.body || {};

    if (!tankId) {
      return send(res, 400, fail("Missing required field: tankId", 400));
    }
    if (!faultType) {
      return send(res, 400, fail("Missing required field: faultType", 400));
    }

    const defaultTemplateId = process.env.CD_SMS_TEMPLATE_ID || "";
    const defaultMobile = process.env.CD_SMS_MOBILE || "";

    const selectedTemplateId = String(templateId || defaultTemplateId).trim();
    const selectedMobile = String(mobileNumber || defaultMobile).trim();

    if (!selectedTemplateId) {
      return send(
        res,
        500,
        fail(
          "Missing SMS template ID. Set CD_SMS_TEMPLATE_ID or send templateId in request body.",
          500,
        ),
      );
    }
    if (!selectedMobile) {
      return send(
        res,
        500,
        fail(
          "Missing SMS mobile number. Set CD_SMS_MOBILE or send mobileNumber in request body.",
          500,
        ),
      );
    }

    const smsVar1 = String(var1 || tankId);
    const smsVar2 = String(
      var2 ||
        message ||
        `${faultType}${level !== undefined ? ` @ ${level}%` : ""}`,
    );

    try {
      const smsResult = await sendCircuitDigestSms({
        templateId: selectedTemplateId,
        mobiles: selectedMobile,
        var1: smsVar1,
        var2: smsVar2,
      });

      if (!smsResult.success) {
        logger.error("CircuitDigest SMS send failed", {
          tankId,
          faultType,
          error: smsResult.error,
          status: smsResult.status,
          providerResponse: smsResult.providerResponse,
        });
        return res.status(502).json({
          success: false,
          error: smsResult.error,
          code: 502,
          providerStatus: smsResult.status,
          providerResponse: smsResult.providerResponse || null,
        });
      }

      logger.info("Hardware alert SMS sent", {
        tankId,
        faultType,
        mobile: selectedMobile,
        templateId: selectedTemplateId,
      });

      return send(
        res,
        200,
        ok(
          {
            tankId,
            faultType,
            mobile: selectedMobile,
            templateId: selectedTemplateId,
            providerResponse: smsResult.providerResponse || null,
          },
          "Hardware alert SMS sent successfully",
        ),
      );
    } catch (err) {
      logger.error("Unexpected error during hardware alert SMS", {
        error: String(err),
      });
      return send(
        res,
        500,
        fail("Unexpected error while sending SMS alert", 500),
      );
    }
  },
};

module.exports = TankController;
