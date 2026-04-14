"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    activate: () => activate,
    notifyPcbChanged: () => notifyPcbChanged,
    notifySelectionChanged: () => notifySelectionChanged,
    showStatus: () => showStatus,
    testCommand: () => testCommand,
    toggleBridge: () => toggleBridge
  });

  // extension.json
  var displayName = "JLC Bridge";
  var version = "0.1.15";
  var headerMenus = {
    pcb: [
      {
        id: "JLCBridge",
        title: "JLC Bridge",
        menuItems: [
          {
            id: "toggleBridge",
            title: "Enable/Disable Bridge",
            registerFn: "toggleBridge"
          },
          {
            id: "status",
            title: "Status",
            registerFn: "showStatus"
          },
          {
            id: "testCommand",
            title: "Test Command",
            registerFn: "testCommand"
          }
        ]
      }
    ],
    schematic: [
      {
        id: "JLCBridge",
        title: "JLC Bridge",
        menuItems: [
          {
            id: "toggleBridge",
            title: "Enable/Disable Bridge",
            registerFn: "toggleBridge"
          },
          {
            id: "status",
            title: "Status",
            registerFn: "showStatus"
          },
          {
            id: "testCommand",
            title: "Test Command",
            registerFn: "testCommand"
          }
        ]
      }
    ]
  };

  // src/index.ts
  var APP_NAME = String(displayName || "JLC Bridge");
  var APP_VERSION = String(version || "0.0.0");
  var BRIDGE_DIR = "/tmp/jlc-bridge";
  var COMMAND_FILE = `${BRIDGE_DIR}/command.json`;
  var RESULT_FILE = `${BRIDGE_DIR}/result.json`;
  var LOG_FILE = `${BRIDGE_DIR}/bridge.log`;
  var POLL_INTERVAL_MS = 500;
  var ENABLED_STORAGE_KEY = "jlcBridgeEnabled";
  var TIMER_ID = "jlc_bridge_poll_loop";
  var HTTP_BASE = "http://127.0.0.1:18800";
  var bridgeEnabled = false;
  var nativeIntervalHandle = null;
  var usingNativeTimer = false;
  var usingSysTimer = false;
  var lastCommandTime = 0;
  var pollInProgress = false;
  var WS_URL = "ws://127.0.0.1:18800/ws/bridge";
  var WS_RECONNECT_MS = 3e3;
  var wsConnection = null;
  var wsConnected = false;
  var wsReconnectHandle = null;
  function anyEda() {
    return eda;
  }
  function hasLegacyFileApi() {
    var _a;
    const fileApi = (_a = anyEda()) == null ? void 0 : _a.sys_File;
    return Boolean((fileApi == null ? void 0 : fileApi.readFile) && (fileApi == null ? void 0 : fileApi.writeFile));
  }
  function hasFileSystemApi() {
    var _a;
    const fsApi = (_a = anyEda()) == null ? void 0 : _a.sys_FileSystem;
    return Boolean((fsApi == null ? void 0 : fsApi.readFileFromFileSystem) && (fsApi == null ? void 0 : fsApi.saveFileToFileSystem));
  }
  async function readTextFile(filePath) {
    var _a, _b;
    try {
      const fileApi = (_a = anyEda()) == null ? void 0 : _a.sys_File;
      if (fileApi == null ? void 0 : fileApi.readFile) {
        const content = fileApi.readFile(filePath);
        if (typeof content === "string")
          return content;
        return void 0;
      }
    } catch (e) {
    }
    try {
      const fsApi = (_b = anyEda()) == null ? void 0 : _b.sys_FileSystem;
      if (!(fsApi == null ? void 0 : fsApi.readFileFromFileSystem))
        return void 0;
      const file = await fsApi.readFileFromFileSystem(filePath);
      if (!file)
        return void 0;
      if (typeof file.text !== "function")
        return void 0;
      return await file.text();
    } catch (e) {
      return void 0;
    }
  }
  async function writeTextFile(filePath, content) {
    var _a, _b;
    try {
      const fileApi = (_a = anyEda()) == null ? void 0 : _a.sys_File;
      if (fileApi == null ? void 0 : fileApi.writeFile) {
        fileApi.writeFile(filePath, content);
        return true;
      }
    } catch (e) {
    }
    try {
      const fsApi = (_b = anyEda()) == null ? void 0 : _b.sys_FileSystem;
      if (!(fsApi == null ? void 0 : fsApi.saveFileToFileSystem))
        return false;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const ok = await fsApi.saveFileToFileSystem(filePath, blob, void 0, true);
      return Boolean(ok);
    } catch (e) {
      return false;
    }
  }
  async function ensureBridgeDir() {
    var _a;
    try {
      const fileApi = (_a = anyEda()) == null ? void 0 : _a.sys_File;
      if (fileApi == null ? void 0 : fileApi.mkdir) {
        fileApi.mkdir(BRIDGE_DIR);
      }
    } catch (e) {
    }
  }
  function showInfo(content, title = APP_NAME) {
    var _a, _b, _c, _d;
    try {
      (_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_Dialog) == null ? void 0 : _b.showInformationMessage) == null ? void 0 : _c.call(_b, content, title);
      return;
    } catch (e) {
    }
    try {
      (_d = globalThis.alert) == null ? void 0 : _d.call(globalThis, `${title}
${content}`);
      return;
    } catch (e) {
    }
    console.log(`[${APP_NAME}] ${title}: ${content}`);
  }
  function showError(title, error) {
    const message = error instanceof Error ? error.message : String(error != null ? error : "unknown error");
    showInfo(`${title}
${message}`, APP_NAME);
    console.error(`[${APP_NAME}]`, title, error);
  }
  function appendLog(message) {
    void (async () => {
      await ensureBridgeDir();
      const line = `${(/* @__PURE__ */ new Date()).toISOString()} ${message}
`;
      const prev = await readTextFile(LOG_FILE) || "";
      await writeTextFile(LOG_FILE, prev + line);
    })();
  }
  function log(message) {
    console.log(`[${APP_NAME}] ${message}`);
    appendLog(message);
  }
  function readEnabledPref() {
    var _a, _b, _c;
    try {
      const raw = (_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_Storage) == null ? void 0 : _b.getExtensionUserConfig) == null ? void 0 : _c.call(_b, ENABLED_STORAGE_KEY);
      return raw === true || raw === "true" || raw === 1;
    } catch (e) {
      return false;
    }
  }
  async function saveEnabledPref(enabled) {
    var _a, _b, _c;
    try {
      await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_Storage) == null ? void 0 : _b.setExtensionUserConfig) == null ? void 0 : _c.call(_b, ENABLED_STORAGE_KEY, enabled));
    } catch (e) {
    }
  }
  function getTimerMode() {
    if (usingSysTimer)
      return "sys_Timer";
    if (usingNativeTimer)
      return "setInterval";
    return "none";
  }
  function getFileApiMode() {
    const modes = [];
    if (hasLegacyFileApi())
      modes.push("sys_File");
    if (hasFileSystemApi())
      modes.push("sys_FileSystem");
    return modes.length ? modes.join(" + ") : "none";
  }
  function readFirstStringValue(target, getterNames) {
    for (const getterName of getterNames) {
      try {
        const getter = target == null ? void 0 : target[getterName];
        if (typeof getter !== "function")
          continue;
        const raw = getter.call(target);
        if (typeof raw === "string") {
          const text = raw.trim();
          if (text)
            return text;
        } else if (raw !== void 0 && raw !== null) {
          const text = String(raw).trim();
          if (text)
            return text;
        }
      } catch (e) {
      }
    }
    return "";
  }
  function readFirstNumberValue(target, getterNames) {
    for (const getterName of getterNames) {
      try {
        const getter = target == null ? void 0 : target[getterName];
        if (typeof getter !== "function")
          continue;
        const value = Number(getter.call(target));
        if (Number.isFinite(value))
          return value;
      } catch (e) {
      }
    }
    return void 0;
  }
  function readFirstBooleanValue(target, getterNames) {
    for (const getterName of getterNames) {
      try {
        const getter = target == null ? void 0 : target[getterName];
        if (typeof getter !== "function")
          continue;
        return Boolean(getter.call(target));
      } catch (e) {
      }
    }
    return void 0;
  }
  function normalizeNetArray(raw) {
    if (!Array.isArray(raw))
      return [];
    const dedup = /* @__PURE__ */ new Set();
    for (const item of raw) {
      if (typeof item === "string") {
        const net = item.trim();
        if (net)
          dedup.add(net);
        continue;
      }
      if (item && typeof item === "object") {
        const netRaw = item.net;
        if (typeof netRaw === "string") {
          const net = netRaw.trim();
          if (net)
            dedup.add(net);
        }
      }
    }
    return Array.from(dedup);
  }
  function toFinite(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
  function normalizeAngle(angle) {
    let value = toFinite(angle, 0);
    while (value <= -180)
      value += 360;
    while (value > 180)
      value -= 360;
    return value;
  }
  function createBoxFromCenter(x, y, width, height) {
    const halfW = Math.max(0, toFinite(width, 0) / 2);
    const halfH = Math.max(0, toFinite(height, 0) / 2);
    return {
      minX: x - halfW,
      minY: y - halfH,
      maxX: x + halfW,
      maxY: y + halfH
    };
  }
  function isVerticalAngle(angle) {
    const a = Math.abs(normalizeAngle(angle));
    return Math.abs(a - 90) <= 20;
  }
  function estimateStringBox(x, y, text, fontSize, rotation) {
    const content = String(text || "");
    const size = Math.max(1, toFinite(fontSize, 10));
    const estimatedWidth = Math.max(size * Math.max(content.length, 1) * 0.6, size * 0.8);
    const estimatedHeight = Math.max(size, 1);
    const width = isVerticalAngle(rotation) ? estimatedHeight : estimatedWidth;
    const height = isVerticalAngle(rotation) ? estimatedWidth : estimatedHeight;
    return createBoxFromCenter(x, y, width, height);
  }
  function boxIntersects(a, b, tolerance = 0) {
    const t = Math.max(0, toFinite(tolerance, 0));
    if (a.maxX < b.minX - t)
      return false;
    if (a.minX > b.maxX + t)
      return false;
    if (a.maxY < b.minY - t)
      return false;
    if (a.minY > b.maxY + t)
      return false;
    return true;
  }
  function boxInside(inner, outer, margin = 0) {
    const m = Math.max(0, toFinite(margin, 0));
    return inner.minX >= outer.minX - m && inner.minY >= outer.minY - m && inner.maxX <= outer.maxX + m && inner.maxY <= outer.maxY + m;
  }
  async function getBBoxOfPrimitive(primitive) {
    var _a, _b, _c;
    try {
      const bbox = await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.pcb_Primitive) == null ? void 0 : _b.getPrimitivesBBox) == null ? void 0 : _c.call(_b, [primitive]));
      if (!bbox)
        return void 0;
      return {
        minX: toFinite(bbox.minX, NaN),
        minY: toFinite(bbox.minY, NaN),
        maxX: toFinite(bbox.maxX, NaN),
        maxY: toFinite(bbox.maxY, NaN)
      };
    } catch (e) {
      return void 0;
    }
  }
  function firstBox(boxes) {
    for (const box of boxes) {
      if (!box)
        continue;
      const ok = Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY);
      if (ok)
        return box;
    }
    return void 0;
  }
  function makeRectPolygonSource(x1, y1, x2, y2) {
    const minX = Math.min(toFinite(x1), toFinite(x2));
    const maxX = Math.max(toFinite(x1), toFinite(x2));
    const minY = Math.min(toFinite(y1), toFinite(y2));
    const maxY = Math.max(toFinite(y1), toFinite(y2));
    return [minX, minY, "L", maxX, minY, maxX, maxY, minX, maxY];
  }
  function makeRectPolygonSourceR(x1, y1, x2, y2) {
    const minX = Math.min(toFinite(x1), toFinite(x2));
    const maxX = Math.max(toFinite(x1), toFinite(x2));
    const minY = Math.min(toFinite(y1), toFinite(y2));
    const maxY = Math.max(toFinite(y1), toFinite(y2));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return ["R", minX, minY, width, height, 0, 0];
  }
  function waitMs(delay) {
    const ms = Number.isFinite(delay) && delay > 0 ? Math.floor(delay) : 0;
    if (!ms)
      return Promise.resolve();
    return new Promise((resolve) => {
      var _a;
      if (typeof setTimeout === "function") {
        setTimeout(() => resolve(), ms);
        return;
      }
      const timerApi = (_a = anyEda()) == null ? void 0 : _a.sys_Timer;
      if (!(timerApi == null ? void 0 : timerApi.setTimeoutTimer)) {
        resolve();
        return;
      }
      const timerId = `jlc_bridge_wait_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      timerApi.setTimeoutTimer(timerId, ms, () => {
        var _a2;
        try {
          resolve();
        } finally {
          try {
            (_a2 = timerApi.clearTimeoutTimer) == null ? void 0 : _a2.call(timerApi, timerId);
          } catch (e) {
          }
        }
      });
    });
  }
  function encodeBase64FromArrayBuffer(buffer) {
    const maybeBuffer = globalThis == null ? void 0 : globalThis.Buffer;
    if (maybeBuffer == null ? void 0 : maybeBuffer.from) {
      return maybeBuffer.from(buffer).toString("base64");
    }
    if (typeof btoa !== "function") {
      throw new Error("base64 encoding unavailable");
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 32768;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  async function blobToDataUrl(blob) {
    const mimeType = (blob == null ? void 0 : blob.type) || "image/png";
    const buffer = await blob.arrayBuffer();
    const base64 = encodeBase64FromArrayBuffer(buffer);
    return `data:${mimeType};base64,${base64}`;
  }
  function readTabIdFromDocumentInfo(info) {
    if (!info)
      return void 0;
    if (typeof (info == null ? void 0 : info.tabId) === "string" && info.tabId.trim()) {
      return info.tabId.trim();
    }
    if (typeof (info == null ? void 0 : info.getState_TabId) === "function") {
      try {
        const tabId = info.getState_TabId();
        if (typeof tabId === "string" && tabId.trim()) {
          return tabId.trim();
        }
      } catch (e) {
      }
    }
    return void 0;
  }
  async function resolveCaptureTabId() {
    var _a, _b, _c, _d, _e, _f, _g;
    const api = anyEda();
    try {
      const currentDoc = await ((_b = (_a = api == null ? void 0 : api.dmt_SelectControl) == null ? void 0 : _a.getCurrentDocumentInfo) == null ? void 0 : _b.call(_a));
      const tabId = readTabIdFromDocumentInfo(currentDoc);
      if (tabId)
        return tabId;
    } catch (e) {
    }
    try {
      const boardInfo = await ((_d = (_c = api == null ? void 0 : api.dmt_Board) == null ? void 0 : _c.getCurrentBoardInfo) == null ? void 0 : _d.call(_c));
      const pcbUuid = String(((_e = boardInfo == null ? void 0 : boardInfo.pcb) == null ? void 0 : _e.uuid) || "").trim();
      if (!pcbUuid)
        return void 0;
      try {
        const openedTabId = await ((_g = (_f = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _f.openDocument) == null ? void 0 : _g.call(_f, pcbUuid));
        if (typeof openedTabId === "string" && openedTabId.trim()) {
          return openedTabId.trim();
        }
      } catch (e) {
      }
      return pcbUuid;
    } catch (e) {
      return void 0;
    }
  }
  async function tryCaptureRenderedAreaImageDataUrl() {
    var _a, _b, _c;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _a.getCurrentRenderedAreaImage)) {
      return void 0;
    }
    const tabId = await resolveCaptureTabId();
    if (tabId && ((_b = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _b.activateDocument)) {
      try {
        await api.dmt_EditorControl.activateDocument(tabId);
      } catch (e) {
      }
    }
    if ((_c = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _c.zoomToAllPrimitives) {
      try {
        await api.dmt_EditorControl.zoomToAllPrimitives(tabId);
      } catch (e) {
      }
    }
    await waitMs(120);
    try {
      const blob = await api.dmt_EditorControl.getCurrentRenderedAreaImage(tabId);
      if (blob == null ? void 0 : blob.arrayBuffer) {
        return await blobToDataUrl(blob);
      }
    } catch (e) {
    }
    try {
      const fallbackBlob = await api.dmt_EditorControl.getCurrentRenderedAreaImage();
      if (fallbackBlob == null ? void 0 : fallbackBlob.arrayBuffer) {
        return await blobToDataUrl(fallbackBlob);
      }
    } catch (e) {
    }
    return void 0;
  }
  async function getBoardBoundingBox() {
    var _a, _b, _c, _d, _e, _f, _g;
    const api = anyEda();
    const layerCandidates = [(_a = api == null ? void 0 : api.EPCB_LayerId) == null ? void 0 : _a.BOARD_OUTLINE, 11].filter((item) => Number.isFinite(Number(item)));
    let merged;
    for (const layer of layerCandidates) {
      try {
        const lines = await ((_c = (_b = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _b.getAll) == null ? void 0 : _c.call(_b, void 0, Number(layer)));
        const arcs = await ((_e = (_d = api == null ? void 0 : api.pcb_PrimitiveArc) == null ? void 0 : _d.getAll) == null ? void 0 : _e.call(_d, void 0, Number(layer)));
        const polys = await ((_g = (_f = api == null ? void 0 : api.pcb_PrimitivePolyline) == null ? void 0 : _f.getAll) == null ? void 0 : _g.call(_f, void 0, Number(layer)));
        const rows = [...Array.isArray(lines) ? lines : [], ...Array.isArray(arcs) ? arcs : [], ...Array.isArray(polys) ? polys : []];
        for (const row of rows) {
          const box = await getBBoxOfPrimitive(row);
          if (!box)
            continue;
          if (!merged) {
            merged = { ...box };
            continue;
          }
          merged.minX = Math.min(merged.minX, box.minX);
          merged.minY = Math.min(merged.minY, box.minY);
          merged.maxX = Math.max(merged.maxX, box.maxX);
          merged.maxY = Math.max(merged.maxY, box.maxY);
        }
        if (merged)
          return merged;
      } catch (e) {
      }
    }
    try {
      const state = await getPCBState();
      if (state == null ? void 0 : state.boardBounds) {
        return {
          minX: toFinite(state.boardBounds.minX, 0),
          minY: toFinite(state.boardBounds.minY, 0),
          maxX: toFinite(state.boardBounds.maxX, 100),
          maxY: toFinite(state.boardBounds.maxY, 100)
        };
      }
    } catch (e) {
    }
    return void 0;
  }
  async function getSelectedPrimitiveIdSet() {
    var _a, _b, _c;
    const result = /* @__PURE__ */ new Set();
    try {
      const ids = await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.pcb_SelectControl) == null ? void 0 : _b.getAllSelectedPrimitives_PrimitiveId) == null ? void 0 : _c.call(_b));
      if (Array.isArray(ids)) {
        for (const id of ids) {
          if (typeof id === "string" && id.trim()) {
            result.add(id.trim());
          }
        }
      }
    } catch (e) {
    }
    return result;
  }
  async function collectSilkscreenRows() {
    var _a, _b;
    const api = anyEda();
    const dedup = /* @__PURE__ */ new Map();
    const stringApi = api == null ? void 0 : api.pcb_PrimitiveString;
    const tryPushRow = (row) => {
      const primitiveId = readFirstStringValue(row, ["getState_PrimitiveId"]);
      if (!primitiveId)
        return;
      dedup.set(primitiveId, row);
    };
    if (stringApi == null ? void 0 : stringApi.getAll) {
      for (const layer of [3, 4]) {
        try {
          const rows = await stringApi.getAll(layer);
          if (Array.isArray(rows)) {
            for (const row of rows) {
              tryPushRow(row);
            }
          }
        } catch (e) {
        }
      }
      if (dedup.size === 0) {
        try {
          const rows = await stringApi.getAll();
          if (Array.isArray(rows)) {
            for (const row of rows) {
              tryPushRow(row);
            }
          }
        } catch (e) {
        }
      }
    }
    if (dedup.size > 0) {
      return Array.from(dedup.values());
    }
    try {
      const rows = await ((_b = (_a = api == null ? void 0 : api.pcb_Document) == null ? void 0 : _a.getPrimitivesInRegion) == null ? void 0 : _b.call(_a, -1e6, 1e6, 1e6, -1e6, false));
      if (!Array.isArray(rows))
        return [];
      for (const row of rows) {
        const textGetter = row == null ? void 0 : row.getState_Text;
        if (typeof textGetter !== "function")
          continue;
        tryPushRow(row);
      }
    } catch (e) {
    }
    return Array.from(dedup.values());
  }
  async function buildSilkscreenItem(row, selectedSet) {
    const primitiveId = readFirstStringValue(row, ["getState_PrimitiveId"]);
    if (!primitiveId)
      return null;
    const text = readFirstStringValue(row, ["getState_Text", "getState_Content"]);
    const x = readFirstNumberValue(row, ["getState_X", "getState_CenterX"]);
    const y = readFirstNumberValue(row, ["getState_Y", "getState_CenterY"]);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return null;
    const rotation = toFinite(readFirstNumberValue(row, ["getState_Rotation"]), 0);
    const fontSize = toFinite(readFirstNumberValue(row, ["getState_FontSize"]), 10);
    const parentPrimitiveId = readFirstStringValue(row, ["getState_ParentPrimitiveId", "getState_BelongPrimitiveId"]);
    const layer = readFirstNumberValue(row, ["getState_Layer"]);
    const locked = Boolean(readFirstBooleanValue(row, ["getState_PrimitiveLock"]));
    const measuredBox = await getBBoxOfPrimitive(row);
    const estimatedBox = estimateStringBox(x, y, text, fontSize, rotation);
    const bbox = firstBox([measuredBox, estimatedBox]) || estimatedBox;
    return {
      primitiveId,
      text,
      x,
      y,
      rotation,
      fontSize,
      parentPrimitiveId: parentPrimitiveId || "",
      layer: Number.isFinite(layer) ? Number(layer) : void 0,
      locked,
      selected: selectedSet.has(primitiveId),
      bbox,
      width: bbox.maxX - bbox.minX,
      height: bbox.maxY - bbox.minY
    };
  }
  function buildObstacleBoxFromPrimitiveRow(row, diameterGetterNames) {
    const x = readFirstNumberValue(row, ["getState_X", "getState_CenterX"]);
    const y = readFirstNumberValue(row, ["getState_Y", "getState_CenterY"]);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return void 0;
    const diameter = readFirstNumberValue(row, diameterGetterNames);
    const size = Math.max(1, toFinite(diameter, 10));
    return createBoxFromCenter(x, y, size, size);
  }
  async function collectPadObstacleBoxes(limit = 1e4) {
    var _a, _b, _c;
    const rows = await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.pcb_PrimitivePad) == null ? void 0 : _b.getAll) == null ? void 0 : _c.call(_b));
    const result = [];
    if (!Array.isArray(rows))
      return result;
    for (const row of rows) {
      const primitiveId = readFirstStringValue(row, ["getState_PrimitiveId"]);
      if (!primitiveId)
        continue;
      const net = readFirstStringValue(row, ["getState_Net", "getState_NetName"]);
      const measuredBox = await getBBoxOfPrimitive(row);
      const estimatedBox = buildObstacleBoxFromPrimitiveRow(row, ["getState_Diameter", "getState_PadDiameter"]);
      const box = firstBox([measuredBox, estimatedBox]);
      if (!box)
        continue;
      result.push({ primitiveId, net, box });
      if (result.length >= limit)
        break;
    }
    return result;
  }
  async function collectViaObstacleBoxes(limit = 1e4) {
    var _a, _b, _c;
    const rows = await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.pcb_PrimitiveVia) == null ? void 0 : _b.getAll) == null ? void 0 : _c.call(_b));
    const result = [];
    if (!Array.isArray(rows))
      return result;
    for (const row of rows) {
      const primitiveId = readFirstStringValue(row, ["getState_PrimitiveId"]);
      if (!primitiveId)
        continue;
      const net = readFirstStringValue(row, ["getState_Net", "getState_NetName"]);
      const measuredBox = await getBBoxOfPrimitive(row);
      const estimatedBox = buildObstacleBoxFromPrimitiveRow(row, ["getState_Diameter"]);
      const box = firstBox([measuredBox, estimatedBox]);
      if (!box)
        continue;
      result.push({ primitiveId, net, box });
      if (result.length >= limit)
        break;
    }
    return result;
  }
  async function detectSilkscreenConflicts(silkscreens) {
    const padObstacles = await collectPadObstacleBoxes();
    const viaObstacles = await collectViaObstacleBoxes();
    const boardBox = await getBoardBoundingBox();
    const perSilk = /* @__PURE__ */ new Map();
    const byType = {};
    let totalConflicts = 0;
    const pushConflict = (silkId, conflict) => {
      if (!perSilk.has(silkId))
        perSilk.set(silkId, []);
      perSilk.get(silkId).push(conflict);
      const key = String(conflict.type || "unknown");
      byType[key] = (byType[key] || 0) + 1;
      totalConflicts += 1;
    };
    for (const silk of silkscreens) {
      const silkBox = silk == null ? void 0 : silk.bbox;
      const silkId = String((silk == null ? void 0 : silk.primitiveId) || "");
      if (!silkBox || !silkId)
        continue;
      if (boardBox && !boxInside(silkBox, boardBox, 0)) {
        pushConflict(silkId, {
          type: "out_of_board",
          targetId: "BOARD",
          description: "silkscreen out of board"
        });
      }
      for (const pad of padObstacles) {
        if (boxIntersects(silkBox, pad.box, 0.5)) {
          pushConflict(silkId, {
            type: "overlap_pad",
            targetId: pad.primitiveId,
            net: pad.net || "",
            description: "silkscreen overlaps pad"
          });
        }
      }
      for (const via of viaObstacles) {
        if (boxIntersects(silkBox, via.box, 0.5)) {
          pushConflict(silkId, {
            type: "overlap_via",
            targetId: via.primitiveId,
            net: via.net || "",
            description: "silkscreen overlaps via"
          });
        }
      }
    }
    for (let i = 0; i < silkscreens.length; i += 1) {
      const a = silkscreens[i];
      const boxA = a == null ? void 0 : a.bbox;
      const idA = String((a == null ? void 0 : a.primitiveId) || "");
      if (!boxA || !idA)
        continue;
      for (let j = i + 1; j < silkscreens.length; j += 1) {
        const b = silkscreens[j];
        const boxB = b == null ? void 0 : b.bbox;
        const idB = String((b == null ? void 0 : b.primitiveId) || "");
        if (!boxB || !idB)
          continue;
        if (!boxIntersects(boxA, boxB, 0.5))
          continue;
        pushConflict(idA, {
          type: "overlap_silkscreen",
          targetId: idB,
          description: "silkscreen overlaps silkscreen"
        });
        pushConflict(idB, {
          type: "overlap_silkscreen",
          targetId: idA,
          description: "silkscreen overlaps silkscreen"
        });
      }
    }
    return {
      perSilk,
      stats: {
        totalConflicts,
        byType
      },
      boardBox: boardBox || void 0
    };
  }
  async function getSilkscreens(params) {
    const rows = await collectSilkscreenRows();
    const selectedSet = await getSelectedPrimitiveIdSet();
    const limitRaw = toFinite(params == null ? void 0 : params.limit, 2e4);
    const limit = Math.max(1, Math.floor(limitRaw));
    const silkscreens = [];
    for (const row of rows) {
      const item = await buildSilkscreenItem(row, selectedSet);
      if (!item)
        continue;
      silkscreens.push(item);
      if (silkscreens.length >= limit)
        break;
    }
    const includeConflicts = Boolean((params == null ? void 0 : params.includeConflicts) || (params == null ? void 0 : params.onlyConflicted));
    if (!includeConflicts) {
      return {
        totalSilkscreens: silkscreens.length,
        returnedSilkscreens: silkscreens.length,
        silkscreens
      };
    }
    const conflictResult = await detectSilkscreenConflicts(silkscreens);
    const onlyConflicted = Boolean(params == null ? void 0 : params.onlyConflicted);
    const output = [];
    for (const item of silkscreens) {
      const conflicts = conflictResult.perSilk.get(item.primitiveId) || [];
      const next = {
        ...item,
        hasConflict: conflicts.length > 0,
        conflicts,
        conflictCount: conflicts.length
      };
      if (!onlyConflicted || next.hasConflict) {
        output.push(next);
      }
    }
    return {
      totalSilkscreens: silkscreens.length,
      returnedSilkscreens: output.length,
      conflictSummary: conflictResult.stats,
      boardBox: conflictResult.boardBox || null,
      silkscreens: output
    };
  }
  async function moveSilkscreen(params) {
    var _a;
    const api = anyEda();
    if (!(params == null ? void 0 : params.primitiveId))
      throw new Error("primitiveId is required");
    if (!Number.isFinite(Number(params == null ? void 0 : params.x)) || !Number.isFinite(Number(params == null ? void 0 : params.y))) {
      throw new Error("x/y must be numbers");
    }
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveString) == null ? void 0 : _a.modify)) {
      throw new Error("current EDA does not support silkscreen modify");
    }
    const property = {
      x: Number(params.x),
      y: Number(params.y)
    };
    if (params.rotation !== void 0) {
      property.rotation = Number(params.rotation);
    }
    await api.pcb_PrimitiveString.modify(String(params.primitiveId), property);
    return {
      primitiveId: String(params.primitiveId),
      x: Number(params.x),
      y: Number(params.y),
      rotation: params.rotation !== void 0 ? Number(params.rotation) : void 0
    };
  }
  function makeTranslatedSilkBox(item, x, y, rotation) {
    const w = Math.max(1, toFinite(item == null ? void 0 : item.width, 10));
    const h = Math.max(1, toFinite(item == null ? void 0 : item.height, 10));
    const vertical = isVerticalAngle(rotation);
    return createBoxFromCenter(x, y, vertical ? h : w, vertical ? w : h);
  }
  async function autoSilkscreen(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveString) == null ? void 0 : _a.modify)) {
      throw new Error("current EDA does not support silkscreen modify");
    }
    const maxMoves = Math.max(1, Math.floor(toFinite(params == null ? void 0 : params.maxMoves, 80)));
    const step = Math.max(2, toFinite(params == null ? void 0 : params.step, 12));
    const maxRadius = Math.max(step, toFinite(params == null ? void 0 : params.maxRadius, 96));
    const angleCandidatesBase = Array.isArray(params == null ? void 0 : params.tryAngles) && (params == null ? void 0 : params.tryAngles.length) > 0 ? params.tryAngles.map((a) => toFinite(a, 0)) : [0, 90, 180, -90];
    const silkResult = await getSilkscreens({ includeConflicts: true, onlyConflicted: Boolean(params == null ? void 0 : params.onlyConflicted) });
    const items = Array.isArray(silkResult == null ? void 0 : silkResult.silkscreens) ? silkResult.silkscreens : [];
    if (items.length === 0) {
      return {
        total: 0,
        moved: 0,
        improved: 0,
        skipped: 0,
        details: []
      };
    }
    const padObstacles = await collectPadObstacleBoxes();
    const viaObstacles = await collectViaObstacleBoxes();
    const boardBox = await getBoardBoundingBox() || void 0;
    const fixedBoxes = /* @__PURE__ */ new Map();
    for (const item of items) {
      if ((item == null ? void 0 : item.primitiveId) && (item == null ? void 0 : item.bbox)) {
        fixedBoxes.set(String(item.primitiveId), item.bbox);
      }
    }
    const evaluateScore = (selfId, candidateBox) => {
      let score = 0;
      for (const pad of padObstacles) {
        if (boxIntersects(candidateBox, pad.box, 0.5))
          score += 20;
      }
      for (const via of viaObstacles) {
        if (boxIntersects(candidateBox, via.box, 0.5))
          score += 18;
      }
      for (const [otherId, otherBox] of fixedBoxes.entries()) {
        if (otherId === selfId)
          continue;
        if (boxIntersects(candidateBox, otherBox, 0.5))
          score += 12;
      }
      if (boardBox && !boxInside(candidateBox, boardBox, 0)) {
        score += 50;
      }
      return score;
    };
    const sortItems = [...items].sort((a, b) => Number((b == null ? void 0 : b.conflictCount) || 0) - Number((a == null ? void 0 : a.conflictCount) || 0));
    const details = [];
    let moved = 0;
    let improved = 0;
    let skipped = 0;
    for (const item of sortItems) {
      if (moved >= maxMoves)
        break;
      const primitiveId = String((item == null ? void 0 : item.primitiveId) || "");
      if (!primitiveId || (item == null ? void 0 : item.locked)) {
        skipped += 1;
        continue;
      }
      const originalX = toFinite(item.x, 0);
      const originalY = toFinite(item.y, 0);
      const originalRot = toFinite(item.rotation, 0);
      const originalBox = makeTranslatedSilkBox(item, originalX, originalY, originalRot);
      const originalScore = evaluateScore(primitiveId, originalBox);
      let best = {
        x: originalX,
        y: originalY,
        rotation: originalRot,
        score: originalScore,
        distance: 0
      };
      const directionCandidates = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
        [0, 0]
      ];
      const tryAngles = Array.from(/* @__PURE__ */ new Set([originalRot, ...angleCandidatesBase]));
      for (let radius = 0; radius <= maxRadius; radius += step) {
        for (const [dx, dy] of directionCandidates) {
          const x = round3(originalX + dx * radius);
          const y = round3(originalY + dy * radius);
          for (const rotation of tryAngles) {
            const box = makeTranslatedSilkBox(item, x, y, rotation);
            const score = evaluateScore(primitiveId, box);
            const distance = Math.hypot(x - originalX, y - originalY);
            if (score < best.score || score === best.score && distance < best.distance) {
              best = { x, y, rotation, score, distance };
            }
            if (best.score === 0 && best.distance <= step) {
              break;
            }
          }
        }
      }
      if (best.score < originalScore) {
        await api.pcb_PrimitiveString.modify(primitiveId, {
          x: best.x,
          y: best.y,
          rotation: best.rotation
        });
        moved += 1;
        improved += 1;
        const finalBox = makeTranslatedSilkBox(item, best.x, best.y, best.rotation);
        fixedBoxes.set(primitiveId, finalBox);
        details.push({
          primitiveId,
          from: { x: originalX, y: originalY, rotation: originalRot, score: originalScore },
          to: { x: best.x, y: best.y, rotation: best.rotation, score: best.score }
        });
      } else {
        skipped += 1;
        details.push({
          primitiveId,
          from: { x: originalX, y: originalY, rotation: originalRot, score: originalScore },
          skipped: true
        });
      }
    }
    return {
      total: sortItems.length,
      moved,
      improved,
      skipped,
      details
    };
  }
  async function getPCBState() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
    const api = anyEda();
    const components = [];
    if ((_a = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _a.getAll) {
      const rows = await api.pcb_PrimitiveComponent.getAll();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const primitiveId = ((_b = row == null ? void 0 : row.getState_PrimitiveId) == null ? void 0 : _b.call(row)) || "";
          const designator = ((_c = row == null ? void 0 : row.getState_Designator) == null ? void 0 : _c.call(row)) || "";
          if (!primitiveId || !designator)
            continue;
          components.push({
            primitiveId,
            designator,
            name: ((_d = row == null ? void 0 : row.getState_Name) == null ? void 0 : _d.call(row)) || "",
            x: Number((_f = (_e = row == null ? void 0 : row.getState_X) == null ? void 0 : _e.call(row)) != null ? _f : 0),
            y: Number((_h = (_g = row == null ? void 0 : row.getState_Y) == null ? void 0 : _g.call(row)) != null ? _h : 0),
            rotation: Number((_j = (_i = row == null ? void 0 : row.getState_Rotation) == null ? void 0 : _i.call(row)) != null ? _j : 0),
            width: Number((_l = (_k = row == null ? void 0 : row.getState_Width) == null ? void 0 : _k.call(row)) != null ? _l : 0),
            height: Number((_n = (_m = row == null ? void 0 : row.getState_Height) == null ? void 0 : _m.call(row)) != null ? _n : 0),
            layer: String((_p = (_o = row == null ? void 0 : row.getState_Layer) == null ? void 0 : _o.call(row)) != null ? _p : ""),
            locked: Boolean((_q = row == null ? void 0 : row.getState_PrimitiveLock) == null ? void 0 : _q.call(row)),
            padNets: normalizeNetArray((_r = row == null ? void 0 : row.getState_Pads) == null ? void 0 : _r.call(row))
          });
        }
      }
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const c of components) {
      minX = Math.min(minX, c.x - c.width / 2);
      minY = Math.min(minY, c.y - c.height / 2);
      maxX = Math.max(maxX, c.x + c.width / 2);
      maxY = Math.max(maxY, c.y + c.height / 2);
    }
    const nets = [];
    if ((_s = api == null ? void 0 : api.pcb_Net) == null ? void 0 : _s.getAllNetsName) {
      const names = await api.pcb_Net.getAllNetsName();
      if (Array.isArray(names)) {
        for (const name of names) {
          if (typeof name === "string" && name.trim()) {
            const netName = name.trim();
            let length;
            try {
              length = await api.pcb_Net.getNetLength(netName);
            } catch (e) {
            }
            nets.push({ name: netName, length });
          }
        }
      }
    }
    return {
      components,
      nets,
      boardBounds: {
        minX: minX === Number.POSITIVE_INFINITY ? 0 : minX,
        minY: minY === Number.POSITIVE_INFINITY ? 0 : minY,
        maxX: maxX === Number.NEGATIVE_INFINITY ? 100 : maxX,
        maxY: maxY === Number.NEGATIVE_INFINITY ? 100 : maxY
      },
      layerCount: 2
    };
  }
  async function getPads(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitivePad) == null ? void 0 : _a.getAll)) {
      throw new Error("current EDA does not support pad query");
    }
    const rows = await api.pcb_PrimitivePad.getAll();
    const limitRaw = Number(params == null ? void 0 : params.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 1e4;
    const includeBBox = Boolean(params == null ? void 0 : params.includeBBox);
    const netsInput = Array.isArray(params == null ? void 0 : params.nets) ? params == null ? void 0 : params.nets : typeof (params == null ? void 0 : params.nets) === "string" ? params.nets.split(",").map((item) => item.trim()).filter(Boolean) : [];
    const netFilter = new Set(netsInput.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean));
    const pads = [];
    for (const row of rows || []) {
      const primitiveId = readFirstStringValue(row, ["getState_PrimitiveId"]);
      if (!primitiveId)
        continue;
      const net = readFirstStringValue(row, ["getState_Net", "getState_NetName"]);
      if (netFilter.size > 0) {
        if (!net || !netFilter.has(net.toUpperCase())) {
          continue;
        }
      }
      const x = readFirstNumberValue(row, ["getState_X", "getState_CenterX", "getState_PosX"]);
      const y = readFirstNumberValue(row, ["getState_Y", "getState_CenterY", "getState_PosY"]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        continue;
      }
      const layerRaw = readFirstNumberValue(row, ["getState_Layer"]);
      const layer = Number.isFinite(layerRaw) ? Number(layerRaw) : void 0;
      const pad = {
        primitiveId,
        net: net || "",
        x,
        y,
        layer: layer !== void 0 ? layer : String(readFirstStringValue(row, ["getState_Layer"]) || ""),
        parentPrimitiveId: readFirstStringValue(row, [
          "getState_ParentPrimitiveId",
          "getState_BelongPrimitiveId",
          "getState_ComponentPrimitiveId"
        ]),
        designator: readFirstStringValue(row, ["getState_Designator"]),
        locked: Boolean(readFirstBooleanValue(row, ["getState_PrimitiveLock"])),
        holeDiameter: readFirstNumberValue(row, ["getState_HoleDiameter", "getState_DrillDiameter"]),
        diameter: readFirstNumberValue(row, ["getState_Diameter", "getState_PadDiameter"]),
        shape: readFirstStringValue(row, ["getState_Shape", "getState_PadShape"])
      };
      if (includeBBox) {
        try {
          const bbox = await api.pcb_Primitive.getPrimitivesBBox([row]);
          if (bbox) {
            pad.bbox = {
              minX: bbox.minX,
              minY: bbox.minY,
              maxX: bbox.maxX,
              maxY: bbox.maxY
            };
          }
        } catch (e) {
        }
      }
      pads.push(pad);
      if (pads.length >= limit)
        break;
    }
    const netStats = /* @__PURE__ */ new Map();
    for (const item of pads) {
      const key = String(item.net || "").trim();
      if (!key)
        continue;
      netStats.set(key, (netStats.get(key) || 0) + 1);
    }
    const nets = Array.from(netStats.entries()).map(([name, padCount]) => ({ name, padCount })).sort((a, b) => b.padCount - a.padCount);
    return {
      totalPads: Array.isArray(rows) ? rows.length : 0,
      returnedPads: pads.length,
      nets,
      pads
    };
  }
  async function moveComponent(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _a.getAll) || !((_b = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _b.modify)) {
      throw new Error("current EDA does not support component modify");
    }
    const rows = await api.pcb_PrimitiveComponent.getAll();
    let targetId = null;
    let targetRow = null;
    for (const row of rows) {
      const designator = ((_c = row == null ? void 0 : row.getState_Designator) == null ? void 0 : _c.call(row)) || "";
      if (designator === params.designator) {
        targetId = ((_d = row == null ? void 0 : row.getState_PrimitiveId) == null ? void 0 : _d.call(row)) || null;
        targetRow = row;
        break;
      }
    }
    if (!targetId)
      throw new Error(`component not found: ${params.designator}`);
    if ((_e = targetRow == null ? void 0 : targetRow.getState_PrimitiveLock) == null ? void 0 : _e.call(targetRow)) {
      throw new Error(`component locked: ${params.designator}`);
    }
    await api.pcb_PrimitiveComponent.modify(targetId, {
      x: params.x,
      y: params.y,
      rotation: (_h = (_g = params.rotation) != null ? _g : (_f = targetRow == null ? void 0 : targetRow.getState_Rotation) == null ? void 0 : _f.call(targetRow)) != null ? _h : 0
    });
    return {
      moved: params.designator,
      x: params.x,
      y: params.y,
      rotation: (_k = (_j = params.rotation) != null ? _j : (_i = targetRow == null ? void 0 : targetRow.getState_Rotation) == null ? void 0 : _i.call(targetRow)) != null ? _k : 0
    };
  }
  function parsePrimitiveIds(params) {
    if (Array.isArray(params == null ? void 0 : params.primitiveIds)) {
      const ids = params.primitiveIds.map((item) => String(item || "").trim()).filter(Boolean);
      if (ids.length === 0) {
        throw new Error("primitiveIds must not be empty");
      }
      return ids;
    }
    if ((params == null ? void 0 : params.primitiveId) !== void 0) {
      const id = String(params.primitiveId || "").trim();
      if (!id)
        throw new Error("primitiveId must not be empty");
      return id;
    }
    if ((params == null ? void 0 : params.id) !== void 0) {
      const id = String(params.id || "").trim();
      if (!id)
        throw new Error("id must not be empty");
      return id;
    }
    throw new Error("primitiveId or primitiveIds is required");
  }
  function getRectParams(params) {
    const x1 = toFinite(params == null ? void 0 : params.x1, NaN);
    const y1 = toFinite(params == null ? void 0 : params.y1, NaN);
    const x2 = toFinite(params == null ? void 0 : params.x2, NaN);
    const y2 = toFinite(params == null ? void 0 : params.y2, NaN);
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
      throw new Error("x1/y1/x2/y2 are required");
    }
    return { x1, y1, x2, y2 };
  }
  function getPrimitiveId(primitive) {
    var _a;
    try {
      const id = (_a = primitive == null ? void 0 : primitive.getState_PrimitiveId) == null ? void 0 : _a.call(primitive);
      if (typeof id === "string" && id.trim())
        return id.trim();
    } catch (e) {
    }
    return "";
  }
  function buildRectPolygonCandidates(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const api = anyEda();
    const sourceLine = makeRectPolygonSource(params.x1, params.y1, params.x2, params.y2);
    const sourceRect = makeRectPolygonSourceR(params.x1, params.y1, params.x2, params.y2);
    const list = [];
    const add = (item) => {
      if (!item)
        return;
      list.push(item);
    };
    add((_b = (_a = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _a.createPolygon) == null ? void 0 : _b.call(_a, sourceLine));
    add((_d = (_c = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _c.createPolygon) == null ? void 0 : _d.call(_c, sourceRect));
    add((_f = (_e = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _e.createComplexPolygon) == null ? void 0 : _f.call(_e, sourceLine));
    add((_h = (_g = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _g.createComplexPolygon) == null ? void 0 : _h.call(_g, sourceRect));
    add(sourceLine);
    add(sourceRect);
    return list;
  }
  async function createVia(params) {
    var _a, _b;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveVia) == null ? void 0 : _a.create)) {
      throw new Error("current EDA does not support via create");
    }
    const net = String((params == null ? void 0 : params.net) || "").trim();
    if (!net)
      throw new Error("net is required");
    const x = toFinite(params == null ? void 0 : params.x, NaN);
    const y = toFinite(params == null ? void 0 : params.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw new Error("x/y are required");
    const holeDiameter = Math.max(1, toFinite((_b = params == null ? void 0 : params.holeDiameter) != null ? _b : params == null ? void 0 : params.drill, 10));
    const diameter = Math.max(holeDiameter + 1, toFinite(params == null ? void 0 : params.diameter, 22));
    const viaType = Number.isFinite(Number(params == null ? void 0 : params.viaType)) ? Number(params.viaType) : void 0;
    const primitiveLock = (params == null ? void 0 : params.primitiveLock) !== void 0 ? Boolean(params.primitiveLock) : false;
    const via = await api.pcb_PrimitiveVia.create(net, x, y, holeDiameter, diameter, viaType, void 0, void 0, primitiveLock);
    return {
      primitiveId: getPrimitiveId(via),
      net,
      x,
      y,
      holeDiameter,
      diameter,
      viaType: viaType != null ? viaType : null
    };
  }
  async function deleteVia(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveVia) == null ? void 0 : _a.delete)) {
      throw new Error("current EDA does not support via delete");
    }
    const primitiveIds = parsePrimitiveIds(params);
    const ok = await api.pcb_PrimitiveVia.delete(primitiveIds);
    return {
      deleted: Boolean(ok),
      primitiveIds: Array.isArray(primitiveIds) ? primitiveIds : [primitiveIds]
    };
  }
  async function createKeepoutRect(params) {
    var _a, _b;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveRegion) == null ? void 0 : _a.create) || !((_b = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _b.createPolygon)) {
      throw new Error("current EDA does not support region create");
    }
    const rect = getRectParams(params);
    const requestedLayer = Number.isFinite(Number(params == null ? void 0 : params.layer)) ? Number(params.layer) : 12;
    const ruleTypes = Array.isArray(params == null ? void 0 : params.ruleTypes) && params.ruleTypes.length > 0 ? params.ruleTypes.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [2, 3, 5, 6, 7];
    const regionName = String((params == null ? void 0 : params.regionName) || `KEEP_OUT_${Date.now()}`);
    const lineWidth = Math.max(0, toFinite(params == null ? void 0 : params.lineWidth, 4));
    const primitiveLock = (params == null ? void 0 : params.primitiveLock) !== void 0 ? Boolean(params.primitiveLock) : false;
    const layerCandidates = Array.from(new Set([requestedLayer, 12, 1, 2].filter((item) => Number.isFinite(item))));
    const polygonCandidates = buildRectPolygonCandidates(rect);
    const ruleTypeCandidates = [];
    if (ruleTypes.length > 0)
      ruleTypeCandidates.push(ruleTypes);
    ruleTypeCandidates.push([5], [2, 3, 5, 6, 7], void 0);
    const nameCandidates = [regionName, void 0];
    const lineWidthCandidates = [lineWidth, void 0];
    let region = void 0;
    let usedLayer = requestedLayer;
    let usedRuleTypes = ruleTypes;
    let usedName = regionName;
    let usedLineWidth = lineWidth;
    let lastError = null;
    outer:
      for (const layer of layerCandidates) {
        for (const polygon of polygonCandidates) {
          for (const rt of ruleTypeCandidates) {
            for (const rn of nameCandidates) {
              for (const lw of lineWidthCandidates) {
                try {
                  region = await api.pcb_PrimitiveRegion.create(layer, polygon, rt, rn, lw, primitiveLock);
                  if (region) {
                    usedLayer = layer;
                    usedRuleTypes = rt;
                    usedName = rn;
                    usedLineWidth = lw;
                    break outer;
                  }
                } catch (error) {
                  lastError = error;
                }
              }
            }
          }
        }
      }
    if (!region) {
      if (lastError)
        throw lastError;
      throw new Error("failed to create keepout region");
    }
    return {
      primitiveId: getPrimitiveId(region),
      layer: usedLayer,
      ruleTypes: Array.isArray(usedRuleTypes) ? usedRuleTypes : [],
      regionName: usedName || "",
      lineWidth: Number.isFinite(Number(usedLineWidth)) ? Number(usedLineWidth) : null,
      rect
    };
  }
  async function deleteRegion(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveRegion) == null ? void 0 : _a.delete)) {
      throw new Error("current EDA does not support region delete");
    }
    const primitiveIds = parsePrimitiveIds(params);
    const ok = await api.pcb_PrimitiveRegion.delete(primitiveIds);
    return {
      deleted: Boolean(ok),
      primitiveIds: Array.isArray(primitiveIds) ? primitiveIds : [primitiveIds]
    };
  }
  async function createPourRect(params) {
    var _a, _b;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitivePour) == null ? void 0 : _a.create) || !((_b = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _b.createPolygon)) {
      throw new Error("current EDA does not support pour create");
    }
    const net = String((params == null ? void 0 : params.net) || "").trim();
    if (!net)
      throw new Error("net is required");
    const rect = getRectParams(params);
    const requestedLayer = Number.isFinite(Number(params == null ? void 0 : params.layer)) ? Number(params.layer) : 1;
    const fillMethod = String((params == null ? void 0 : params.fillMethod) || "solid").trim().toLowerCase();
    const preserveSilos = (params == null ? void 0 : params.preserveSilos) !== void 0 ? Boolean(params.preserveSilos) : false;
    const pourName = String((params == null ? void 0 : params.pourName) || `POUR_${net}_${Date.now()}`);
    const pourPriority = Math.max(1, Math.floor(toFinite(params == null ? void 0 : params.pourPriority, 1)));
    const lineWidth = Math.max(0, toFinite(params == null ? void 0 : params.lineWidth, 8));
    const primitiveLock = (params == null ? void 0 : params.primitiveLock) !== void 0 ? Boolean(params.primitiveLock) : false;
    const layerCandidates = Array.from(new Set([requestedLayer, 1, 2].filter((item) => Number.isFinite(item))));
    const polygonCandidates = buildRectPolygonCandidates(rect);
    const fillMethodCandidates = Array.from(/* @__PURE__ */ new Set([fillMethod, "solid", void 0]));
    const preserveCandidates = Array.from(/* @__PURE__ */ new Set([preserveSilos, false, true]));
    const nameCandidates = [pourName, void 0];
    const priorityCandidates = [pourPriority, void 0];
    const lineWidthCandidates = [lineWidth, void 0];
    let pour = void 0;
    let usedLayer = requestedLayer;
    let usedFillMethod = fillMethod;
    let usedPreserveSilos = preserveSilos;
    let usedName = pourName;
    let usedPriority = pourPriority;
    let usedLineWidth = lineWidth;
    let lastError = null;
    outer:
      for (const layer of layerCandidates) {
        for (const polygon of polygonCandidates) {
          for (const fm of fillMethodCandidates) {
            for (const ps of preserveCandidates) {
              for (const pn of nameCandidates) {
                for (const pp of priorityCandidates) {
                  for (const lw of lineWidthCandidates) {
                    try {
                      pour = await api.pcb_PrimitivePour.create(
                        net,
                        layer,
                        polygon,
                        fm,
                        ps,
                        pn,
                        pp,
                        lw,
                        primitiveLock
                      );
                      if (pour) {
                        usedLayer = layer;
                        usedFillMethod = fm;
                        usedPreserveSilos = ps;
                        usedName = pn;
                        usedPriority = pp;
                        usedLineWidth = lw;
                        break outer;
                      }
                    } catch (error) {
                      lastError = error;
                    }
                  }
                }
              }
            }
          }
        }
      }
    if (!pour) {
      if (lastError)
        throw lastError;
      throw new Error("failed to create pour");
    }
    return {
      primitiveId: getPrimitiveId(pour),
      net,
      layer: usedLayer,
      fillMethod: usedFillMethod || "",
      preserveSilos: Boolean(usedPreserveSilos),
      pourName: usedName || "",
      pourPriority: Number.isFinite(Number(usedPriority)) ? Number(usedPriority) : null,
      lineWidth: Number.isFinite(Number(usedLineWidth)) ? Number(usedLineWidth) : null,
      rect
    };
  }
  async function deletePour(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitivePour) == null ? void 0 : _a.delete)) {
      throw new Error("current EDA does not support pour delete");
    }
    const primitiveIds = parsePrimitiveIds(params);
    const ok = await api.pcb_PrimitivePour.delete(primitiveIds);
    return {
      deleted: Boolean(ok),
      primitiveIds: Array.isArray(primitiveIds) ? primitiveIds : [primitiveIds]
    };
  }
  async function createDifferentialPair(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.createDifferentialPair)) {
      throw new Error("current EDA does not support differential pair");
    }
    const name = String((params == null ? void 0 : params.name) || "").trim();
    const positiveNet = String((params == null ? void 0 : params.positiveNet) || "").trim();
    const negativeNet = String((params == null ? void 0 : params.negativeNet) || "").trim();
    if (!name || !positiveNet || !negativeNet) {
      throw new Error("name/positiveNet/negativeNet are required");
    }
    const ok = await api.pcb_Drc.createDifferentialPair(name, positiveNet, negativeNet);
    return { created: Boolean(ok), name, positiveNet, negativeNet };
  }
  async function deleteDifferentialPair(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.deleteDifferentialPair)) {
      throw new Error("current EDA does not support differential pair");
    }
    const name = String((params == null ? void 0 : params.name) || "").trim();
    if (!name)
      throw new Error("name is required");
    const ok = await api.pcb_Drc.deleteDifferentialPair(name);
    return { deleted: Boolean(ok), name };
  }
  async function listDifferentialPairs() {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.getAllDifferentialPairs)) {
      throw new Error("current EDA does not support differential pair");
    }
    const rows = await api.pcb_Drc.getAllDifferentialPairs();
    const pairs = Array.isArray(rows) ? rows.map((row) => ({
      name: String((row == null ? void 0 : row.name) || ""),
      positiveNet: String((row == null ? void 0 : row.positiveNet) || ""),
      negativeNet: String((row == null ? void 0 : row.negativeNet) || "")
    })) : [];
    return { totalPairs: pairs.length, pairs };
  }
  async function createEqualLengthGroup(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.createEqualLengthNetGroup)) {
      throw new Error("current EDA does not support equal-length group");
    }
    const name = String((params == null ? void 0 : params.name) || "").trim();
    const nets = Array.isArray(params == null ? void 0 : params.nets) ? params.nets.map((item) => String(item || "").trim()).filter(Boolean) : [];
    if (!name || nets.length === 0) {
      throw new Error("name and nets are required");
    }
    const color = (params == null ? void 0 : params.color) || { r: 255, g: 128, b: 0, alpha: 1 };
    const ok = await api.pcb_Drc.createEqualLengthNetGroup(name, nets, color);
    return { created: Boolean(ok), name, nets, color };
  }
  async function deleteEqualLengthGroup(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.deleteEqualLengthNetGroup)) {
      throw new Error("current EDA does not support equal-length group");
    }
    const name = String((params == null ? void 0 : params.name) || "").trim();
    if (!name)
      throw new Error("name is required");
    const ok = await api.pcb_Drc.deleteEqualLengthNetGroup(name);
    return { deleted: Boolean(ok), name };
  }
  async function listEqualLengthGroups() {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.getAllEqualLengthNetGroups)) {
      throw new Error("current EDA does not support equal-length group");
    }
    const rows = await api.pcb_Drc.getAllEqualLengthNetGroups();
    const groups = Array.isArray(rows) ? rows.map((row) => ({
      name: String((row == null ? void 0 : row.name) || ""),
      nets: Array.isArray(row == null ? void 0 : row.nets) ? row.nets : [],
      color: (row == null ? void 0 : row.color) || null
    })) : [];
    return { totalGroups: groups.length, groups };
  }
  async function getBoardInfo() {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.dmt_Board) == null ? void 0 : _a.getCurrentBoardInfo)) {
      throw new Error("current EDA does not support dmt_Board.getCurrentBoardInfo");
    }
    const info = await api.dmt_Board.getCurrentBoardInfo();
    return {
      name: String((info == null ? void 0 : info.name) || (info == null ? void 0 : info.title) || ""),
      schematicUuid: String((info == null ? void 0 : info.schematicUuid) || (info == null ? void 0 : info.schUuid) || (info == null ? void 0 : info.sch_uuid) || ""),
      pcbUuid: String((info == null ? void 0 : info.pcbUuid) || (info == null ? void 0 : info.pcb_uuid) || "")
    };
  }
  async function openDocument(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _a.openDocument)) {
      throw new Error("current EDA does not support dmt_EditorControl.openDocument");
    }
    const uuid = String((params == null ? void 0 : params.uuid) || "").trim();
    if (!uuid)
      throw new Error("uuid is required");
    await api.dmt_EditorControl.openDocument(uuid);
    await new Promise((r) => setTimeout(r, 500));
    return { opened: uuid };
  }
  async function getSchematicState() {
    var _a, _b, _c;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.sch_PrimitiveComponent) == null ? void 0 : _a.getAll)) {
      throw new Error("current EDA does not support sch_PrimitiveComponent.getAll");
    }
    const rows = await api.sch_PrimitiveComponent.getAll(void 0, true);
    const components = (Array.isArray(rows) ? rows : []).map((r) => {
      var _a2, _b2, _c2, _d, _e, _f, _g, _h, _i;
      return {
        primitiveId: ((_a2 = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _a2.call(r)) || "",
        designator: ((_b2 = r == null ? void 0 : r.getState_Designator) == null ? void 0 : _b2.call(r)) || "",
        name: ((_c2 = r == null ? void 0 : r.getState_Name) == null ? void 0 : _c2.call(r)) || ((_d = r == null ? void 0 : r.getState_DisplayName) == null ? void 0 : _d.call(r)) || "",
        value: ((_e = r == null ? void 0 : r.getState_Value) == null ? void 0 : _e.call(r)) || "",
        component: {
          libraryUuid: ((_f = r == null ? void 0 : r.getState_LibraryUuid) == null ? void 0 : _f.call(r)) || ((_g = r == null ? void 0 : r.getState_ComponentLibraryUuid) == null ? void 0 : _g.call(r)) || "",
          uuid: ((_h = r == null ? void 0 : r.getState_Uuid) == null ? void 0 : _h.call(r)) || ((_i = r == null ? void 0 : r.getState_ComponentUuid) == null ? void 0 : _i.call(r)) || ""
        }
      };
    }).filter((c) => c.primitiveId);
    let pins = [];
    if ((_b = api == null ? void 0 : api.sch_PrimitivePin) == null ? void 0 : _b.getAll) {
      try {
        const pinRows = await api.sch_PrimitivePin.getAll();
        pins = (Array.isArray(pinRows) ? pinRows : []).map((p) => {
          var _a2, _b2, _c2, _d, _e, _f, _g, _h, _i, _j, _k;
          return {
            primitiveId: ((_a2 = p == null ? void 0 : p.getState_PrimitiveId) == null ? void 0 : _a2.call(p)) || "",
            pinNumber: ((_b2 = p == null ? void 0 : p.getState_PinNumber) == null ? void 0 : _b2.call(p)) || ((_c2 = p == null ? void 0 : p.getState_Number) == null ? void 0 : _c2.call(p)) || "",
            pinName: ((_d = p == null ? void 0 : p.getState_PinName) == null ? void 0 : _d.call(p)) || ((_e = p == null ? void 0 : p.getState_Name) == null ? void 0 : _e.call(p)) || "",
            net: ((_f = p == null ? void 0 : p.getState_Net) == null ? void 0 : _f.call(p)) || ((_g = p == null ? void 0 : p.getState_NetName) == null ? void 0 : _g.call(p)) || "",
            x: Number((_i = (_h = p == null ? void 0 : p.getState_X) == null ? void 0 : _h.call(p)) != null ? _i : 0),
            y: Number((_k = (_j = p == null ? void 0 : p.getState_Y) == null ? void 0 : _j.call(p)) != null ? _k : 0)
          };
        }).filter((p) => p.primitiveId);
      } catch (e) {
      }
    }
    let wires = [];
    if ((_c = api == null ? void 0 : api.sch_PrimitiveWire) == null ? void 0 : _c.getAll) {
      try {
        const wireRows = await api.sch_PrimitiveWire.getAll();
        wires = (Array.isArray(wireRows) ? wireRows : []).map((w) => {
          var _a2, _b2, _c2;
          return {
            primitiveId: ((_a2 = w == null ? void 0 : w.getState_PrimitiveId) == null ? void 0 : _a2.call(w)) || "",
            net: ((_b2 = w == null ? void 0 : w.getState_Net) == null ? void 0 : _b2.call(w)) || ((_c2 = w == null ? void 0 : w.getState_NetName) == null ? void 0 : _c2.call(w)) || ""
          };
        }).filter((w) => w.primitiveId);
      } catch (e) {
      }
    }
    return { components, pins, wires };
  }
  async function getNetlist(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.sch_Netlist) == null ? void 0 : _a.getNetlist)) {
      throw new Error("current EDA does not support sch_Netlist.getNetlist");
    }
    const netlist = await api.sch_Netlist.getNetlist(params == null ? void 0 : params.type);
    return { netlist: typeof netlist === "string" ? netlist : JSON.stringify(netlist) };
  }
  async function runSchDrc(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.sch_Drc) == null ? void 0 : _a.check)) {
      throw new Error("current EDA does not support sch_Drc.check");
    }
    const strict = (params == null ? void 0 : params.strict) !== false;
    const result = await api.sch_Drc.check(strict, true);
    const serialize = (obj, depth = 0) => {
      if (depth > 3 || !obj)
        return obj;
      if (typeof obj !== "object")
        return obj;
      if (Array.isArray(obj))
        return obj.map((v) => serialize(v, depth + 1));
      const out = {};
      for (const k of getAllKeys(obj)) {
        try {
          const v = obj[k];
          if (typeof v === "function" && k.startsWith("getState_")) {
            out[k.replace("getState_", "")] = serialize(v.call(obj), depth + 1);
          } else if (typeof v !== "function") {
            out[k] = serialize(v, depth + 1);
          }
        } catch (e) {
        }
      }
      return out;
    };
    if (result && typeof result === "object") {
      return { passed: false, details: serialize(result) };
    }
    if (Array.isArray(result)) {
      return { passed: result.length === 0, errors: result.map((r) => serialize(r)), count: result.length };
    }
    return { passed: Boolean(result), raw: typeof result, rawStr: String(result).slice(0, 500) };
  }
  async function createPcbComponent(params) {
    var _a, _b, _c;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _a.create)) {
      throw new Error("current EDA does not support pcb_PrimitiveComponent.create");
    }
    const { component, layer, x, y, rotation } = params;
    if (!(component == null ? void 0 : component.libraryUuid) || !(component == null ? void 0 : component.uuid)) {
      throw new Error("component.libraryUuid and component.uuid are required");
    }
    const result = await api.pcb_PrimitiveComponent.create(
      { libraryUuid: component.libraryUuid, uuid: component.uuid },
      layer,
      x,
      y,
      rotation != null ? rotation : 0,
      false
    );
    const primitiveId = ((_b = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _b.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
    const designator = ((_c = result == null ? void 0 : result.getState_Designator) == null ? void 0 : _c.call(result)) || (result == null ? void 0 : result.designator) || "";
    return { primitiveId, designator };
  }
  function getAllKeys(obj) {
    const seen = /* @__PURE__ */ new Set();
    let cur = obj;
    while (cur && cur !== Object.prototype) {
      for (const k of [...Object.getOwnPropertyNames(cur), ...Object.keys(cur)]) {
        seen.add(k);
      }
      cur = Object.getPrototypeOf(cur);
    }
    return [...seen].filter((k) => k !== "constructor");
  }
  function serializeExportResult(result, exportType) {
    if (result === void 0 || result === null) {
      return { success: true, exportType, note: "Export triggered (may open file dialog in EDA)" };
    }
    if (typeof result === "string") {
      return {
        success: true,
        exportType,
        dataType: "text",
        size: result.length,
        preview: result.slice(0, 2e3),
        truncated: result.length > 2e3
      };
    }
    if (result instanceof ArrayBuffer || (result == null ? void 0 : result.byteLength) !== void 0) {
      return {
        success: true,
        exportType,
        dataType: "binary",
        size: result.byteLength || 0,
        note: "Binary data exported"
      };
    }
    if (typeof result === "object") {
      const out = {
        success: true,
        exportType,
        dataType: typeof result
      };
      if (result.size !== void 0)
        out.size = result.size;
      if (result.type !== void 0)
        out.mimeType = result.type;
      if (result.name !== void 0)
        out.fileName = result.name;
      for (const k of Object.keys(result).slice(0, 20)) {
        try {
          const v = result[k];
          if (typeof v !== "function" && typeof v !== "object")
            out[k] = v;
        } catch (e) {
        }
      }
      return out;
    }
    return { success: true, exportType, dataType: typeof result, raw: String(result).slice(0, 500) };
  }
  function serializeResult(obj, depth = 0) {
    if (obj === null || obj === void 0)
      return obj;
    if (typeof obj !== "object")
      return obj;
    if (depth > 2)
      return "[...]";
    if (Array.isArray(obj))
      return obj.slice(0, 50).map((v) => serializeResult(v, depth + 1));
    const out = {};
    for (const k of getAllKeys(obj)) {
      try {
        const v = obj[k];
        if (typeof v === "function") {
          if (k.startsWith("getState_"))
            out[k.replace("getState_", "")] = v.call(obj);
        } else {
          out[k] = depth < 2 ? serializeResult(v, depth + 1) : v;
        }
      } catch (e) {
      }
    }
    return out;
  }
  async function exploreEdaApi(params = {}) {
    const api = anyEda();
    if (!api)
      return { error: "EDA runtime not available" };
    const prefix = (params == null ? void 0 : params.prefix) || "";
    if (!prefix) {
      const keys = {};
      const topKeys = getAllKeys(api);
      for (const key of topKeys) {
        const val = api[key];
        if (val && typeof val === "object") {
          const methods2 = getAllKeys(val).filter((k) => typeof val[k] === "function");
          keys[key] = methods2;
        } else if (typeof val === "function") {
          keys[`fn:${key}`] = [];
        }
      }
      return { prefix: "root", keys };
    }
    const target = api[prefix];
    if (target === void 0) {
      return { error: `No API object at prefix: ${prefix}` };
    }
    if (typeof target === "function") {
      return { prefix, type: "function", value: String(target).slice(0, 200) };
    }
    if (typeof target !== "object" || target === null) {
      return { prefix, type: typeof target, value: target };
    }
    const methods = getAllKeys(target).filter((k) => typeof target[k] === "function");
    const props = getAllKeys(target).filter((k) => typeof target[k] !== "function");
    const propValues = {};
    for (const p of props.slice(0, 30)) {
      try {
        propValues[p] = target[p];
      } catch (e) {
        propValues[p] = "<error>";
      }
    }
    return { prefix, methods, props: propValues };
  }
  async function schSearchLibrary(params) {
    var _a, _b, _c;
    const api = anyEda();
    const lcsc = params == null ? void 0 : params.lcsc;
    if (!lcsc)
      throw new Error("lcsc parameter required");
    try {
      const libDevice = api == null ? void 0 : api.lib_Device;
      if (libDevice == null ? void 0 : libDevice.getByLcscIds) {
        const results2 = await libDevice.getByLcscIds([lcsc]);
        if (results2 && results2.length > 0) {
          const dev = results2[0];
          const libraryUuid = dev.libraryUuid || dev.library_uuid || ((_a = dev.getState_LibraryUuid) == null ? void 0 : _a.call(dev));
          const uuid = dev.uuid || dev.componentUuid || ((_b = dev.getState_Uuid) == null ? void 0 : _b.call(dev));
          const name = dev.name || dev.title || ((_c = dev.getState_Title) == null ? void 0 : _c.call(dev)) || "";
          if (libraryUuid && uuid) {
            return { lcsc, found: true, libraryUuid, uuid, name, raw: dev, method: "lib_Device.getByLcscIds" };
          }
          return { lcsc, found: true, raw: dev, method: "lib_Device.getByLcscIds" };
        }
      }
    } catch (e) {
    }
    const candidates = [
      ["dmt_Library.getComponentByLcscNo", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_Library) == null ? void 0 : _a2.getComponentByLcscNo) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["dmt_Library.searchByLcsc", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_Library) == null ? void 0 : _a2.searchByLcsc) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["dmt_Library.getComponentByNo", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_Library) == null ? void 0 : _a2.getComponentByNo) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["dmt_Library.searchComponents", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_Library) == null ? void 0 : _a2.searchComponents) == null ? void 0 : _b2.call(_a2, { lcsc });
      }],
      ["dmt_Datasource.getComponentByLcsc", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_Datasource) == null ? void 0 : _a2.getComponentByLcsc) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["dmt_LibraryService.searchByLcsc", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.dmt_LibraryService) == null ? void 0 : _a2.searchByLcsc) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["lcsc_Library.getByNo", async () => {
        var _a2, _b2;
        return (_b2 = (_a2 = api == null ? void 0 : api.lcsc_Library) == null ? void 0 : _a2.getByNo) == null ? void 0 : _b2.call(_a2, lcsc);
      }],
      ["sys_Http.post:component/search", async () => {
        const http = api == null ? void 0 : api.sys_Http;
        if (!(http == null ? void 0 : http.post))
          return void 0;
        return http.post("/api/editor/component/search", { lcscNo: lcsc });
      }]
    ];
    const results = {};
    for (const [name, fn] of candidates) {
      try {
        const r = await fn();
        if (r !== void 0 && r !== null) {
          results[name] = r;
        } else {
          results[name] = "returned null/undefined";
        }
      } catch (e) {
        results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return { lcsc, found: false, results };
  }
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: ${ms}ms timeout`)), ms))
    ]);
  }
  async function schCreateComponent(params) {
    var _a, _b, _c;
    const api = anyEda();
    const { lcsc, libraryUuid, componentUuid, x, y, rotation = 0 } = params;
    const schComp = api == null ? void 0 : api.sch_PrimitiveComponent;
    if (!(schComp == null ? void 0 : schComp.create)) {
      return { success: false, error: "sch_PrimitiveComponent.create not available" };
    }
    let lUuid = libraryUuid;
    let cUuid = componentUuid;
    if ((!lUuid || !cUuid) && lcsc) {
      const libDevice = api == null ? void 0 : api.lib_Device;
      if (libDevice == null ? void 0 : libDevice.getByLcscIds) {
        const devices = await libDevice.getByLcscIds([lcsc]);
        if (devices && devices.length > 0) {
          const dev = devices[0];
          lUuid = dev.libraryUuid || dev.library_uuid;
          cUuid = dev.uuid || dev.componentUuid;
        }
      }
      if (!lUuid || !cUuid) {
        return { success: false, error: `Could not resolve UUIDs for LCSC ${lcsc}` };
      }
    }
    if (!lUuid || !cUuid) {
      return { success: false, error: "libraryUuid and componentUuid (or lcsc) required" };
    }
    let pageUuid = "";
    try {
      const pageInfo = await ((_b = (_a = api == null ? void 0 : api.dmt_Schematic) == null ? void 0 : _a.getCurrentSchematicPageInfo) == null ? void 0 : _b.call(_a));
      pageUuid = (pageInfo == null ? void 0 : pageInfo.uuid) || "";
    } catch (e) {
    }
    const componentObj = { libraryUuid: lUuid, uuid: cUuid };
    const argSets = [
      { label: "(comp,x,y,rot,false)", args: [componentObj, x, y, rotation, false] },
      { label: "(comp,x,y,rot)", args: [componentObj, x, y, rotation] }
    ];
    if (pageUuid) {
      argSets.push(
        { label: "(comp,page,x,y,rot,false)", args: [componentObj, pageUuid, x, y, rotation, false] },
        { label: "(comp,page,x,y,rot)", args: [componentObj, pageUuid, x, y, rotation] }
      );
    }
    const errors = {};
    for (const { label, args } of argSets) {
      try {
        log(`trying schComp.create${label}`);
        const result = await withTimeout(schComp.create(...args), 6e3, label);
        const id = ((_c = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _c.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
        log(`schComp.create${label} succeeded: ${id}`);
        return { success: true, primitiveId: id, libraryUuid: lUuid, componentUuid: cUuid, method: label, pageUuid };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors[label] = msg;
        log(`schComp.create${label} failed: ${msg}`);
      }
    }
    return { success: false, error: "All create signatures failed", attempts: errors, libraryUuid: lUuid, componentUuid: cUuid, pageUuid };
  }
  async function schCreateWire(params) {
    var _a;
    const api = anyEda();
    const schWire = api == null ? void 0 : api.sch_PrimitiveWire;
    if (!(schWire == null ? void 0 : schWire.create)) {
      return { success: false, error: "sch_PrimitiveWire.create not available" };
    }
    let line;
    if (params.points && params.points.length >= 4) {
      line = params.points;
    } else {
      const { x1, y1, x2, y2 } = params;
      line = [x1, y1, x2, y2];
    }
    if (line.length % 2 !== 0)
      line.pop();
    if (line.length === 4) {
      line = [line[0], line[1], line[2], line[3], line[2], line[3], line[2], line[3]];
    }
    let wireId = "";
    try {
      const result = await withTimeout(schWire.create({ line: [0, 0, 0, 0] }), 5e3, "create");
      wireId = ((_a = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _a.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
    } catch (e) {
    }
    if (!wireId) {
      return { success: false, error: "wire create failed" };
    }
    try {
      await schWire.modify(wireId, { line });
    } catch (e) {
    }
    return { success: true, primitiveId: wireId };
  }
  async function schCreateNetLabel(params) {
    var _a, _b, _c;
    const api = anyEda();
    const { x, y, name, rotation = 0 } = params;
    const schAttr = api == null ? void 0 : api.sch_PrimitiveAttribute;
    if (schAttr == null ? void 0 : schAttr.createNetLabel) {
      const result = await schAttr.createNetLabel(name, x, y, rotation);
      const id = ((_a = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _a.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
      return { success: true, primitiveId: id, method: "sch_PrimitiveAttribute.createNetLabel" };
    }
    const schLabel = api == null ? void 0 : api.sch_PrimitiveNetLabel;
    if (schLabel == null ? void 0 : schLabel.create) {
      const result = await schLabel.create(name, x, y, rotation);
      const id = ((_b = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _b.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
      return { success: true, primitiveId: id, method: "sch_PrimitiveNetLabel" };
    }
    const schNet = api == null ? void 0 : api.sch_PrimitiveNet;
    if (schNet == null ? void 0 : schNet.create) {
      const result = await schNet.create(name, x, y, rotation);
      const id = ((_c = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _c.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
      return { success: true, primitiveId: id, method: "sch_PrimitiveNet" };
    }
    return {
      success: false,
      error: "No net label API found",
      available: {
        sch_PrimitiveAttribute_createNetLabel: Boolean(schAttr == null ? void 0 : schAttr.createNetLabel),
        sch_PrimitiveNetLabel: Boolean(schLabel),
        sch_PrimitiveNet: Boolean(schNet)
      }
    };
  }
  async function schCreatePowerPort(params) {
    var _a, _b, _c;
    const api = anyEda();
    const { x, y, name, rotation = 0 } = params;
    const schComp = api == null ? void 0 : api.sch_PrimitiveComponent;
    const nameLower = name.toLowerCase();
    const isGround = nameLower.includes("gnd") || nameLower === "vss" || nameLower === "ground";
    if (schComp == null ? void 0 : schComp.createNetFlag) {
      const argSets = [
        { label: "createNetFlag(name,x,y,rot)", args: [name, x, y, rotation] },
        { label: "createNetFlag(name,{x,y},rot)", args: [name, { x, y }, rotation] },
        { label: "createNetFlag({name,x,y,rot})", args: [{ name, x, y, rotation }] }
      ];
      const errors = {};
      for (const { label, args } of argSets) {
        try {
          log(`trying schComp.${label}`);
          const result = await withTimeout(schComp.createNetFlag(...args), 6e3, label);
          const id = ((_a = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _a.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
          return { success: true, primitiveId: id, method: label };
        } catch (e) {
          errors[label] = e instanceof Error ? e.message : String(e);
        }
      }
      log("createNetFlag failed, falling back to net label for power symbol");
      const schAttr2 = api == null ? void 0 : api.sch_PrimitiveAttribute;
      if (schAttr2 == null ? void 0 : schAttr2.createNetLabel) {
        try {
          const result = await schAttr2.createNetLabel(name, x, y, rotation);
          const id = ((_b = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _b.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
          return { success: true, primitiveId: id, method: "netLabel-fallback", note: "Used net label instead of power symbol", createNetFlagErrors: errors };
        } catch (e) {
        }
      }
      return { success: false, error: "createNetFlag and netLabel fallback both failed", attempts: errors };
    }
    const schAttr = api == null ? void 0 : api.sch_PrimitiveAttribute;
    if (schAttr == null ? void 0 : schAttr.createNetLabel) {
      const result = await schAttr.createNetLabel(name, x, y, rotation);
      const id = ((_c = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _c.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
      return { success: true, primitiveId: id, method: "netLabel-only", note: "createNetFlag not available, used net label" };
    }
    return { success: false, error: "No power port or net label API found" };
  }
  async function getFeatureSupport() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    const api = anyEda();
    return {
      bridgeVersion: APP_VERSION,
      screenshot: {
        renderedAreaImage: Boolean((_a = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _a.getCurrentRenderedAreaImage),
        exportImage: Boolean((_b = api == null ? void 0 : api.pcb_Document) == null ? void 0 : _b.exportImage),
        canvasToDataUrl: Boolean((_c = api == null ? void 0 : api.sys_Canvas) == null ? void 0 : _c.toDataURL)
      },
      silkscreen: {
        query: Boolean((_d = api == null ? void 0 : api.pcb_PrimitiveString) == null ? void 0 : _d.getAll),
        modify: Boolean((_e = api == null ? void 0 : api.pcb_PrimitiveString) == null ? void 0 : _e.modify),
        auto: Boolean((_f = api == null ? void 0 : api.pcb_PrimitiveString) == null ? void 0 : _f.modify)
      },
      via: {
        create: Boolean((_g = api == null ? void 0 : api.pcb_PrimitiveVia) == null ? void 0 : _g.create),
        delete: Boolean((_h = api == null ? void 0 : api.pcb_PrimitiveVia) == null ? void 0 : _h.delete)
      },
      keepout: {
        create: Boolean(((_i = api == null ? void 0 : api.pcb_PrimitiveRegion) == null ? void 0 : _i.create) && ((_j = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _j.createPolygon)),
        delete: Boolean((_k = api == null ? void 0 : api.pcb_PrimitiveRegion) == null ? void 0 : _k.delete)
      },
      pour: {
        create: Boolean(((_l = api == null ? void 0 : api.pcb_PrimitivePour) == null ? void 0 : _l.create) && ((_m = api == null ? void 0 : api.pcb_MathPolygon) == null ? void 0 : _m.createPolygon)),
        delete: Boolean((_n = api == null ? void 0 : api.pcb_PrimitivePour) == null ? void 0 : _n.delete)
      },
      routingRules: {
        differentialPair: Boolean((_o = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _o.createDifferentialPair),
        equalLengthGroup: Boolean((_p = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _p.createEqualLengthNetGroup),
        drcCheck: Boolean(((_q = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _q.check) || ((_r = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _r.runDrc)),
        padPairGroup: Boolean((_s = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _s.createPadPairGroup)
      },
      schematic: {
        getBoardInfo: Boolean((_t = api == null ? void 0 : api.dmt_Board) == null ? void 0 : _t.getCurrentBoardInfo),
        openDocument: Boolean((_u = api == null ? void 0 : api.dmt_EditorControl) == null ? void 0 : _u.openDocument),
        getComponents: Boolean((_v = api == null ? void 0 : api.sch_PrimitiveComponent) == null ? void 0 : _v.getAll),
        getNetlist: Boolean((_w = api == null ? void 0 : api.sch_Netlist) == null ? void 0 : _w.getNetlist),
        schDrc: Boolean((_x = api == null ? void 0 : api.sch_Drc) == null ? void 0 : _x.check),
        createPcbComponent: Boolean((_y = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _y.create)
      }
    };
  }
  async function getTracks(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _a.getAll)) {
      throw new Error("current EDA does not support track query");
    }
    const rows = await api.pcb_PrimitiveLine.getAll(params.net, params.layer);
    const tracks = (Array.isArray(rows) ? rows : []).map((r) => {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      return {
        primitiveId: ((_a2 = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _a2.call(r)) || "",
        net: ((_b = r == null ? void 0 : r.getState_Net) == null ? void 0 : _b.call(r)) || "",
        layer: (_d = (_c = r == null ? void 0 : r.getState_Layer) == null ? void 0 : _c.call(r)) != null ? _d : "",
        startX: Number((_f = (_e = r == null ? void 0 : r.getState_StartX) == null ? void 0 : _e.call(r)) != null ? _f : 0),
        startY: Number((_h = (_g = r == null ? void 0 : r.getState_StartY) == null ? void 0 : _g.call(r)) != null ? _h : 0),
        endX: Number((_j = (_i = r == null ? void 0 : r.getState_EndX) == null ? void 0 : _i.call(r)) != null ? _j : 0),
        endY: Number((_l = (_k = r == null ? void 0 : r.getState_EndY) == null ? void 0 : _k.call(r)) != null ? _l : 0),
        width: Number((_n = (_m = r == null ? void 0 : r.getState_Width) == null ? void 0 : _m.call(r)) != null ? _n : 0)
      };
    }).filter((t) => t.primitiveId);
    return { tracks, count: tracks.length };
  }
  async function deleteTracks(params) {
    var _a;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _a.delete)) {
      throw new Error("current EDA does not support track delete");
    }
    const primitiveIds = parsePrimitiveIds(params);
    const ok = await api.pcb_PrimitiveLine.delete(primitiveIds);
    return {
      deleted: Boolean(ok),
      primitiveIds: Array.isArray(primitiveIds) ? primitiveIds : [primitiveIds]
    };
  }
  async function getNetPrimitives(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H;
    const api = anyEda();
    const net = String((params == null ? void 0 : params.net) || "").trim();
    if (!net)
      throw new Error("net is required");
    const result = { tracks: [], vias: [], pads: [] };
    if ((_a = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _a.getAll) {
      const rows = await api.pcb_PrimitiveLine.getAll(net);
      for (const r of Array.isArray(rows) ? rows : []) {
        const id = (_b = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _b.call(r);
        if (!id)
          continue;
        result.tracks.push({
          primitiveId: id,
          startX: Number((_d = (_c = r == null ? void 0 : r.getState_StartX) == null ? void 0 : _c.call(r)) != null ? _d : 0),
          startY: Number((_f = (_e = r == null ? void 0 : r.getState_StartY) == null ? void 0 : _e.call(r)) != null ? _f : 0),
          endX: Number((_h = (_g = r == null ? void 0 : r.getState_EndX) == null ? void 0 : _g.call(r)) != null ? _h : 0),
          endY: Number((_j = (_i = r == null ? void 0 : r.getState_EndY) == null ? void 0 : _i.call(r)) != null ? _j : 0),
          layer: (_l = (_k = r == null ? void 0 : r.getState_Layer) == null ? void 0 : _k.call(r)) != null ? _l : "",
          width: Number((_n = (_m = r == null ? void 0 : r.getState_Width) == null ? void 0 : _m.call(r)) != null ? _n : 0)
        });
      }
    }
    if ((_o = api == null ? void 0 : api.pcb_PrimitiveVia) == null ? void 0 : _o.getAll) {
      try {
        const rows = await api.pcb_PrimitiveVia.getAll();
        for (const r of Array.isArray(rows) ? rows : []) {
          const viaNet = ((_p = r == null ? void 0 : r.getState_Net) == null ? void 0 : _p.call(r)) || "";
          if (viaNet !== net)
            continue;
          const id = (_q = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _q.call(r);
          if (!id)
            continue;
          result.vias.push({
            primitiveId: id,
            x: Number((_s = (_r = r == null ? void 0 : r.getState_X) == null ? void 0 : _r.call(r)) != null ? _s : 0),
            y: Number((_u = (_t = r == null ? void 0 : r.getState_Y) == null ? void 0 : _t.call(r)) != null ? _u : 0)
          });
        }
      } catch (e) {
      }
    }
    if ((_v = api == null ? void 0 : api.pcb_PrimitivePad) == null ? void 0 : _v.getAll) {
      try {
        const rows = await api.pcb_PrimitivePad.getAll();
        for (const r of Array.isArray(rows) ? rows : []) {
          const padNet = ((_w = r == null ? void 0 : r.getState_Net) == null ? void 0 : _w.call(r)) || ((_x = r == null ? void 0 : r.getState_NetName) == null ? void 0 : _x.call(r)) || "";
          if (padNet !== net)
            continue;
          const id = (_y = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _y.call(r);
          if (!id)
            continue;
          result.pads.push({
            primitiveId: id,
            x: Number((_C = (_B = (_z = r == null ? void 0 : r.getState_X) == null ? void 0 : _z.call(r)) != null ? _B : (_A = r == null ? void 0 : r.getState_CenterX) == null ? void 0 : _A.call(r)) != null ? _C : 0),
            y: Number((_G = (_F = (_D = r == null ? void 0 : r.getState_Y) == null ? void 0 : _D.call(r)) != null ? _F : (_E = r == null ? void 0 : r.getState_CenterY) == null ? void 0 : _E.call(r)) != null ? _G : 0),
            designator: ((_H = r == null ? void 0 : r.getState_Designator) == null ? void 0 : _H.call(r)) || ""
          });
        }
      } catch (e) {
      }
    }
    return result;
  }
  async function relocateComponent(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _a.getAll) || !((_b = api == null ? void 0 : api.pcb_PrimitiveComponent) == null ? void 0 : _b.modify)) {
      throw new Error("current EDA does not support component modify");
    }
    const rows = await api.pcb_PrimitiveComponent.getAll();
    let targetId = null;
    let targetRow = null;
    for (const row of rows) {
      if ((((_c = row == null ? void 0 : row.getState_Designator) == null ? void 0 : _c.call(row)) || "") === params.designator) {
        targetId = ((_d = row == null ? void 0 : row.getState_PrimitiveId) == null ? void 0 : _d.call(row)) || null;
        targetRow = row;
        break;
      }
    }
    if (!targetId)
      throw new Error(`component not found: ${params.designator}`);
    if ((_e = targetRow == null ? void 0 : targetRow.getState_PrimitiveLock) == null ? void 0 : _e.call(targetRow)) {
      throw new Error(`component locked: ${params.designator}`);
    }
    const padNets = normalizeNetArray((_f = targetRow == null ? void 0 : targetRow.getState_Pads) == null ? void 0 : _f.call(targetRow));
    const uniqueNets = [...new Set(padNets.map((p) => p.net).filter(Boolean))];
    const padPositions = [];
    if ((_g = api == null ? void 0 : api.pcb_PrimitivePad) == null ? void 0 : _g.getAll) {
      try {
        const allPads = await api.pcb_PrimitivePad.getAll();
        for (const p of Array.isArray(allPads) ? allPads : []) {
          const des = ((_h = p == null ? void 0 : p.getState_Designator) == null ? void 0 : _h.call(p)) || "";
          const parentId = ((_i = p == null ? void 0 : p.getState_ParentPrimitiveId) == null ? void 0 : _i.call(p)) || ((_j = p == null ? void 0 : p.getState_BelongPrimitiveId) == null ? void 0 : _j.call(p)) || ((_k = p == null ? void 0 : p.getState_ComponentPrimitiveId) == null ? void 0 : _k.call(p)) || "";
          if (des === params.designator || parentId === targetId) {
            padPositions.push({
              x: Number((_o = (_n = (_l = p == null ? void 0 : p.getState_X) == null ? void 0 : _l.call(p)) != null ? _n : (_m = p == null ? void 0 : p.getState_CenterX) == null ? void 0 : _m.call(p)) != null ? _o : 0),
              y: Number((_s = (_r = (_p = p == null ? void 0 : p.getState_Y) == null ? void 0 : _p.call(p)) != null ? _r : (_q = p == null ? void 0 : p.getState_CenterY) == null ? void 0 : _q.call(p)) != null ? _s : 0)
            });
          }
        }
      } catch (e) {
      }
    }
    const deletedTracks = [];
    const COORD_TOLERANCE = 2;
    if (((_t = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _t.getAll) && ((_u = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _u.delete) && padPositions.length > 0) {
      for (const net of uniqueNets) {
        try {
          const trackRows = await api.pcb_PrimitiveLine.getAll(net);
          const toDelete = [];
          for (const t of Array.isArray(trackRows) ? trackRows : []) {
            const sx = Number((_w = (_v = t == null ? void 0 : t.getState_StartX) == null ? void 0 : _v.call(t)) != null ? _w : 0);
            const sy = Number((_y = (_x = t == null ? void 0 : t.getState_StartY) == null ? void 0 : _x.call(t)) != null ? _y : 0);
            const ex = Number((_A = (_z = t == null ? void 0 : t.getState_EndX) == null ? void 0 : _z.call(t)) != null ? _A : 0);
            const ey = Number((_C = (_B = t == null ? void 0 : t.getState_EndY) == null ? void 0 : _B.call(t)) != null ? _C : 0);
            const touchesPad = padPositions.some(
              (pad) => Math.abs(sx - pad.x) <= COORD_TOLERANCE && Math.abs(sy - pad.y) <= COORD_TOLERANCE || Math.abs(ex - pad.x) <= COORD_TOLERANCE && Math.abs(ey - pad.y) <= COORD_TOLERANCE
            );
            if (touchesPad) {
              const id = (_D = t == null ? void 0 : t.getState_PrimitiveId) == null ? void 0 : _D.call(t);
              if (id)
                toDelete.push(id);
            }
          }
          if (toDelete.length > 0) {
            await api.pcb_PrimitiveLine.delete(toDelete);
            deletedTracks.push(...toDelete);
          }
        } catch (e) {
        }
      }
    }
    await api.pcb_PrimitiveComponent.modify(targetId, {
      x: params.x,
      y: params.y,
      rotation: (_G = (_F = params.rotation) != null ? _F : (_E = targetRow == null ? void 0 : targetRow.getState_Rotation) == null ? void 0 : _E.call(targetRow)) != null ? _G : 0
    });
    return {
      moved: params.designator,
      x: params.x,
      y: params.y,
      rotation: (_J = (_I = params.rotation) != null ? _I : (_H = targetRow == null ? void 0 : targetRow.getState_Rotation) == null ? void 0 : _H.call(targetRow)) != null ? _J : 0,
      deletedTracks,
      deletedTrackCount: deletedTracks.length,
      netsToReroute: uniqueNets
    };
  }
  async function routeTrack(params) {
    var _a, _b;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_PrimitiveLine) == null ? void 0 : _a.create)) {
      throw new Error("current EDA does not support track create");
    }
    const width = (_b = params.width) != null ? _b : 10;
    let created = 0;
    for (let i = 0; i < params.points.length - 1; i += 1) {
      const p1 = params.points[i];
      const p2 = params.points[i + 1];
      try {
        await api.pcb_PrimitiveLine.create(params.net, params.layer, p1.x, p1.y, p2.x, p2.y, width, false);
        created += 1;
      } catch (error) {
        console.error(`[${APP_NAME}] route segment failed`, i, error);
      }
    }
    return { createdSegments: created };
  }
  async function runDRC() {
    var _a, _b, _c, _d;
    const api = anyEda();
    if (!((_a = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _a.check) && !((_b = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _b.runDrc)) {
      throw new Error("current EDA does not support DRC");
    }
    let passed;
    let issues = [];
    if ((_c = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _c.check) {
      try {
        const verbose = await api.pcb_Drc.check(true, false, true);
        if (Array.isArray(verbose)) {
          issues = verbose;
          passed = verbose.length === 0;
        } else if (typeof verbose === "boolean") {
          passed = verbose;
        }
      } catch (e) {
        try {
          const quick = await api.pcb_Drc.check(true, false, false);
          if (typeof quick === "boolean") {
            passed = quick;
          }
        } catch (e2) {
        }
      }
    }
    if (issues.length === 0 && ((_d = api == null ? void 0 : api.pcb_Drc) == null ? void 0 : _d.runDrc)) {
      try {
        const raw = await api.pcb_Drc.runDrc();
        if (Array.isArray(raw)) {
          issues = raw;
          if (passed === void 0)
            passed = raw.length === 0;
        }
      } catch (e) {
      }
    }
    const normalized = issues.map((item, index) => {
      const rule = String((item == null ? void 0 : item.rule) || (item == null ? void 0 : item.type) || (item == null ? void 0 : item.name) || "").trim();
      const message = String((item == null ? void 0 : item.message) || (item == null ? void 0 : item.description) || "").trim();
      const refs = Array.isArray(item == null ? void 0 : item.primitiveIds) ? item.primitiveIds.map((id) => String(id || "")).filter(Boolean) : [];
      const text = `${rule} ${message}`.toLowerCase();
      let severity = "unknown";
      if (/error|错误|违规/.test(text))
        severity = "error";
      else if (/warning|警告/.test(text))
        severity = "warning";
      else if (/info|提示/.test(text))
        severity = "info";
      return {
        index: index + 1,
        severity,
        rule,
        message,
        primitiveIds: refs,
        raw: item
      };
    });
    if (passed === void 0) {
      passed = normalized.length === 0;
    }
    const summary = {
      errors: normalized.filter((item) => item.severity === "error").length,
      warnings: normalized.filter((item) => item.severity === "warning").length,
      infos: normalized.filter((item) => item.severity === "info").length,
      unknown: normalized.filter((item) => item.severity === "unknown").length
    };
    return {
      passed: Boolean(passed),
      totalCount: normalized.length,
      summary,
      issues: normalized
    };
  }
  async function takeScreenshot() {
    var _a, _b;
    const api = anyEda();
    const renderedAreaDataUrl = await tryCaptureRenderedAreaImageDataUrl();
    if (typeof renderedAreaDataUrl === "string" && renderedAreaDataUrl.startsWith("data:")) {
      return { imageDataUrl: renderedAreaDataUrl };
    }
    if ((_a = api == null ? void 0 : api.pcb_Document) == null ? void 0 : _a.exportImage) {
      try {
        const dataUrl = await api.pcb_Document.exportImage("png");
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
          return { imageDataUrl: dataUrl };
        }
      } catch (e) {
      }
    }
    if ((_b = api == null ? void 0 : api.sys_Canvas) == null ? void 0 : _b.toDataURL) {
      try {
        const dataUrl = await api.sys_Canvas.toDataURL("image/png");
        if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
          return { imageDataUrl: dataUrl };
        }
      } catch (e) {
      }
    }
    throw new Error(`screenshot unavailable, save manually to ${BRIDGE_DIR}\\screenshot.png`);
  }
  async function executeCommand(cmd) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R, _S, _T, _U, _V, _W, _X, _Y, _Z, __, _$, _aa, _ba, _ca, _da, _ea, _fa, _ga, _ha, _ia, _ja, _ka, _la, _ma, _na, _oa, _pa, _qa, _ra, _sa, _ta, _ua, _va, _wa, _xa, _ya, _za, _Aa, _Ba, _Ca, _Da, _Ea, _Fa, _Ga, _Ha, _Ia, _Ja, _Ka, _La, _Ma, _Na, _Oa, _Pa, _Qa, _Ra, _Sa, _Ta, _Ua, _Va, _Wa, _Xa, _Ya, _Za, __a, _$a, _ab, _bb, _cb, _db, _eb, _fb, _gb, _hb, _ib, _jb, _kb, _lb, _mb, _nb, _ob, _pb, _qb, _rb, _sb, _tb, _ub, _vb, _wb, _xb, _yb, _zb, _Ab, _Bb, _Cb, _Db, _Eb, _Fb, _Gb, _Hb, _Ib, _Jb, _Kb, _Lb, _Mb, _Nb, _Ob, _Pb, _Qb, _Rb, _Sb, _Tb, _Ub, _Vb, _Wb, _Xb, _Yb, _Zb, __b, _$b, _ac, _bc, _cc, _dc, _ec, _fc;
    const start = Date.now();
    try {
      let data;
      switch (cmd.action) {
        case "ping":
          data = { message: "pong", timestamp: Date.now() };
          break;
        case "get_state":
          data = await getPCBState();
          break;
        case "get_feature_support":
          data = await getFeatureSupport();
          break;
        case "screenshot":
          data = await takeScreenshot();
          break;
        case "get_silkscreens":
          data = await getSilkscreens(cmd.params);
          break;
        case "move_silkscreen":
          data = await moveSilkscreen(cmd.params);
          break;
        case "auto_silkscreen":
          data = await autoSilkscreen(cmd.params);
          break;
        case "move_component":
          data = await moveComponent(cmd.params);
          break;
        case "route_track":
          data = await routeTrack(cmd.params);
          break;
        case "create_via":
          data = await createVia(cmd.params);
          break;
        case "delete_via":
          data = await deleteVia(cmd.params);
          break;
        case "get_tracks":
          data = await getTracks(cmd.params);
          break;
        case "delete_tracks":
          data = await deleteTracks(cmd.params);
          break;
        case "get_net_primitives":
          data = await getNetPrimitives(cmd.params);
          break;
        case "relocate_component":
          data = await relocateComponent(cmd.params);
          break;
        case "create_keepout_rect":
          data = await createKeepoutRect(cmd.params);
          break;
        case "delete_region":
          data = await deleteRegion(cmd.params);
          break;
        case "create_pour_rect":
          data = await createPourRect(cmd.params);
          break;
        case "delete_pour":
          data = await deletePour(cmd.params);
          break;
        case "create_differential_pair":
          data = await createDifferentialPair(cmd.params);
          break;
        case "delete_differential_pair":
          data = await deleteDifferentialPair(cmd.params);
          break;
        case "list_differential_pairs":
          data = await listDifferentialPairs();
          break;
        case "create_equal_length_group":
          data = await createEqualLengthGroup(cmd.params);
          break;
        case "delete_equal_length_group":
          data = await deleteEqualLengthGroup(cmd.params);
          break;
        case "list_equal_length_groups":
          data = await listEqualLengthGroups();
          break;
        case "run_drc":
          data = await runDRC();
          break;
        case "get_pads":
          data = await getPads(cmd.params);
          break;
        case "select_component": {
          const api = anyEda();
          if (!((_a = api == null ? void 0 : api.pcb_SelectControl) == null ? void 0 : _a.selectByDesignator)) {
            throw new Error("select not supported");
          }
          await api.pcb_SelectControl.selectByDesignator(cmd.params.designator);
          data = { selected: cmd.params.designator };
          break;
        }
        case "delete_selected": {
          const api = anyEda();
          if (!((_b = api == null ? void 0 : api.pcb_SelectControl) == null ? void 0 : _b.deleteSelected)) {
            throw new Error("delete not supported");
          }
          await api.pcb_SelectControl.deleteSelected();
          data = { deleted: true };
          break;
        }
        case "get_board_info":
          data = await getBoardInfo();
          break;
        case "open_document":
          data = await openDocument(cmd.params);
          break;
        case "get_schematic_state":
          data = await getSchematicState();
          break;
        case "get_netlist":
          data = await getNetlist(cmd.params);
          break;
        case "run_sch_drc":
          data = await runSchDrc(cmd.params);
          break;
        case "create_pcb_component":
          data = await createPcbComponent(cmd.params);
          break;
        case "explore_eda_api":
          data = await exploreEdaApi(cmd.params);
          break;
        case "sch_search_library":
          data = await schSearchLibrary(cmd.params);
          break;
        case "sch_create_component":
          data = await schCreateComponent(cmd.params);
          break;
        case "sch_create_wire":
          data = await schCreateWire(cmd.params);
          break;
        case "sch_create_net_label":
          data = await schCreateNetLabel(cmd.params);
          break;
        case "sch_create_power_port":
          data = await schCreatePowerPort(cmd.params);
          break;
        case "pcb_add_text": {
          const strApi = (_c = anyEda()) == null ? void 0 : _c.pcb_PrimitiveString;
          if (!(strApi == null ? void 0 : strApi.create)) {
            data = { error: "API not available" };
            break;
          }
          const { text: txt, x: tx, y: ty, layer: tl, fontSize: tfs, rotation: tr } = cmd.params;
          if (!txt) {
            data = { error: "text required" };
            break;
          }
          try {
            const result = await strApi.create(
              tl || 3,
              // layer (3=top silk)
              tx || 0,
              // x
              ty || 0,
              // y
              tr || 0,
              // rotation
              txt,
              // text content
              tfs || 40,
              // font size in mil
              void 0,
              // font
              void 0,
              // bold
              void 0,
              // italic
              false
              // locked
            );
            const pid = ((_d = result == null ? void 0 : result.getState_PrimitiveId) == null ? void 0 : _d.call(result)) || (result == null ? void 0 : result.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_set_title_block": {
          const schApi = (_e = anyEda()) == null ? void 0 : _e.dmt_Schematic;
          if (!(schApi == null ? void 0 : schApi.modifySchematicPageTitleBlock)) {
            data = { error: "API not available" };
            break;
          }
          const pageUuid = cmd.params.pageUuid;
          const fields = cmd.params.fields;
          if (!pageUuid || !fields) {
            data = { error: "pageUuid and fields required" };
            break;
          }
          try {
            await schApi.modifySchematicPageTitleBlock(pageUuid, fields);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_set_designator": {
          const schMod = (_f = anyEda()) == null ? void 0 : _f.sch_PrimitiveComponent;
          if (!(schMod == null ? void 0 : schMod.modify)) {
            data = { error: "modify not available" };
            break;
          }
          const pid2 = cmd.params.primitiveId;
          const desig2 = cmd.params.designator;
          if (!pid2 || !desig2) {
            data = { error: "primitiveId and designator required" };
            break;
          }
          try {
            await schMod.modify(pid2, { designator: desig2 });
            data = { success: true, primitiveId: pid2, designator: desig2 };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_modify_props": {
          const schMod3 = (_g = anyEda()) == null ? void 0 : _g.sch_PrimitiveComponent;
          const schPinMod = (_h = anyEda()) == null ? void 0 : _h.sch_PrimitivePin;
          const pid3 = cmd.params.primitiveId;
          const props3 = cmd.params.properties;
          if (!pid3 || !props3) {
            data = { error: "primitiveId and properties required" };
            break;
          }
          if (schMod3 == null ? void 0 : schMod3.modify) {
            try {
              await schMod3.modify(pid3, props3);
              data = { success: true, primitiveId: pid3, properties: props3 };
              break;
            } catch (_e2) {
            }
          }
          if (schPinMod == null ? void 0 : schPinMod.modify) {
            try {
              await schPinMod.modify(pid3, props3);
              data = { success: true, primitiveId: pid3, properties: props3, via: "pin" };
            } catch (e) {
              data = { success: false, error: e instanceof Error ? e.message : String(e) };
            }
          } else {
            data = { error: "modify not available" };
          }
          break;
        }
        case "sch_delete_component": {
          const schDel = (_i = anyEda()) == null ? void 0 : _i.sch_PrimitiveComponent;
          if (!(schDel == null ? void 0 : schDel.delete)) {
            data = { error: "delete not available" };
            break;
          }
          const pidDel = cmd.params.primitiveId;
          if (!pidDel) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            await schDel.delete(pidDel);
            data = { success: true, deleted: pidDel };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_set_pin_no_connect": {
          const schComp = (_j = anyEda()) == null ? void 0 : _j.sch_PrimitiveComponent;
          if (!(schComp == null ? void 0 : schComp.getAllPinsByPrimitiveId)) {
            data = { error: "getAllPinsByPrimitiveId not available" };
            break;
          }
          const pinPrimitiveId = cmd.params.pinPrimitiveId;
          const noConnect = cmd.params.noConnect !== false;
          if (!pinPrimitiveId) {
            data = { error: "pinPrimitiveId required" };
            break;
          }
          const compId = pinPrimitiveId.includes("-e") ? pinPrimitiveId.split("-e")[0] : pinPrimitiveId;
          try {
            const pins = await schComp.getAllPinsByPrimitiveId(compId);
            const pin = pins.find((p) => {
              var _a2;
              try {
                return ((_a2 = p.getState_PrimitiveId) == null ? void 0 : _a2.call(p)) === pinPrimitiveId;
              } catch (e) {
                return false;
              }
            });
            if (!pin) {
              data = { success: false, error: `pin ${pinPrimitiveId} not found in component ${compId}`, available: pins.map((p) => {
                var _a2;
                try {
                  return (_a2 = p.getState_PrimitiveId) == null ? void 0 : _a2.call(p);
                } catch (e) {
                  return null;
                }
              }) };
              break;
            }
            pin.setState_NoConnected(noConnect);
            await pin.done();
            data = { success: true, pinPrimitiveId, noConnect, compId };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_layers": {
          const layerApi = (_k = anyEda()) == null ? void 0 : _k.pcb_Layer;
          try {
            const layers = await ((_l = layerApi == null ? void 0 : layerApi.getAllLayers) == null ? void 0 : _l.call(layerApi));
            if (Array.isArray(layers)) {
              data = layers.map((l) => {
                const out = {};
                for (const k of getAllKeys(l)) {
                  try {
                    const v = l[k];
                    if (typeof v === "function" && k.startsWith("getState_")) {
                      out[k.replace("getState_", "")] = v.call(l);
                    } else if (typeof v !== "function") {
                      out[k] = v;
                    }
                  } catch (e) {
                  }
                }
                return out;
              });
            } else {
              data = { error: "getAllLayers returned non-array", raw: String(layers) };
            }
          } catch (e) {
            data = { error: String(e) };
          }
          break;
        }
        case "pcb_set_layer_count": {
          const layerApi2 = (_m = anyEda()) == null ? void 0 : _m.pcb_Layer;
          if (!(layerApi2 == null ? void 0 : layerApi2.setTheNumberOfCopperLayers)) {
            data = { error: "setTheNumberOfCopperLayers not available" };
            break;
          }
          try {
            await layerApi2.setTheNumberOfCopperLayers(cmd.params.count);
            data = { success: true, count: cmd.params.count };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_add_custom_layer": {
          const layerApi3 = (_n = anyEda()) == null ? void 0 : _n.pcb_Layer;
          if (!(layerApi3 == null ? void 0 : layerApi3.addCustomLayer)) {
            data = { error: "addCustomLayer not available" };
            break;
          }
          try {
            const result = await layerApi3.addCustomLayer(cmd.params.name, cmd.params.layerType);
            data = { success: true, result: result != null ? result : null };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_set_layer_visible": {
          const layerApi4 = (_o = anyEda()) == null ? void 0 : _o.pcb_Layer;
          const lid = cmd.params.layerId;
          const vis = cmd.params.visible;
          try {
            if (vis) {
              if (!(layerApi4 == null ? void 0 : layerApi4.setLayerVisible)) {
                data = { error: "setLayerVisible not available" };
                break;
              }
              await layerApi4.setLayerVisible(lid);
            } else {
              if (!(layerApi4 == null ? void 0 : layerApi4.setLayerInvisible)) {
                data = { error: "setLayerInvisible not available" };
                break;
              }
              await layerApi4.setLayerInvisible(lid);
            }
            data = { success: true, layerId: lid, visible: vis };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_lock_layer": {
          const layerApi5 = (_p = anyEda()) == null ? void 0 : _p.pcb_Layer;
          const lid5 = cmd.params.layerId;
          const locked5 = cmd.params.locked;
          try {
            if (locked5) {
              if (!(layerApi5 == null ? void 0 : layerApi5.lockLayer)) {
                data = { error: "lockLayer not available" };
                break;
              }
              await layerApi5.lockLayer(lid5);
            } else {
              if (!(layerApi5 == null ? void 0 : layerApi5.unlockLayer)) {
                data = { error: "unlockLayer not available" };
                break;
              }
              await layerApi5.unlockLayer(lid5);
            }
            data = { success: true, layerId: lid5, locked: locked5 };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_set_pcb_type": {
          const layerApi6 = (_q = anyEda()) == null ? void 0 : _q.pcb_Layer;
          if (!(layerApi6 == null ? void 0 : layerApi6.setPcbType)) {
            data = { error: "setPcbType not available" };
            break;
          }
          try {
            await layerApi6.setPcbType(cmd.params.pcbType);
            data = { success: true, pcbType: cmd.params.pcbType };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_all_nets": {
          const netApi = (_r = anyEda()) == null ? void 0 : _r.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.getAllNetName)) {
            data = { error: "getAllNetName not available" };
            break;
          }
          try {
            const nets = await netApi.getAllNetName();
            data = { nets: Array.isArray(nets) ? nets : [], count: Array.isArray(nets) ? nets.length : 0 };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_gerber": {
          const mfgApi = (_s = anyEda()) == null ? void 0 : _s.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getGerberFile)) {
            data = { error: "getGerberFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getGerberFile();
            data = serializeExportResult(result, "gerber");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_bom": {
          const mfgApi = (_t = anyEda()) == null ? void 0 : _t.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getBomFile)) {
            data = { error: "getBomFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getBomFile();
            data = serializeExportResult(result, "bom");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_pick_place": {
          const mfgApi = (_u = anyEda()) == null ? void 0 : _u.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getPickAndPlaceFile)) {
            data = { error: "getPickAndPlaceFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getPickAndPlaceFile();
            data = serializeExportResult(result, "pick_place");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_3d": {
          const mfgApi = (_v = anyEda()) == null ? void 0 : _v.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.get3DFile)) {
            data = { error: "get3DFile not available" };
            break;
          }
          try {
            const result = await mfgApi.get3DFile();
            data = serializeExportResult(result, "3d");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_pdf": {
          const mfgApi = (_w = anyEda()) == null ? void 0 : _w.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getPdfFile)) {
            data = { error: "getPdfFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getPdfFile();
            data = serializeExportResult(result, "pdf");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_dxf": {
          const mfgApi = (_x = anyEda()) == null ? void 0 : _x.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getDxfFile)) {
            data = { error: "getDxfFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getDxfFile();
            data = serializeExportResult(result, "dxf");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_dsn": {
          const mfgApi = (_y = anyEda()) == null ? void 0 : _y.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getDsnFile)) {
            data = { error: "getDsnFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getDsnFile();
            data = serializeExportResult(result, "dsn");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_ipc356": {
          const mfgApi = (_z = anyEda()) == null ? void 0 : _z.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getIpcD356AFile)) {
            data = { error: "getIpcD356AFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getIpcD356AFile();
            data = serializeExportResult(result, "ipc356");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_odb": {
          const mfgApi = (_A = anyEda()) == null ? void 0 : _A.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getOpenDatabaseDoublePlusFile)) {
            data = { error: "getODB++ not available" };
            break;
          }
          try {
            const result = await mfgApi.getOpenDatabaseDoublePlusFile();
            data = serializeExportResult(result, "odb");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_netlist": {
          const mfgApi = (_B = anyEda()) == null ? void 0 : _B.pcb_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getNetlistFile)) {
            data = { error: "getNetlistFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getNetlistFile();
            data = serializeExportResult(result, "netlist");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_manufacture_data": {
          const mfgApi = (_C = anyEda()) == null ? void 0 : _C.pcb_ManufactureData;
          if (!mfgApi) {
            data = { error: "pcb_ManufactureData not available" };
            break;
          }
          const available = {};
          const methods = [
            "getGerberFile",
            "getBomFile",
            "getPickAndPlaceFile",
            "get3DFile",
            "getPdfFile",
            "getDxfFile",
            "getDsnFile",
            "getIpcD356AFile",
            "getOpenDatabaseDoublePlusFile",
            "getNetlistFile",
            "getManufactureData",
            "get3DShellFile",
            "place3DShellOrder"
          ];
          for (const m of methods) {
            available[m] = typeof mfgApi[m] === "function";
          }
          try {
            const mfgData = mfgApi.getManufactureData ? await mfgApi.getManufactureData() : null;
            data = { available, manufactureData: mfgData };
          } catch (e) {
            data = { available, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_3d_shell": {
          const mfg = (_D = anyEda()) == null ? void 0 : _D.pcb_ManufactureData;
          const results10 = {};
          const serialize10 = (obj, depth = 0) => {
            if (depth > 2 || !obj)
              return obj;
            if (typeof obj !== "object")
              return obj;
            if (typeof obj === "string")
              return obj.slice(0, 500);
            if (Array.isArray(obj))
              return obj.slice(0, 5).map((v) => serialize10(v, depth + 1));
            const out = {};
            for (const k of Object.keys(obj).slice(0, 20)) {
              try {
                out[k] = serialize10(obj[k], depth + 1);
              } catch (e) {
                out[k] = "?";
              }
            }
            return out;
          };
          try {
            log("calling get3DShellFile...");
            const shellResult = await mfg.get3DShellFile();
            results10.get3DShellFile = serialize10(shellResult);
            results10.shellType = typeof shellResult;
            if (typeof shellResult === "string")
              results10.shellPreview = shellResult.slice(0, 200);
          } catch (e) {
            results10.get3DShellFile = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
          try {
            const file3d = await mfg.get3DFile();
            results10.get3DFile = serialize10(file3d);
            results10.file3dType = typeof file3d;
            if (typeof file3d === "string")
              results10.file3dPreview = file3d.slice(0, 200);
          } catch (e) {
            results10.get3DFile = `error: ${e instanceof Error ? e.message : String(e)}`;
          }
          results10.available = {
            get3DShellFile: Boolean(mfg == null ? void 0 : mfg.get3DShellFile),
            get3DFile: Boolean(mfg == null ? void 0 : mfg.get3DFile),
            place3DShellOrder: Boolean(mfg == null ? void 0 : mfg.place3DShellOrder)
          };
          data = results10;
          break;
        }
        case "pcb_coord_debug": {
          const pcbDoc = (_E = anyEda()) == null ? void 0 : _E.pcb_Document;
          const results9 = {};
          try {
            results9.canvasOrigin = await ((_F = pcbDoc == null ? void 0 : pcbDoc.getCanvasOrigin) == null ? void 0 : _F.call(pcbDoc));
          } catch (e) {
            results9.canvasOrigin = String(e);
          }
          try {
            results9.dataToCanvas = await ((_G = pcbDoc == null ? void 0 : pcbDoc.convertDataOriginToCanvasOrigin) == null ? void 0 : _G.call(pcbDoc, 0, 0));
          } catch (e) {
            results9.dataToCanvas = String(e);
          }
          try {
            results9.canvasToData = await ((_H = pcbDoc == null ? void 0 : pcbDoc.convertCanvasOriginToDataOrigin) == null ? void 0 : _H.call(pcbDoc, 0, 0));
          } catch (e) {
            results9.canvasToData = String(e);
          }
          try {
            await ((_I = pcbDoc == null ? void 0 : pcbDoc.zoomToBoardOutline) == null ? void 0 : _I.call(pcbDoc));
            results9.zoomToBoardOutline = "ok";
          } catch (e) {
            results9.zoomToBoardOutline = String(e);
          }
          data = results9;
          break;
        }
        case "sch_set_netlist": {
          const api7 = anyEda();
          if (!((_J = api7 == null ? void 0 : api7.sch_Netlist) == null ? void 0 : _J.setNetlist)) {
            data = { error: "setNetlist not available" };
            break;
          }
          const netlistData = cmd.params.netlist;
          try {
            await api7.sch_Netlist.setNetlist(netlistData);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_auto_route": {
          const api8 = anyEda();
          if (!((_K = api8 == null ? void 0 : api8.sch_Document) == null ? void 0 : _K.autoRouting)) {
            data = { error: "autoRouting not available" };
            break;
          }
          try {
            const result8 = await api8.sch_Document.autoRouting();
            data = { success: true, result: result8 };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_save": {
          const api9 = anyEda();
          try {
            await ((_M = (_L = api9 == null ? void 0 : api9.sch_Document) == null ? void 0 : _L.save) == null ? void 0 : _M.call(_L));
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_delete_all_wires": {
          const swDel = (_N = anyEda()) == null ? void 0 : _N.sch_PrimitiveWire;
          if (!(swDel == null ? void 0 : swDel.delete) || !(swDel == null ? void 0 : swDel.getAllPrimitiveId)) {
            data = { error: "delete API not available" };
            break;
          }
          const delIds = await swDel.getAllPrimitiveId();
          let deleted = 0;
          if (Array.isArray(delIds)) {
            for (const wid of delIds) {
              try {
                await swDel.delete(wid);
                deleted++;
              } catch (e) {
              }
            }
          }
          data = { deleted, total: Array.isArray(delIds) ? delIds.length : 0 };
          break;
        }
        case "sch_wire_probe": {
          const api6 = anyEda();
          const sw = api6 == null ? void 0 : api6.sch_PrimitiveWire;
          const sd2 = api6 == null ? void 0 : api6.sch_Document;
          const sp = api6 == null ? void 0 : api6.sch_Primitive;
          const results6 = {};
          try {
            const ids = await ((_O = sw == null ? void 0 : sw.getAllPrimitiveId) == null ? void 0 : _O.call(sw));
            results6.wireIds = ids;
          } catch (e) {
            results6.wireIds = `error: ${e}`;
          }
          try {
            const all1 = await ((_P = sw == null ? void 0 : sw.getAll) == null ? void 0 : _P.call(sw));
            results6.getAll_noArgs = Array.isArray(all1) ? all1.length : all1;
          } catch (e) {
            results6.getAll_noArgs = `error: ${e}`;
          }
          try {
            const all2 = await ((_Q = sw == null ? void 0 : sw.getAll) == null ? void 0 : _Q.call(sw, void 0, true));
            results6.getAll_undefinedTrue = Array.isArray(all2) ? all2.length : all2;
          } catch (e) {
            results6.getAll_undefinedTrue = `error: ${e}`;
          }
          try {
            const region = await ((_R = sd2 == null ? void 0 : sd2.getPrimitivesInRegion) == null ? void 0 : _R.call(sd2, 0, 0, 1170, 825));
            if (Array.isArray(region)) {
              const types = {};
              for (const p of region) {
                const t = ((_S = p == null ? void 0 : p.getState_PrimitiveType) == null ? void 0 : _S.call(p)) || ((_U = sp == null ? void 0 : sp.getPrimitiveTypeByPrimitiveId) == null ? void 0 : _U.call(sp, (_T = p == null ? void 0 : p.getState_PrimitiveId) == null ? void 0 : _T.call(p))) || "unknown";
                types[t] = (types[t] || 0) + 1;
              }
              results6.regionPrimitives = { total: region.length, types };
              const samples = [];
              for (const p of region.slice(0, 100)) {
                const pid = ((_V = p == null ? void 0 : p.getState_PrimitiveId) == null ? void 0 : _V.call(p)) || "";
                if (!pid)
                  continue;
                let ptype = "";
                try {
                  ptype = await ((_W = sp == null ? void 0 : sp.getPrimitiveTypeByPrimitiveId) == null ? void 0 : _W.call(sp, pid)) || "";
                } catch (e) {
                }
                if (ptype === "Wire" || ptype === "wire" || ptype === "WIRE") {
                  const s = { primitiveId: pid, type: ptype };
                  for (const k of getAllKeys(p)) {
                    try {
                      const v = p[k];
                      if (typeof v === "function" && k.startsWith("getState_"))
                        s[k.replace("getState_", "")] = v.call(p);
                    } catch (e) {
                    }
                  }
                  samples.push(s);
                  if (samples.length >= 3)
                    break;
                }
              }
              results6.wireSamples = samples;
            } else {
              results6.regionPrimitives = region;
            }
          } catch (e) {
            results6.regionPrimitives = `error: ${e}`;
          }
          const wireIds = results6.wireIds;
          if (Array.isArray(wireIds) && wireIds.length > 0) {
            const wireSamples2 = [];
            const sampleIds = wireIds.slice(-3);
            for (const wid of sampleIds) {
              try {
                const w = await ((_X = sw == null ? void 0 : sw.get) == null ? void 0 : _X.call(sw, wid));
                if (w) {
                  const s = { primitiveId: wid };
                  for (const k of getAllKeys(w)) {
                    try {
                      const v = w[k];
                      if (typeof v === "function" && k.startsWith("getState_")) {
                        s[k.replace("getState_", "")] = v.call(w);
                      } else if (typeof v !== "function") {
                        s[k] = v;
                      }
                    } catch (e) {
                    }
                  }
                  wireSamples2.push(s);
                }
              } catch (e) {
                wireSamples2.push({ primitiveId: wid, error: String(e) });
              }
            }
            results6.wireData = wireSamples2;
          }
          data = results6;
          break;
        }
        case "sch_get_all_pins": {
          const api5 = anyEda();
          const schC = api5 == null ? void 0 : api5.sch_PrimitiveComponent;
          if (!(schC == null ? void 0 : schC.getAll) || !(schC == null ? void 0 : schC.getAllPinsByPrimitiveId)) {
            data = { error: "API not available" };
            break;
          }
          const allComps = await schC.getAll(void 0, true);
          const result5 = [];
          for (const comp of Array.isArray(allComps) ? allComps : []) {
            const cId = ((_Y = comp == null ? void 0 : comp.getState_PrimitiveId) == null ? void 0 : _Y.call(comp)) || "";
            const desig = ((_Z = comp == null ? void 0 : comp.getState_Designator) == null ? void 0 : _Z.call(comp)) || "";
            if (!cId)
              continue;
            try {
              const pins = await schC.getAllPinsByPrimitiveId(cId);
              const pinList = (Array.isArray(pins) ? pins : []).map((p) => {
                const out = {};
                for (const k of getAllKeys(p)) {
                  try {
                    const v = p[k];
                    if (typeof v === "function" && k.startsWith("getState_")) {
                      out[k.replace("getState_", "")] = v.call(p);
                    }
                  } catch (e) {
                  }
                }
                return out;
              });
              if (pinList.length > 0) {
                result5.push({ componentId: cId, designator: desig, pins: pinList });
              }
            } catch (e) {
            }
          }
          data = result5;
          break;
        }
        case "sch_page_info": {
          const api4 = anyEda();
          const serialize4 = (obj) => {
            if (!obj || typeof obj !== "object")
              return obj;
            if (Array.isArray(obj))
              return obj.map(serialize4);
            const out = {};
            for (const k of getAllKeys(obj)) {
              try {
                const v = obj[k];
                if (typeof v !== "function")
                  out[k] = v;
              } catch (e) {
              }
            }
            return out;
          };
          const pageInfo = await ((_$ = (__ = api4 == null ? void 0 : api4.dmt_Schematic) == null ? void 0 : __.getCurrentSchematicPageInfo) == null ? void 0 : _$.call(__));
          const allPages = await ((_ba = (_aa = api4 == null ? void 0 : api4.dmt_Schematic) == null ? void 0 : _aa.getCurrentSchematicAllSchematicPagesInfo) == null ? void 0 : _ba.call(_aa));
          const schInfo = await ((_da = (_ca = api4 == null ? void 0 : api4.dmt_Schematic) == null ? void 0 : _ca.getCurrentSchematicInfo) == null ? void 0 : _da.call(_ca));
          data = {
            currentPage: pageInfo ? serialize4(pageInfo) : null,
            allPages: allPages ? serialize4(allPages) : null,
            schematic: schInfo ? serialize4(schInfo) : null
          };
          break;
        }
        case "sch_zoom_all": {
          const ec = (_ea = anyEda()) == null ? void 0 : _ea.dmt_EditorControl;
          if (ec == null ? void 0 : ec.zoomToAllPrimitives) {
            await ec.zoomToAllPrimitives();
            data = { success: true, action: "zoomToAllPrimitives" };
          } else {
            data = { success: false, error: "zoomToAllPrimitives not available" };
          }
          break;
        }
        case "sch_navigate": {
          const sd = (_fa = anyEda()) == null ? void 0 : _fa.sch_Document;
          if (sd == null ? void 0 : sd.navigateToCoordinates) {
            await sd.navigateToCoordinates((_ga = cmd.params.x) != null ? _ga : 0, (_ha = cmd.params.y) != null ? _ha : 0);
            data = { success: true };
          } else if (sd == null ? void 0 : sd.navigateToRegion) {
            const { x1, y1, x2, y2 } = cmd.params;
            await sd.navigateToRegion(x1 != null ? x1 : 0, y1 != null ? y1 : 0, x2 != null ? x2 : 12e3, y2 != null ? y2 : 6e3);
            data = { success: true, method: "navigateToRegion" };
          } else {
            data = { success: false, error: "no navigate API" };
          }
          break;
        }
        case "sch_get_primitive": {
          const api3 = anyEda();
          const pid = cmd.params.primitiveId;
          if (!pid) {
            data = { error: "primitiveId required" };
            break;
          }
          let raw3;
          try {
            raw3 = await ((_ja = (_ia = api3 == null ? void 0 : api3.sch_PrimitiveComponent) == null ? void 0 : _ia.get) == null ? void 0 : _ja.call(_ia, pid));
          } catch (e) {
          }
          if (!raw3)
            try {
              raw3 = await ((_la = (_ka = api3 == null ? void 0 : api3.sch_Primitive) == null ? void 0 : _ka.getPrimitiveByPrimitiveId) == null ? void 0 : _la.call(_ka, pid));
            } catch (e) {
            }
          const serialize3 = (obj) => {
            if (!obj || typeof obj !== "object")
              return obj;
            if (Array.isArray(obj))
              return obj.map(serialize3);
            const out = {};
            for (const k of getAllKeys(obj)) {
              try {
                const v = obj[k];
                if (typeof v !== "function")
                  out[k] = v;
              } catch (e) {
              }
            }
            return out;
          };
          data = raw3 ? serialize3(raw3) : { error: "primitive not found" };
          break;
        }
        case "lib_device_lookup": {
          const libDevice = (_ma = anyEda()) == null ? void 0 : _ma.lib_Device;
          if (!(libDevice == null ? void 0 : libDevice.getByLcscIds)) {
            data = { error: "lib_Device.getByLcscIds not available" };
            break;
          }
          const lcscIds = (_na = cmd.params.lcscIds) != null ? _na : cmd.params.lcsc ? [cmd.params.lcsc] : [];
          const raw = await libDevice.getByLcscIds(lcscIds);
          const serialize = (obj) => {
            if (!obj || typeof obj !== "object")
              return obj;
            if (Array.isArray(obj))
              return obj.map(serialize);
            const out = {};
            for (const k of getAllKeys(obj)) {
              try {
                const v = obj[k];
                if (typeof v !== "function")
                  out[k] = v;
              } catch (e) {
              }
            }
            return out;
          };
          data = { count: Array.isArray(raw) ? raw.length : -1, raw: serialize(raw) };
          break;
        }
        case "sch_probe_create": {
          const api2 = anyEda();
          const sc = api2 == null ? void 0 : api2.sch_PrimitiveComponent;
          const { libraryUuid: lUuid2, componentUuid: cUuid2, x: px, y: py } = cmd.params;
          const pageInfo = await ((_pa = (_oa = api2 == null ? void 0 : api2.dmt_Schematic) == null ? void 0 : _oa.getCurrentSchematicPageInfo) == null ? void 0 : _pa.call(_oa));
          const pageUuid = (pageInfo == null ? void 0 : pageInfo.uuid) || ((_qa = pageInfo == null ? void 0 : pageInfo.getState_Uuid) == null ? void 0 : _qa.call(pageInfo)) || "";
          const tryCreate = async (args) => {
            return Promise.race([
              sc.create(...args),
              new Promise((_, rej) => setTimeout(() => rej(new Error("5s timeout")), 5e3))
            ]);
          };
          const attempts = [
            { label: "create({lUuid,uuid},x,y,0)", args: [{ libraryUuid: lUuid2, uuid: cUuid2 }, px, py, 0] },
            { label: "create({lUuid,uuid},x,y,0,false)", args: [{ libraryUuid: lUuid2, uuid: cUuid2 }, px, py, 0, false] },
            { label: "create({lUuid,uuid},pageUuid,x,y,0)", args: [{ libraryUuid: lUuid2, uuid: cUuid2 }, pageUuid, px, py, 0] },
            { label: "create({lUuid,uuid},pageUuid,x,y,0,false)", args: [{ libraryUuid: lUuid2, uuid: cUuid2 }, pageUuid, px, py, 0, false] }
          ];
          const results2 = { pageUuid };
          for (const { label, args } of attempts) {
            try {
              const r = await tryCreate(args);
              const id2 = ((_ra = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _ra.call(r)) || (r == null ? void 0 : r.primitiveId) || JSON.stringify(r);
              results2[label] = { ok: true, primitiveId: id2 };
              break;
            } catch (e) {
              results2[label] = { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
          }
          data = results2;
          break;
        }
        case "pcb_create_arc": {
          const arcApi = (_sa = anyEda()) == null ? void 0 : _sa.pcb_PrimitiveArc;
          if (!(arcApi == null ? void 0 : arcApi.create)) {
            data = { error: "pcb_PrimitiveArc.create not available" };
            break;
          }
          const { layer: al, net: an, cx: acx, cy: acy, radius: ar, startAngle: asa, endAngle: aea, width: aw } = cmd.params;
          try {
            const r = await arcApi.create(al || 1, an || "", acx || 0, acy || 0, ar || 100, asa || 0, aea || 180, aw || 6);
            const pid = ((_ta = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _ta.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_polyline": {
          const plApi = (_ua = anyEda()) == null ? void 0 : _ua.pcb_PrimitivePolyline;
          if (!(plApi == null ? void 0 : plApi.create)) {
            data = { error: "pcb_PrimitivePolyline.create not available" };
            break;
          }
          const { layer: pll, net: pln, points: plpts, width: plw } = cmd.params;
          if (!Array.isArray(plpts) || plpts.length < 2) {
            data = { error: "points array (min 2) required" };
            break;
          }
          try {
            const r = await plApi.create(pll || 1, pln || "", plpts, plw || 6);
            const pid = ((_va = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _va.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_dimension": {
          const dimApi = (_wa = anyEda()) == null ? void 0 : _wa.pcb_PrimitiveDimension;
          if (!(dimApi == null ? void 0 : dimApi.create)) {
            data = { error: "pcb_PrimitiveDimension.create not available" };
            break;
          }
          const { layer: dl, x1: dx1, y1: dy1, x2: dx2, y2: dy2 } = cmd.params;
          try {
            const r = await dimApi.create(dl || 1, dx1 || 0, dy1 || 0, dx2 || 100, dy2 || 0);
            const pid = ((_xa = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _xa.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_fill": {
          const fillApi = (_ya = anyEda()) == null ? void 0 : _ya.pcb_PrimitiveFill;
          if (!(fillApi == null ? void 0 : fillApi.create)) {
            data = { error: "pcb_PrimitiveFill.create not available" };
            break;
          }
          const { layer: fll, net: fln, points: flpts } = cmd.params;
          if (!Array.isArray(flpts) || flpts.length < 3) {
            data = { error: "points array (min 3) required" };
            break;
          }
          try {
            const r = await fillApi.create(fll || 1, fln || "", flpts);
            const pid = ((_za = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _za.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_pad": {
          const padApi = (_Aa = anyEda()) == null ? void 0 : _Aa.pcb_PrimitivePad;
          if (!(padApi == null ? void 0 : padApi.create)) {
            data = { error: "pcb_PrimitivePad.create not available" };
            break;
          }
          try {
            const r = await padApi.create(cmd.params);
            const pid = ((_Ba = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Ba.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_modify_pad": {
          const padApi = (_Ca = anyEda()) == null ? void 0 : _Ca.pcb_PrimitivePad;
          if (!(padApi == null ? void 0 : padApi.modify)) {
            data = { error: "pcb_PrimitivePad.modify not available" };
            break;
          }
          const { primitiveId: mpadId, ...mpadProps } = cmd.params;
          if (!mpadId) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            await padApi.modify(mpadId, mpadProps);
            data = { success: true, primitiveId: mpadId };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_all_arcs": {
          const arcApi = (_Da = anyEda()) == null ? void 0 : _Da.pcb_PrimitiveArc;
          if (!(arcApi == null ? void 0 : arcApi.getAll)) {
            data = { error: "pcb_PrimitiveArc.getAll not available" };
            break;
          }
          try {
            const arcs = await arcApi.getAll();
            data = { arcs: Array.isArray(arcs) ? arcs.map(serializeResult) : serializeResult(arcs) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_adjacent": {
          const iArcApi = ((_Ea = anyEda()) == null ? void 0 : _Ea.ipcb_PrimitiveArc) || ((_Fa = anyEda()) == null ? void 0 : _Fa.pcb_PrimitiveArc);
          if (!(iArcApi == null ? void 0 : iArcApi.getAdjacentPrimitives)) {
            data = { error: "getAdjacentPrimitives not available" };
            break;
          }
          const { primitiveId: gadj } = cmd.params;
          if (!gadj) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            const adj = await iArcApi.getAdjacentPrimitives(gadj);
            data = { adjacent: Array.isArray(adj) ? adj.map(serializeResult) : serializeResult(adj) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_entire_track": {
          const iLineApi = ((_Ga = anyEda()) == null ? void 0 : _Ga.ipcb_PrimitiveLine) || ((_Ha = anyEda()) == null ? void 0 : _Ha.pcb_PrimitiveLine);
          if (!(iLineApi == null ? void 0 : iLineApi.getEntireTrack)) {
            data = { error: "getEntireTrack not available" };
            break;
          }
          const { primitiveId: getid } = cmd.params;
          if (!getid) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            const track = await iLineApi.getEntireTrack(getid);
            data = { track: Array.isArray(track) ? track.map(serializeResult) : serializeResult(track) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_convert_fill_to_pour": {
          const iFillApi = ((_Ia = anyEda()) == null ? void 0 : _Ia.ipcb_PrimitiveFill) || ((_Ja = anyEda()) == null ? void 0 : _Ja.pcb_PrimitiveFill);
          if (!(iFillApi == null ? void 0 : iFillApi.convertToPour)) {
            data = { error: "convertToPour not available" };
            break;
          }
          const { primitiveId: cfpid } = cmd.params;
          if (!cfpid) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            const r = await iFillApi.convertToPour(cfpid);
            data = { success: true, result: serializeResult(r) };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_net_length": {
          const netApi = (_Ka = anyEda()) == null ? void 0 : _Ka.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.getNetLength)) {
            data = { error: "getNetLength not available" };
            break;
          }
          const { net: gnlNet } = cmd.params;
          if (!gnlNet) {
            data = { error: "net required" };
            break;
          }
          try {
            const length = await netApi.getNetLength(gnlNet);
            data = { net: gnlNet, length };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_highlight_net": {
          const netApi = (_La = anyEda()) == null ? void 0 : _La.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.highlightNet)) {
            data = { error: "highlightNet not available" };
            break;
          }
          const { net: hnNet } = cmd.params;
          if (!hnNet) {
            data = { error: "net required" };
            break;
          }
          try {
            await netApi.highlightNet(hnNet);
            data = { success: true, net: hnNet };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_unhighlight_all": {
          const netApi = (_Ma = anyEda()) == null ? void 0 : _Ma.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.unhighlightAllNets)) {
            data = { error: "unhighlightAllNets not available" };
            break;
          }
          try {
            await netApi.unhighlightAllNets();
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_select_net": {
          const netApi = (_Na = anyEda()) == null ? void 0 : _Na.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.selectNet)) {
            data = { error: "selectNet not available" };
            break;
          }
          const { net: snNet } = cmd.params;
          if (!snNet) {
            data = { error: "net required" };
            break;
          }
          try {
            await netApi.selectNet(snNet);
            data = { success: true, net: snNet };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_set_net_color": {
          const netApi = (_Oa = anyEda()) == null ? void 0 : _Oa.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.setNetColor)) {
            data = { error: "setNetColor not available" };
            break;
          }
          const { net: sncNet, color: sncColor } = cmd.params;
          if (!sncNet || !sncColor) {
            data = { error: "net and color required" };
            break;
          }
          try {
            await netApi.setNetColor(sncNet, sncColor);
            data = { success: true, net: sncNet, color: sncColor };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_netlist_data": {
          const netApi = (_Pa = anyEda()) == null ? void 0 : _Pa.pcb_Net;
          if (!(netApi == null ? void 0 : netApi.getNetList)) {
            data = { error: "getNetList not available" };
            break;
          }
          try {
            const netlist = await netApi.getNetList();
            data = { netlist: serializeResult(netlist) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_net_class": {
          const drcApi = (_Qa = anyEda()) == null ? void 0 : _Qa.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.createNetClass)) {
            data = { error: "createNetClass not available" };
            break;
          }
          const { name: ncName, ...ncProps } = cmd.params;
          if (!ncName) {
            data = { error: "name required" };
            break;
          }
          try {
            const r = await drcApi.createNetClass(ncName, ncProps);
            data = { success: true, result: serializeResult(r) };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_all_net_classes": {
          const drcApi = (_Ra = anyEda()) == null ? void 0 : _Ra.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.getAllNetClasses)) {
            data = { error: "getAllNetClasses not available" };
            break;
          }
          try {
            const classes = await drcApi.getAllNetClasses();
            data = { classes: Array.isArray(classes) ? classes.map(serializeResult) : serializeResult(classes) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_add_net_to_class": {
          const drcApi = (_Sa = anyEda()) == null ? void 0 : _Sa.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.addNetToNetClass)) {
            data = { error: "addNetToNetClass not available" };
            break;
          }
          const { className: antcClass, net: antcNet } = cmd.params;
          if (!antcClass || !antcNet) {
            data = { error: "className and net required" };
            break;
          }
          try {
            await drcApi.addNetToNetClass(antcClass, antcNet);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_rule_configs": {
          const drcApi = (_Ta = anyEda()) == null ? void 0 : _Ta.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.getAllRuleConfigurations)) {
            data = { error: "getAllRuleConfigurations not available" };
            break;
          }
          try {
            const configs = await drcApi.getAllRuleConfigurations();
            data = { configs: Array.isArray(configs) ? configs.map(serializeResult) : serializeResult(configs) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_set_rule_config": {
          const drcApi = (_Ua = anyEda()) == null ? void 0 : _Ua.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.setRuleConfiguration)) {
            data = { error: "setRuleConfiguration not available" };
            break;
          }
          try {
            await drcApi.setRuleConfiguration(cmd.params);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_export_rules": {
          const drcApi = (_Va = anyEda()) == null ? void 0 : _Va.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.exportRuleConfiguration)) {
            data = { error: "exportRuleConfiguration not available" };
            break;
          }
          try {
            const result = await drcApi.exportRuleConfiguration();
            data = typeof result === "string" ? { success: true, content: result, size: result.length } : { success: true, result: serializeResult(result) };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_import_rules": {
          const drcApi = (_Wa = anyEda()) == null ? void 0 : _Wa.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.importRuleConfiguration)) {
            data = { error: "importRuleConfiguration not available" };
            break;
          }
          const { content: ruleContent } = cmd.params;
          if (!ruleContent) {
            data = { error: "content required" };
            break;
          }
          try {
            await drcApi.importRuleConfiguration(ruleContent);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_net_rules": {
          const drcApi = (_Xa = anyEda()) == null ? void 0 : _Xa.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.getNetRules)) {
            data = { error: "getNetRules not available" };
            break;
          }
          const { net: gnrNet } = cmd.params;
          try {
            const rules = gnrNet ? await drcApi.getNetRules(gnrNet) : await drcApi.getNetRules();
            data = { rules: serializeResult(rules) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_create_pad_pair_group": {
          const drcApi = (_Ya = anyEda()) == null ? void 0 : _Ya.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.createPadPairGroup)) {
            data = { error: "createPadPairGroup not available" };
            break;
          }
          const { name: ppgName, pairs: ppgPairs } = cmd.params;
          if (!ppgName || !Array.isArray(ppgPairs)) {
            data = { error: "name and pairs array required" };
            break;
          }
          try {
            const r = await drcApi.createPadPairGroup(ppgName, ppgPairs);
            data = { success: true, result: serializeResult(r) };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_pad_pair_min_wire": {
          const drcApi = (_Za = anyEda()) == null ? void 0 : _Za.pcb_Drc;
          if (!(drcApi == null ? void 0 : drcApi.getPadPairGroupMinWireLength)) {
            data = { error: "getPadPairGroupMinWireLength not available" };
            break;
          }
          const { name: ppmwName } = cmd.params;
          if (!ppmwName) {
            data = { error: "name required" };
            break;
          }
          try {
            const length = await drcApi.getPadPairGroupMinWireLength(ppmwName);
            data = { name: ppmwName, minWireLength: length };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_navigate_to": {
          const docApi = (__a = anyEda()) == null ? void 0 : __a.pcb_Document;
          if (!(docApi == null ? void 0 : docApi.navigateToCoordinates)) {
            data = { error: "navigateToCoordinates not available" };
            break;
          }
          const { x: navX, y: navY } = cmd.params;
          try {
            await docApi.navigateToCoordinates(navX || 0, navY || 0);
            data = { success: true, x: navX, y: navY };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_navigate_to_region": {
          const docApi = (_$a = anyEda()) == null ? void 0 : _$a.pcb_Document;
          if (!(docApi == null ? void 0 : docApi.navigateToRegion)) {
            data = { error: "navigateToRegion not available" };
            break;
          }
          const { x1: nrx1, y1: nry1, x2: nrx2, y2: nry2 } = cmd.params;
          try {
            await docApi.navigateToRegion(nrx1 || 0, nry1 || 0, nrx2 || 1e3, nry2 || 1e3);
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_zoom_to_outline": {
          const docApi = (_ab = anyEda()) == null ? void 0 : _ab.pcb_Document;
          if (!(docApi == null ? void 0 : docApi.zoomToBoardOutline)) {
            data = { error: "zoomToBoardOutline not available" };
            break;
          }
          try {
            await docApi.zoomToBoardOutline();
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_canvas_to_data": {
          const docApi = (_bb = anyEda()) == null ? void 0 : _bb.pcb_Document;
          if (!(docApi == null ? void 0 : docApi.convertCanvasOriginToDataOrigin)) {
            data = { error: "convertCanvasOriginToDataOrigin not available" };
            break;
          }
          const { x: cdx, y: cdy } = cmd.params;
          try {
            const result = await docApi.convertCanvasOriginToDataOrigin(cdx || 0, cdy || 0);
            data = { result: serializeResult(result) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "pcb_get_primitives_in_region": {
          const docApi = (_cb = anyEda()) == null ? void 0 : _cb.pcb_Document;
          if (!(docApi == null ? void 0 : docApi.getPrimitivesInRegion)) {
            data = { error: "getPrimitivesInRegion not available" };
            break;
          }
          const { x1: pirx1, y1: piry1, x2: pirx2, y2: piry2, layers: pirLayers } = cmd.params;
          try {
            const prims = await docApi.getPrimitivesInRegion(pirx1 || 0, piry1 || 0, pirx2 || 1e3, piry2 || 1e3, pirLayers);
            data = { primitives: Array.isArray(prims) ? prims.map(serializeResult) : serializeResult(prims) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_search_device": {
          const libApi = (_db = anyEda()) == null ? void 0 : _db.lib_Device;
          if (!(libApi == null ? void 0 : libApi.search)) {
            data = { error: "lib_Device.search not available" };
            break;
          }
          const { keyword: lsdKw, limit: lsdLim } = cmd.params;
          try {
            const res = await libApi.search(lsdKw || "", lsdLim || 20);
            data = { results: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_device": {
          const libApi = (_eb = anyEda()) == null ? void 0 : _eb.lib_Device;
          if (!(libApi == null ? void 0 : libApi.get)) {
            data = { error: "lib_Device.get not available" };
            break;
          }
          const { uuid: lgdUuid } = cmd.params;
          if (!lgdUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            const res = await libApi.get(lgdUuid);
            data = serializeResult(res);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_by_lcsc": {
          const libApi = (_fb = anyEda()) == null ? void 0 : _fb.lib_Device;
          if (!(libApi == null ? void 0 : libApi.getByLcscIds)) {
            data = { error: "lib_Device.getByLcscIds not available" };
            break;
          }
          const { lcscIds } = cmd.params;
          if (!lcscIds || !Array.isArray(lcscIds)) {
            data = { error: "lcscIds array required" };
            break;
          }
          try {
            const res = await libApi.getByLcscIds(lcscIds);
            data = { results: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_search_footprint": {
          const libApi = (_gb = anyEda()) == null ? void 0 : _gb.lib_Footprint;
          if (!(libApi == null ? void 0 : libApi.search)) {
            data = { error: "lib_Footprint.search not available" };
            break;
          }
          const { keyword: lsfKw, limit: lsfLim } = cmd.params;
          try {
            const res = await libApi.search(lsfKw || "", lsfLim || 20);
            data = { results: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_footprint": {
          const libApi = (_hb = anyEda()) == null ? void 0 : _hb.lib_Footprint;
          if (!(libApi == null ? void 0 : libApi.get)) {
            data = { error: "lib_Footprint.get not available" };
            break;
          }
          const { uuid: lgfUuid } = cmd.params;
          if (!lgfUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            const res = await libApi.get(lgfUuid);
            data = serializeResult(res);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_render_footprint": {
          const libApi = (_ib = anyEda()) == null ? void 0 : _ib.lib_Footprint;
          if (!(libApi == null ? void 0 : libApi.getRenderImage)) {
            data = { error: "lib_Footprint.getRenderImage not available" };
            break;
          }
          const { uuid: lrfUuid } = cmd.params;
          if (!lrfUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            const img = await libApi.getRenderImage(lrfUuid);
            data = serializeExportResult(img);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_search_symbol": {
          const libApi = (_jb = anyEda()) == null ? void 0 : _jb.lib_Symbol;
          if (!(libApi == null ? void 0 : libApi.search)) {
            data = { error: "lib_Symbol.search not available" };
            break;
          }
          const { keyword: lssKw, limit: lssLim } = cmd.params;
          try {
            const res = await libApi.search(lssKw || "", lssLim || 20);
            data = { results: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_symbol": {
          const libApi = (_kb = anyEda()) == null ? void 0 : _kb.lib_Symbol;
          if (!(libApi == null ? void 0 : libApi.get)) {
            data = { error: "lib_Symbol.get not available" };
            break;
          }
          const { uuid: lgsUuid } = cmd.params;
          if (!lgsUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            const res = await libApi.get(lgsUuid);
            data = serializeResult(res);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_render_symbol": {
          const libApi = (_lb = anyEda()) == null ? void 0 : _lb.lib_Symbol;
          if (!(libApi == null ? void 0 : libApi.getRenderImage)) {
            data = { error: "lib_Symbol.getRenderImage not available" };
            break;
          }
          const { uuid: lrsUuid } = cmd.params;
          if (!lrsUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            const img = await libApi.getRenderImage(lrsUuid);
            data = serializeExportResult(img);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_search_3dmodel": {
          const libApi = (_mb = anyEda()) == null ? void 0 : _mb.lib_3DModel;
          if (!(libApi == null ? void 0 : libApi.search)) {
            data = { error: "lib_3DModel.search not available" };
            break;
          }
          const { keyword: ls3Kw, limit: ls3Lim } = cmd.params;
          try {
            const res = await libApi.search(ls3Kw || "", ls3Lim || 20);
            data = { results: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_libraries_list": {
          const libApi = (_nb = anyEda()) == null ? void 0 : _nb.lib_LibrariesList;
          if (!(libApi == null ? void 0 : libApi.getAllLibrariesList)) {
            data = { error: "lib_LibrariesList.getAllLibrariesList not available" };
            break;
          }
          try {
            const res = await libApi.getAllLibrariesList();
            data = { libraries: Array.isArray(res) ? res.map(serializeResult) : serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "lib_get_classification": {
          const libApi = (_ob = anyEda()) == null ? void 0 : _ob.lib_Classification;
          if (!(libApi == null ? void 0 : libApi.getAllClassificationTree)) {
            data = { error: "lib_Classification.getAllClassificationTree not available" };
            break;
          }
          try {
            const res = await libApi.getAllClassificationTree();
            data = { tree: serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "editor_zoom_to": {
          const editorApi = (_pb = anyEda()) == null ? void 0 : _pb.dmt_EditorControl;
          if (!(editorApi == null ? void 0 : editorApi.zoomTo)) {
            data = { error: "dmt_EditorControl.zoomTo not available" };
            break;
          }
          const { uuid: ezUuid, x: ezX, y: ezY, scale: ezScale } = cmd.params;
          try {
            const res = await editorApi.zoomTo(ezUuid, ezX, ezY, ezScale);
            data = { success: true, result: serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "editor_zoom_to_selected": {
          const editorApi = (_qb = anyEda()) == null ? void 0 : _qb.dmt_EditorControl;
          if (!(editorApi == null ? void 0 : editorApi.zoomToSelectedPrimitives)) {
            data = { error: "dmt_EditorControl.zoomToSelectedPrimitives not available" };
            break;
          }
          try {
            await editorApi.zoomToSelectedPrimitives();
            data = { success: true };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "editor_generate_markers": {
          const editorApi = (_rb = anyEda()) == null ? void 0 : _rb.dmt_EditorControl;
          if (!(editorApi == null ? void 0 : editorApi.generateIndicatorMarkers)) {
            data = { error: "dmt_EditorControl.generateIndicatorMarkers not available" };
            break;
          }
          const { markers: egMarkers } = cmd.params;
          try {
            const res = await editorApi.generateIndicatorMarkers(egMarkers || []);
            data = { success: true, result: serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "editor_remove_markers": {
          const editorApi = (_sb = anyEda()) == null ? void 0 : _sb.dmt_EditorControl;
          if (!(editorApi == null ? void 0 : editorApi.removeIndicatorMarkers)) {
            data = { error: "dmt_EditorControl.removeIndicatorMarkers not available" };
            break;
          }
          try {
            await editorApi.removeIndicatorMarkers();
            data = { success: true };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "editor_get_screenshot": {
          const editorApi = (_tb = anyEda()) == null ? void 0 : _tb.dmt_EditorControl;
          if (!(editorApi == null ? void 0 : editorApi.getCurrentRenderedAreaImage)) {
            data = { error: "dmt_EditorControl.getCurrentRenderedAreaImage not available" };
            break;
          }
          const { format: egsFormat } = cmd.params;
          try {
            const img = await editorApi.getCurrentRenderedAreaImage(egsFormat || "png");
            data = serializeExportResult(img);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_get_environment": {
          const sysApi = (_ub = anyEda()) == null ? void 0 : _ub.sys_Environment;
          if (!sysApi) {
            data = { error: "sys_Environment not available" };
            break;
          }
          try {
            const keys = ["getVersion", "getLanguage", "getOS", "getTheme", "getPlatform"];
            const env = {};
            for (const k of keys) {
              if (typeof sysApi[k] === "function") {
                try {
                  env[k.replace("get", "").toLowerCase()] = await sysApi[k]();
                } catch (e) {
                }
              }
            }
            data = env;
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_unit_convert": {
          const { value: sucVal, from: sucFrom, to: sucTo } = cmd.params;
          if (sucVal === void 0 || !sucFrom || !sucTo) {
            data = { error: "value, from, to required" };
            break;
          }
          const sysApi = (_vb = anyEda()) == null ? void 0 : _vb.sys_Unit;
          try {
            if (sysApi) {
              const methodMap = {
                "mil->mm": "milToMm",
                "mm->mil": "mmToMil",
                "mil->inch": "milToInch",
                "inch->mil": "inchToMil",
                "mm->inch": "mmToInch",
                "inch->mm": "inchToMm"
              };
              const methodName = methodMap[`${sucFrom}->${sucTo}`];
              if (methodName && typeof sysApi[methodName] === "function") {
                const result2 = await sysApi[methodName](sucVal);
                data = { input: sucVal, from: sucFrom, to: sucTo, result: result2 };
                break;
              }
            }
            const toMil = (v, unit) => {
              if (unit === "mil")
                return v;
              if (unit === "mm")
                return v / 0.0254;
              if (unit === "inch")
                return v * 1e3;
              return v;
            };
            const fromMil = (v, unit) => {
              if (unit === "mil")
                return v;
              if (unit === "mm")
                return v * 0.0254;
              if (unit === "inch")
                return v / 1e3;
              return v;
            };
            const result = fromMil(toMil(sucVal, sucFrom), sucTo);
            data = { input: sucVal, from: sucFrom, to: sucTo, result };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_show_toast": {
          const sysApi = (_wb = anyEda()) == null ? void 0 : _wb.sys_Message;
          if (!(sysApi == null ? void 0 : sysApi.showToastMessage)) {
            data = { error: "sys_Message.showToastMessage not available" };
            break;
          }
          const { message: stMsg, type: stType, duration: stDur } = cmd.params;
          try {
            await sysApi.showToastMessage(stMsg || "", stType || "info", stDur || 3e3);
            data = { success: true };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_file_save": {
          const sysApi = (_xb = anyEda()) == null ? void 0 : _xb.sys_FileSystem;
          if (!(sysApi == null ? void 0 : sysApi.saveFileToFileSystem)) {
            data = { error: "sys_FileSystem.saveFileToFileSystem not available" };
            break;
          }
          const { filename: sfsName, content: sfsContent, encoding: sfsEnc } = cmd.params;
          if (!sfsName || sfsContent === void 0) {
            data = { error: "filename and content required" };
            break;
          }
          try {
            const res = await sysApi.saveFileToFileSystem(sfsName, sfsContent, sfsEnc || "utf-8");
            data = { success: true, result: serializeResult(res) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_file_read": {
          const sysApi = (_yb = anyEda()) == null ? void 0 : _yb.sys_FileSystem;
          if (!(sysApi == null ? void 0 : sysApi.readFileFromFileSystem)) {
            data = { error: "sys_FileSystem.readFileFromFileSystem not available" };
            break;
          }
          const { filename: sfrName, encoding: sfrEnc } = cmd.params;
          if (!sfrName) {
            data = { error: "filename required" };
            break;
          }
          try {
            const content = await sysApi.readFileFromFileSystem(sfrName, sfrEnc || "utf-8");
            data = { filename: sfrName, content };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sys_import_project": {
          const sysApi = (_zb = anyEda()) == null ? void 0 : _zb.sys_FileManager;
          if (!(sysApi == null ? void 0 : sysApi.importProjectByProjectFile)) {
            data = { error: "sys_FileManager.importProjectByProjectFile not available" };
            break;
          }
          const { filePath: sipPath } = cmd.params;
          if (!sipPath) {
            data = { error: "filePath required" };
            break;
          }
          try {
            const res = await sysApi.importProjectByProjectFile(sipPath);
            data = serializeResult(res);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_project_get_info": {
          const projApi = (_Ab = anyEda()) == null ? void 0 : _Ab.dmt_Project;
          if (!(projApi == null ? void 0 : projApi.getCurrentProjectInfo)) {
            data = { error: "getCurrentProjectInfo not available" };
            break;
          }
          try {
            const info = await projApi.getCurrentProjectInfo();
            data = serializeResult(info);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_project_get_all": {
          const projApi = (_Bb = anyEda()) == null ? void 0 : _Bb.dmt_Project;
          if (!(projApi == null ? void 0 : projApi.getAllProjectsUuid)) {
            data = { error: "getAllProjectsUuid not available" };
            break;
          }
          try {
            const list = await projApi.getAllProjectsUuid();
            data = { projects: Array.isArray(list) ? list.map(serializeResult) : serializeResult(list) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_project_create": {
          const projApi = (_Cb = anyEda()) == null ? void 0 : _Cb.dmt_Project;
          if (!(projApi == null ? void 0 : projApi.createProject)) {
            data = { error: "createProject not available" };
            break;
          }
          const { name: pName, description: pDesc } = cmd.params;
          if (!pName) {
            data = { error: "name required" };
            break;
          }
          try {
            const result = await projApi.createProject(pName, pDesc || "");
            data = serializeResult(result);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_project_open": {
          const projApi = (_Db = anyEda()) == null ? void 0 : _Db.dmt_Project;
          if (!(projApi == null ? void 0 : projApi.openProject)) {
            data = { error: "openProject not available" };
            break;
          }
          const { uuid: projUuid } = cmd.params;
          if (!projUuid) {
            data = { error: "uuid required" };
            break;
          }
          try {
            await projApi.openProject(projUuid);
            data = { success: true, uuid: projUuid };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_schematic_get_all": {
          const schApi = (_Eb = anyEda()) == null ? void 0 : _Eb.dmt_Schematic;
          if (!(schApi == null ? void 0 : schApi.getAllSchematicsInfo)) {
            data = { error: "getAllSchematicsInfo not available" };
            break;
          }
          try {
            const list = await schApi.getAllSchematicsInfo();
            data = { schematics: Array.isArray(list) ? list.map(serializeResult) : serializeResult(list) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_schematic_create_page": {
          const schApi = (_Fb = anyEda()) == null ? void 0 : _Fb.dmt_Schematic;
          if (!(schApi == null ? void 0 : schApi.createSchematicPage)) {
            data = { error: "createSchematicPage not available" };
            break;
          }
          const { schematicUuid: sUuid, name: spName } = cmd.params;
          if (!sUuid) {
            data = { error: "schematicUuid required" };
            break;
          }
          try {
            const result = await schApi.createSchematicPage(sUuid, spName || "Sheet1");
            data = serializeResult(result);
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_schematic_get_pages": {
          const schApi = (_Gb = anyEda()) == null ? void 0 : _Gb.dmt_Schematic;
          if (!(schApi == null ? void 0 : schApi.getAllSchematicPagesInfo)) {
            data = { error: "getAllSchematicPagesInfo not available" };
            break;
          }
          const { schematicUuid: sUuid2 } = cmd.params;
          try {
            const pages = sUuid2 ? await schApi.getAllSchematicPagesInfo(sUuid2) : await ((_Hb = schApi.getAllSchematicPagesInfo) == null ? void 0 : _Hb.call(schApi));
            data = { pages: Array.isArray(pages) ? pages.map(serializeResult) : serializeResult(pages) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "dmt_board_get_all": {
          const boardApi = (_Ib = anyEda()) == null ? void 0 : _Ib.dmt_Board;
          if (!(boardApi == null ? void 0 : boardApi.getAllBoardsInfo)) {
            data = { error: "getAllBoardsInfo not available" };
            break;
          }
          try {
            const list = await boardApi.getAllBoardsInfo();
            data = { boards: Array.isArray(list) ? list.map(serializeResult) : serializeResult(list) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_net_flag": {
          const sc = (_Jb = anyEda()) == null ? void 0 : _Jb.sch_PrimitiveComponent;
          if (!(sc == null ? void 0 : sc.createNetFlag)) {
            data = { error: "createNetFlag not available" };
            break;
          }
          const { x: nfx, y: nfy, name: nfName, rotation: nfRot } = cmd.params;
          try {
            const r = await sc.createNetFlag(nfName || "GND", nfx || 0, nfy || 0, nfRot || 0);
            const pid = ((_Kb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Kb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_net_port": {
          const sc = (_Lb = anyEda()) == null ? void 0 : _Lb.sch_PrimitiveComponent;
          if (!(sc == null ? void 0 : sc.createNetPort)) {
            data = { error: "createNetPort not available" };
            break;
          }
          const { x: npx, y: npy, name: npName, rotation: npRot } = cmd.params;
          try {
            const r = await sc.createNetPort(npName || "PORT", npx || 0, npy || 0, npRot || 0);
            const pid = ((_Mb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Mb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_rectangle": {
          const rectApi = (_Nb = anyEda()) == null ? void 0 : _Nb.sch_PrimitiveRectangle;
          if (!(rectApi == null ? void 0 : rectApi.create)) {
            data = { error: "sch_PrimitiveRectangle.create not available" };
            break;
          }
          const { x1: rx1, y1: ry1, x2: rx2, y2: ry2 } = cmd.params;
          try {
            const r = await rectApi.create(rx1 || 0, ry1 || 0, rx2 || 100, ry2 || 100);
            const pid = ((_Ob = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Ob.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_text": {
          const txtApi = (_Pb = anyEda()) == null ? void 0 : _Pb.sch_PrimitiveText;
          if (!(txtApi == null ? void 0 : txtApi.create)) {
            data = { error: "sch_PrimitiveText.create not available" };
            break;
          }
          const { x: stx, y: sty, text: stText, fontSize: stFs, rotation: stRot } = cmd.params;
          try {
            const r = await txtApi.create(stText || "", stx || 0, sty || 0, stRot || 0, stFs || 14);
            const pid = ((_Qb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Qb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_circle": {
          const circApi = (_Rb = anyEda()) == null ? void 0 : _Rb.sch_PrimitiveCircle;
          if (!(circApi == null ? void 0 : circApi.create)) {
            data = { error: "sch_PrimitiveCircle.create not available" };
            break;
          }
          const { x: cx, y: cy, radius: cr } = cmd.params;
          try {
            const r = await circApi.create(cx || 0, cy || 0, cr || 50);
            const pid = ((_Sb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Sb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_polygon": {
          const polyApi = (_Tb = anyEda()) == null ? void 0 : _Tb.sch_PrimitivePolygon;
          if (!(polyApi == null ? void 0 : polyApi.create)) {
            data = { error: "sch_PrimitivePolygon.create not available" };
            break;
          }
          const { points: polyPts } = cmd.params;
          if (!Array.isArray(polyPts) || polyPts.length < 3) {
            data = { error: "points array (min 3) required" };
            break;
          }
          try {
            const r = await polyApi.create(polyPts);
            const pid = ((_Ub = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Ub.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_arc": {
          const arcApi = (_Vb = anyEda()) == null ? void 0 : _Vb.sch_PrimitiveArc;
          if (!(arcApi == null ? void 0 : arcApi.create)) {
            data = { error: "sch_PrimitiveArc.create not available" };
            break;
          }
          const { cx: acx, cy: acy, radius: ar, startAngle, endAngle } = cmd.params;
          try {
            const r = await arcApi.create(acx || 0, acy || 0, ar || 50, startAngle || 0, endAngle || 180);
            const pid = ((_Wb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Wb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_create_bus": {
          const busApi = (_Xb = anyEda()) == null ? void 0 : _Xb.sch_PrimitiveBus;
          if (!(busApi == null ? void 0 : busApi.create)) {
            data = { error: "sch_PrimitiveBus.create not available" };
            break;
          }
          const { points: busPts } = cmd.params;
          if (!Array.isArray(busPts) || busPts.length < 2) {
            data = { error: "points array (min 2) required" };
            break;
          }
          try {
            const r = await busApi.create(busPts);
            const pid = ((_Yb = r == null ? void 0 : r.getState_PrimitiveId) == null ? void 0 : _Yb.call(r)) || (r == null ? void 0 : r.primitiveId) || "";
            data = { success: true, primitiveId: pid };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_get_all_components": {
          const sc = (_Zb = anyEda()) == null ? void 0 : _Zb.sch_PrimitiveComponent;
          if (!(sc == null ? void 0 : sc.getAll)) {
            data = { error: "sch_PrimitiveComponent.getAll not available" };
            break;
          }
          try {
            const list = await sc.getAll();
            data = { components: Array.isArray(list) ? list.map(serializeResult) : serializeResult(list) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_get_component_pins": {
          const sc = (__b = anyEda()) == null ? void 0 : __b.sch_PrimitiveComponent;
          if (!(sc == null ? void 0 : sc.getAllPinsByPrimitiveId)) {
            data = { error: "getAllPinsByPrimitiveId not available" };
            break;
          }
          const { primitiveId: cpid } = cmd.params;
          if (!cpid) {
            data = { error: "primitiveId required" };
            break;
          }
          try {
            const pins = await sc.getAllPinsByPrimitiveId(cpid);
            data = { pins: Array.isArray(pins) ? pins.map(serializeResult) : serializeResult(pins) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_auto_layout": {
          const docApi = (_$b = anyEda()) == null ? void 0 : _$b.sch_Document;
          if (!(docApi == null ? void 0 : docApi.autoLayout)) {
            data = { error: "sch_Document.autoLayout not available" };
            break;
          }
          try {
            await docApi.autoLayout();
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_import_changes": {
          const docApi = (_ac = anyEda()) == null ? void 0 : _ac.sch_Document;
          if (!(docApi == null ? void 0 : docApi.importChanges)) {
            data = { error: "sch_Document.importChanges not available" };
            break;
          }
          try {
            await docApi.importChanges();
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_export_bom": {
          const mfgApi = (_bc = anyEda()) == null ? void 0 : _bc.sch_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getBomFile)) {
            data = { error: "sch_ManufactureData.getBomFile not available" };
            break;
          }
          try {
            const result = await mfgApi.getBomFile();
            data = serializeExportResult(result, "sch_bom");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_export_netlist_file": {
          const mfgApi = (_cc = anyEda()) == null ? void 0 : _cc.sch_ManufactureData;
          if (!(mfgApi == null ? void 0 : mfgApi.getNetlistFile)) {
            data = { error: "sch_ManufactureData.getNetlistFile not available" };
            break;
          }
          const { type: nlType } = cmd.params;
          try {
            const result = await mfgApi.getNetlistFile(nlType);
            data = serializeExportResult(result, "sch_netlist");
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_get_selected": {
          const selApi = (_dc = anyEda()) == null ? void 0 : _dc.sch_SelectControl;
          if (!(selApi == null ? void 0 : selApi.getAllSelectedPrimitives)) {
            data = { error: "getAllSelectedPrimitives not available" };
            break;
          }
          try {
            const selected = await selApi.getAllSelectedPrimitives();
            data = { selected: Array.isArray(selected) ? selected.map(serializeResult) : serializeResult(selected) };
          } catch (e) {
            data = { error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_select_primitives": {
          const selApi = (_ec = anyEda()) == null ? void 0 : _ec.sch_SelectControl;
          if (!(selApi == null ? void 0 : selApi.doSelectPrimitives)) {
            data = { error: "doSelectPrimitives not available" };
            break;
          }
          const { primitiveIds: spids } = cmd.params;
          if (!Array.isArray(spids)) {
            data = { error: "primitiveIds array required" };
            break;
          }
          try {
            await selApi.doSelectPrimitives(spids);
            data = { success: true, count: spids.length };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        case "sch_clear_selected": {
          const selApi = (_fc = anyEda()) == null ? void 0 : _fc.sch_SelectControl;
          if (!(selApi == null ? void 0 : selApi.clearSelected)) {
            data = { error: "clearSelected not available" };
            break;
          }
          try {
            await selApi.clearSelected();
            data = { success: true };
          } catch (e) {
            data = { success: false, error: e instanceof Error ? e.message : String(e) };
          }
          break;
        }
        default:
          throw new Error(`unknown action: ${cmd.action}`);
      }
      return { id: cmd.id, success: true, data, durationMs: Date.now() - start };
    } catch (error) {
      return {
        id: cmd.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start
      };
    }
  }
  async function readCommand() {
    const content = await readTextFile(COMMAND_FILE);
    if (!content || !content.trim())
      return null;
    try {
      const cmd = JSON.parse(content);
      if (!cmd || typeof cmd.timestamp !== "number")
        return null;
      if (cmd.timestamp <= lastCommandTime)
        return null;
      return cmd;
    } catch (e) {
      return null;
    }
  }
  async function clearCommand() {
    await writeTextFile(COMMAND_FILE, "");
  }
  async function writeResult(result) {
    await writeTextFile(RESULT_FILE, JSON.stringify(result, null, 2));
  }
  async function pollOnceViaHttp() {
    const g = globalThis;
    if (typeof g.fetch !== "function")
      return false;
    try {
      const resp = await g.fetch(`${HTTP_BASE}/api/command`);
      if (!resp)
        return false;
      if (resp.status === 204)
        return true;
      if (resp.status !== 200)
        return false;
      const text = await resp.text();
      if (!text || !text.trim())
        return true;
      let cmd;
      try {
        cmd = JSON.parse(text);
      } catch (e) {
        return true;
      }
      if (!cmd || typeof cmd.timestamp !== "number")
        return true;
      if (cmd.timestamp <= lastCommandTime)
        return true;
      lastCommandTime = cmd.timestamp;
      log(`executing command (http): ${cmd.action} id=${cmd.id}`);
      const result = await executeCommand(cmd);
      log(`command done (http): ${cmd.action} id=${cmd.id} -> ${result.success ? "ok" : result.error}`);
      let resultDelivered = false;
      try {
        const postResp = await g.fetch(`${HTTP_BASE}/api/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result)
        });
        if (postResp && (postResp.status === 200 || postResp.ok)) {
          resultDelivered = true;
          log(`result delivered via HTTP POST: id=${result.id}`);
        } else {
          log(`result POST returned status=${postResp == null ? void 0 : postResp.status}, falling back to file`);
        }
      } catch (e) {
        log(`result POST failed (${e instanceof Error ? e.message : String(e)}), falling back to file`);
      }
      if (!resultDelivered) {
        await writeTextFile(RESULT_FILE, JSON.stringify(result, null, 2));
        log(`result delivered via file fallback: id=${result.id}`);
      }
      return true;
    } catch (e) {
      log(`pollOnceViaHttp error: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }
  async function pollOnce() {
    if (!bridgeEnabled || pollInProgress)
      return;
    pollInProgress = true;
    try {
      const httpOk = await pollOnceViaHttp();
      if (httpOk)
        return;
      const cmd = await readCommand();
      if (!cmd)
        return;
      lastCommandTime = cmd.timestamp;
      await clearCommand();
      const result = await executeCommand(cmd);
      await writeResult(result);
      log(`command done (file): ${cmd.action} -> ${result.success ? "ok" : "fail"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`poll error: ${message}`);
    } finally {
      pollInProgress = false;
    }
  }
  function startNativeInterval() {
    if (nativeIntervalHandle)
      return true;
    if (typeof setInterval !== "function")
      return false;
    nativeIntervalHandle = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
    usingNativeTimer = true;
    usingSysTimer = false;
    return true;
  }
  function startSysInterval() {
    var _a;
    const timerApi = (_a = anyEda()) == null ? void 0 : _a.sys_Timer;
    if (!(timerApi == null ? void 0 : timerApi.setIntervalTimer))
      return false;
    const ok = timerApi.setIntervalTimer(TIMER_ID, POLL_INTERVAL_MS, () => {
      void pollOnce();
    });
    if (!ok)
      return false;
    usingNativeTimer = false;
    usingSysTimer = true;
    return true;
  }
  function stopIntervals() {
    var _a, _b, _c;
    if (nativeIntervalHandle) {
      try {
        clearInterval(nativeIntervalHandle);
      } catch (e) {
      }
      nativeIntervalHandle = null;
    }
    if (usingSysTimer) {
      try {
        (_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_Timer) == null ? void 0 : _b.clearIntervalTimer) == null ? void 0 : _c.call(_b, TIMER_ID);
      } catch (e) {
      }
    }
    usingNativeTimer = false;
    usingSysTimer = false;
  }
  async function ensureBridgeFiles() {
    await ensureBridgeDir();
    const existing = await readTextFile(COMMAND_FILE);
    if (existing === void 0) {
      await writeTextFile(COMMAND_FILE, "");
    }
  }
  var EDA_WS_ID = "jlc_bridge_ws";
  var usingSysWs = false;
  function wsCleanup() {
    var _a, _b, _c;
    if (wsReconnectHandle) {
      clearTimeout(wsReconnectHandle);
      wsReconnectHandle = null;
    }
    if (usingSysWs) {
      try {
        (_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_WebSocket) == null ? void 0 : _b.close) == null ? void 0 : _c.call(_b, EDA_WS_ID);
      } catch (e) {
      }
    }
    if (wsConnection) {
      try {
        wsConnection.close();
      } catch (e) {
      }
      wsConnection = null;
    }
    wsConnected = false;
    usingSysWs = false;
  }
  function wsSend(data) {
    var _a, _b, _c;
    const json = JSON.stringify(data);
    if (usingSysWs && wsConnected) {
      try {
        (_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_WebSocket) == null ? void 0 : _b.send) == null ? void 0 : _c.call(_b, EDA_WS_ID, json);
        return;
      } catch (e) {
      }
    }
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN)
      return;
    try {
      wsConnection.send(json);
    } catch (e) {
    }
  }
  function wsPushEvent(event, payload) {
    wsSend({ type: "event", event, data: payload != null ? payload : {} });
  }
  async function handleWsMessage(raw) {
    var _a, _b, _c, _d, _e, _f;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if ((msg == null ? void 0 : msg.type) === "ping") {
      wsSend({ type: "pong", id: msg.id, timestamp: Date.now(), payload: null });
      return;
    }
    if ((msg == null ? void 0 : msg.type) === "command") {
      const action = (_b = msg.action) != null ? _b : (_a = msg.payload) == null ? void 0 : _a.action;
      const params = (_e = (_d = msg.params) != null ? _d : (_c = msg.payload) == null ? void 0 : _c.params) != null ? _e : {};
      const cmdId = msg.id;
      if (!action || !cmdId)
        return;
      const cmd = {
        id: cmdId,
        action,
        params,
        timestamp: (_f = msg.timestamp) != null ? _f : Date.now()
      };
      lastCommandTime = cmd.timestamp;
      const result = await executeCommand(cmd);
      wsSend({
        type: "result",
        id: cmdId,
        timestamp: Date.now(),
        payload: {
          commandId: cmdId,
          success: result.success,
          data: result.data,
          error: result.error,
          durationMs: result.durationMs
        }
      });
      log(`ws command done: ${cmd.action} -> ${result.success ? "ok" : "fail"}`);
    }
  }
  function scheduleWsReconnect() {
    if (wsReconnectHandle || !bridgeEnabled)
      return;
    wsReconnectHandle = setTimeout(() => {
      wsReconnectHandle = null;
      if (bridgeEnabled) {
        void connectWebSocket();
      }
    }, WS_RECONNECT_MS);
  }
  async function connectWebSocket() {
    var _a;
    const sysWs = (_a = anyEda()) == null ? void 0 : _a.sys_WebSocket;
    if (sysWs == null ? void 0 : sysWs.register) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5e3);
        try {
          sysWs.register(
            EDA_WS_ID,
            WS_URL,
            // onMessage
            (ev) => {
              const data = typeof ev.data === "string" ? ev.data : "";
              if (data)
                void handleWsMessage(data);
            },
            // onConnected
            () => {
              clearTimeout(timeout);
              usingSysWs = true;
              wsConnection = null;
              wsConnected = true;
              stopIntervals();
              log("ws connected via sys_WebSocket, file polling stopped");
              wsSend({ type: "hello", name: APP_NAME, version: APP_VERSION });
              resolve(true);
            }
          );
        } catch (e) {
          clearTimeout(timeout);
          log(`sys_WebSocket failed: ${e instanceof Error ? e.message : String(e)}`);
          resolve(false);
        }
      });
    }
    if (typeof WebSocket === "undefined")
      return false;
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (e) {
          }
          resolve(false);
        }, 5e3);
        ws.onopen = () => {
          clearTimeout(timeout);
          wsConnection = ws;
          wsConnected = true;
          usingSysWs = false;
          stopIntervals();
          log("ws connected via native WebSocket, file polling stopped");
          wsSend({ type: "hello", name: APP_NAME, version: APP_VERSION });
          resolve(true);
        };
        ws.onmessage = (ev) => {
          const data = typeof ev.data === "string" ? ev.data : "";
          if (data)
            void handleWsMessage(data);
        };
        ws.onclose = () => {
          clearTimeout(timeout);
          const wasConnected = wsConnected;
          wsConnection = null;
          wsConnected = false;
          if (wasConnected && bridgeEnabled) {
            log("ws disconnected, falling back to file polling");
            const timerStarted = startSysInterval() || startNativeInterval();
            if (!timerStarted) {
              log("warning: could not restart file polling after ws disconnect");
            }
          }
          scheduleWsReconnect();
          if (!wasConnected)
            resolve(false);
        };
        ws.onerror = () => {
          clearTimeout(timeout);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }
  async function startPolling(silent = false) {
    if (bridgeEnabled)
      return;
    await ensureBridgeFiles();
    bridgeEnabled = true;
    const wsOk = await connectWebSocket();
    if (wsOk) {
      await saveEnabledPref(true);
      log(`bridge enabled (WebSocket)`);
      if (!silent) {
        showInfo([
          "Bridge enabled (WebSocket)",
          `WS endpoint: ${WS_URL}`,
          `Fallback: file polling`
        ].join("\n"));
      }
      return;
    }
    const timerStarted = startSysInterval() || startNativeInterval();
    if (!timerStarted) {
      bridgeEnabled = false;
      throw new Error("no available timer API (sys_Timer/setInterval)");
    }
    scheduleWsReconnect();
    await saveEnabledPref(true);
    log(`bridge enabled (${getTimerMode()}, ws reconnecting in background)`);
    if (!silent) {
      showInfo([
        "Bridge enabled (file polling)",
        `Command file: ${COMMAND_FILE}`,
        `Result file: ${RESULT_FILE}`,
        `Poll interval: ${POLL_INTERVAL_MS}ms`,
        `Timer: ${getTimerMode()}`,
        `File API: ${getFileApiMode()}`,
        `WS: reconnecting in background...`
      ].join("\n"));
    }
  }
  async function stopPolling(silent = false) {
    wsCleanup();
    stopIntervals();
    bridgeEnabled = false;
    await saveEnabledPref(false);
    log("bridge disabled");
    if (!silent) {
      showInfo("Bridge disabled");
    }
  }
  function toggleBridge() {
    log("toggleBridge clicked");
    void (async () => {
      const enabled = bridgeEnabled || readEnabledPref();
      if (enabled) {
        await stopPolling();
        return;
      }
      try {
        await startPolling();
      } catch (error) {
        showError("Failed to enable bridge", error);
      }
    })();
  }
  function showStatus() {
    log("showStatus clicked");
    void (async () => {
      const persisted = readEnabledPref();
      if (persisted && !bridgeEnabled) {
        try {
          await startPolling(true);
        } catch (e) {
        }
      }
      const runtime = bridgeEnabled ? "running" : "stopped";
      const transport = wsConnected ? "WebSocket" : bridgeEnabled ? `file polling (${getTimerMode()})` : "none";
      const lines = [
        `Runtime: ${runtime}`,
        `Transport: ${transport}`,
        `Persisted enabled: ${persisted ? "yes" : "no"}`,
        `Command file: ${COMMAND_FILE}`,
        `Result file: ${RESULT_FILE}`,
        `Poll interval: ${POLL_INTERVAL_MS}ms`,
        `Timer: ${getTimerMode()}`,
        `File API: ${getFileApiMode()}`,
        `HTTP fetch: ${typeof globalThis.fetch === "function" ? "available" : "unavailable"}`,
        `WS: ${wsConnected ? "connected" : "disconnected"}`,
        `Last command time: ${lastCommandTime || "(none)"}`
      ];
      showInfo(lines.join("\n"), `${APP_NAME} Status`);
    })();
  }
  async function testCommand() {
    log("testCommand clicked");
    try {
      showInfo("Reading PCB state...", `${APP_NAME} Test`);
      const state = await getPCBState();
      const preview = state.components.slice(0, 5).map((c) => `${c.designator}: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
      showInfo(
        [
          "Test success",
          `Components: ${state.components.length}`,
          `Nets: ${state.nets.length}`,
          `Bounds: (${state.boardBounds.minX.toFixed(1)}, ${state.boardBounds.minY.toFixed(1)}) - (${state.boardBounds.maxX.toFixed(1)}, ${state.boardBounds.maxY.toFixed(1)})`,
          "",
          "Top 5 components:",
          ...preview
        ].join("\n"),
        `${APP_NAME} Test`
      );
    } catch (error) {
      showError("Test failed", error);
    }
  }
  function notifyPcbChanged(detail) {
    if (!wsConnected)
      return;
    wsPushEvent("pcb_changed", detail);
  }
  function notifySelectionChanged(detail) {
    if (!wsConnected)
      return;
    wsPushEvent("selection_changed", detail);
  }
  function activate(_status, _arg) {
    void (async () => {
      var _a, _b, _c;
      try {
        await ((_c = (_b = (_a = anyEda()) == null ? void 0 : _a.sys_HeaderMenu) == null ? void 0 : _b.replaceHeaderMenus) == null ? void 0 : _c.call(_b, headerMenus));
      } catch (error) {
        console.error(`[${APP_NAME}] replaceHeaderMenus failed`, error);
      }
      log(`plugin loaded (v${APP_VERSION})`);
      if (readEnabledPref()) {
        try {
          await startPolling(true);
          log("bridge auto-restored to running state");
        } catch (error) {
          showError("Auto-restore bridge failed", error);
        }
      } else {
        stopIntervals();
        bridgeEnabled = false;
      }
    })();
  }
  return __toCommonJS(src_exports);
})();
