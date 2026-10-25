import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PROFILE, parseRgbColor } from './protocol.js';

export function getDefaultStatePath() {
  const configRoot =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configRoot, 'n3-control-center', 'state.json');
}

export function cloneDefaultProfile() {
  return {
    dpiStages: [...DEFAULT_PROFILE.dpiStages],
    dpiStageCount: DEFAULT_PROFILE.dpiStageCount,
    activeDpiStage: DEFAULT_PROFILE.activeDpiStage,
    pollingRateHz: DEFAULT_PROFILE.pollingRateHz,
    debounceMs: DEFAULT_PROFILE.debounceMs,
    lod: DEFAULT_PROFILE.lod,
    sensor: { ...DEFAULT_PROFILE.sensor },
    rgb: {
      mode: DEFAULT_PROFILE.rgb.mode,
      color: [...DEFAULT_PROFILE.rgb.color],
      brightness: DEFAULT_PROFILE.rgb.brightness,
      speed: DEFAULT_PROFILE.rgb.speed,
    },
  };
}

export function normalizeProfile(raw = {}) {
  const base = cloneDefaultProfile();

  const dpiStages = Array.isArray(raw.dpiStages) && raw.dpiStages.length === 5
    ? raw.dpiStages.map((v) => Number(v))
    : base.dpiStages;

  const dpiStageCount = Number.isInteger(raw.dpiStageCount)
    ? raw.dpiStageCount
    : base.dpiStageCount;

  const activeDpiStage = Number.isInteger(raw.activeDpiStage)
    ? Math.min(dpiStageCount, Math.max(1, raw.activeDpiStage))
    : Math.min(dpiStageCount, base.activeDpiStage);

  let color = base.rgb.color;
  if (raw.rgb?.color !== undefined) {
    try {
      color = parseRgbColor(raw.rgb.color);
    } catch {
      color = base.rgb.color;
    }
  }

  return {
    dpiStages,
    dpiStageCount,
    activeDpiStage,
    pollingRateHz: Number.isInteger(raw.pollingRateHz)
      ? raw.pollingRateHz
      : base.pollingRateHz,
    debounceMs: Number.isInteger(raw.debounceMs)
      ? raw.debounceMs
      : base.debounceMs,
    lod: raw.lod === 'high' ? 'high' : 'low',
    sensor: {
      rippleControl:
        typeof raw.sensor?.rippleControl === 'boolean'
          ? raw.sensor.rippleControl
          : base.sensor.rippleControl,
      angleSnap:
        typeof raw.sensor?.angleSnap === 'boolean'
          ? raw.sensor.angleSnap
          : base.sensor.angleSnap,
      motionSync:
        typeof raw.sensor?.motionSync === 'boolean'
          ? raw.sensor.motionSync
          : base.sensor.motionSync,
    },
    rgb: {
      mode: typeof raw.rgb?.mode === 'string' ? raw.rgb.mode : base.rgb.mode,
      color,
      brightness: Number.isInteger(raw.rgb?.brightness)
        ? raw.rgb.brightness
        : base.rgb.brightness,
      speed: Number.isInteger(raw.rgb?.speed)
        ? raw.rgb.speed
        : base.rgb.speed,
    },
  };
}

export function loadSavedProfile(statePath = getDefaultStatePath()) {
  try {
    if (!fs.existsSync(statePath)) {
      return cloneDefaultProfile();
    }
    const content = fs.readFileSync(statePath, 'utf8');
    return normalizeProfile(JSON.parse(content));
  } catch {
    return cloneDefaultProfile();
  }
}

export function saveProfile(profile, statePath = getDefaultStatePath()) {
  const normalized = normalizeProfile(profile);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}
