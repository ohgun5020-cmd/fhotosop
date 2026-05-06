import React, { useEffect, useRef, useState } from "react";

import "./styles.css";

import { entrypoints } from "uxp";
import { PanelController } from "./controllers/PanelController.jsx";

const { app, action, core, constants } = require("photoshop");
const { storage } = require("uxp");

const fs = storage.localFileSystem;
const binaryReadFormat = storage.formats && storage.formats.binary ? storage.formats.binary : "binary";

function stripExtension(name) {
  return String(name || "").replace(/\.[^.]+$/, "");
}

function fileExtension(name) {
  const match = String(name || "").match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function formatFileDate(entry) {
  const rawDate = entry && (entry.dateModified || entry.lastModified || entry.modified);
  if (!rawDate) {
    return "PSD";
  }
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return "PSD";
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  });
}

function alphaIndex(token) {
  let value = 0;
  const upper = token.toUpperCase();
  for (let index = 0; index < upper.length; index += 1) {
    value = value * 26 + (upper.charCodeAt(index) - 64);
  }
  return value;
}

function extractSortToken(name) {
  const base = stripExtension(name);
  const numericMatches = Array.from(base.matchAll(/(?:^|[_\-\s])(\d{1,5})(?=$|[_\-\s])/g));
  if (numericMatches.length > 0) {
    const last = numericMatches[numericMatches.length - 1][1];
    return {
      type: "number",
      value: Number(last),
      label: last
    };
  }

  const letterMatches = Array.from(base.matchAll(/(?:^|[_\-\s])([A-Z]{1,3})(?=$|[_\-\s])/gi));
  if (letterMatches.length > 0) {
    const last = letterMatches[letterMatches.length - 1][1];
    return {
      type: "letter",
      value: alphaIndex(last),
      label: last.toUpperCase()
    };
  }

  return {
    type: "name",
    value: base.toLowerCase(),
    label: "-"
  };
}

function createFileItem(entry, index) {
  const sortToken = extractSortToken(entry.name);
  return {
    id: `${Date.now()}-${index}-${entry.name}`,
    entry,
    name: entry.name,
    extension: fileExtension(entry.name),
    sortToken,
    width: null,
    height: null,
    resolution: null,
    modifiedLabel: formatFileDate(entry)
  };
}

function sortItems(items) {
  return items.slice().sort((a, b) => {
    const typeRank = { number: 0, letter: 1, name: 2 };
    const rankA = typeRank[a.sortToken.type] ?? 3;
    const rankB = typeRank[b.sortToken.type] ?? 3;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    if (a.sortToken.value < b.sortToken.value) {
      return -1;
    }
    if (a.sortToken.value > b.sortToken.value) {
      return 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function moveItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function normalizeRect(startX, startY, currentX, currentY) {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const right = Math.max(startX, currentX);
  const bottom = Math.max(startY, currentY);
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function rectsIntersect(first, second) {
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function roundPixel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.round(number)) : 1;
}

function asArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (data && data.buffer instanceof ArrayBuffer) {
    const start = data.byteOffset || 0;
    const end = start + (data.byteLength || data.length || 0);
    return data.buffer.slice(start, end);
  }
  throw new Error("PSD 파일을 바이너리로 읽지 못했습니다.");
}

function readAscii(view, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function skipPaddedPascalString(view, offset, endOffset) {
  if (offset >= endOffset) {
    return endOffset;
  }
  const length = view.getUint8(offset);
  let nextOffset = offset + 1 + length;
  if ((1 + length) % 2 !== 0) {
    nextOffset += 1;
  }
  return Math.min(nextOffset, endOffset);
}

function parsePsdResolution(view) {
  try {
    let offset = 26;
    if (offset + 4 > view.byteLength) {
      return null;
    }
    const colorModeLength = view.getUint32(offset, false);
    offset += 4 + colorModeLength;
    if (offset + 4 > view.byteLength) {
      return null;
    }
    const imageResourcesLength = view.getUint32(offset, false);
    offset += 4;
    const endOffset = Math.min(view.byteLength, offset + imageResourcesLength);

    while (offset + 12 <= endOffset) {
      const signature = readAscii(view, offset, 4);
      offset += 4;
      if (signature !== "8BIM" && signature !== "8B64") {
        return null;
      }
      const resourceId = view.getUint16(offset, false);
      offset += 2;
      offset = skipPaddedPascalString(view, offset, endOffset);
      if (offset + 4 > endOffset) {
        return null;
      }
      const size = view.getUint32(offset, false);
      offset += 4;
      const dataOffset = offset;
      const nextOffset = offset + size + (size % 2);
      if (resourceId === 1005 && size >= 16 && dataOffset + 4 <= endOffset) {
        const resolution = view.getInt32(dataOffset, false) / 65536;
        return Number.isFinite(resolution) && resolution > 0 ? resolution : null;
      }
      offset = nextOffset;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function parsePsdHeader(data, name) {
  const buffer = asArrayBuffer(data);
  if (buffer.byteLength < 26) {
    throw new Error(`${name} PSD 헤더가 너무 짧습니다.`);
  }
  const view = new DataView(buffer);
  const signature = readAscii(view, 0, 4);
  if (signature !== "8BPS") {
    throw new Error(`${name} 파일 형식이 PSD/PSB가 아닙니다.`);
  }
  const version = view.getUint16(4, false);
  if (version !== 1 && version !== 2) {
    throw new Error(`${name} PSD 버전을 읽을 수 없습니다.`);
  }
  return {
    width: roundPixel(view.getUint32(18, false)),
    height: roundPixel(view.getUint32(14, false)),
    resolution: parsePsdResolution(view) || 72
  };
}

async function readPsdMetric(item) {
  const data = await item.entry.read({ format: binaryReadFormat });
  const header = parsePsdHeader(data, item.name);
  return {
    id: item.id,
    item,
    width: header.width,
    height: header.height,
    resolution: header.resolution
  };
}

function getTopLevelLayers(doc) {
  return Array.from(doc.layers || []);
}

async function resizeCanvas(doc, width, height) {
  if (!doc || !doc.resizeCanvas) {
    return;
  }
  const anchor = constants && constants.AnchorPosition ? constants.AnchorPosition.TOPLEFT : undefined;
  await doc.resizeCanvas(roundPixel(width), roundPixel(height), anchor);
}

async function groupDocumentLayers(doc, name) {
  const layers = getTopLevelLayers(doc);
  if (layers.length === 0) {
    return null;
  }
  if (layers.length === 1) {
    layers[0].name = name;
    return layers[0];
  }
  try {
    const group = await doc.groupLayers(layers);
    if (group) {
      group.name = name;
    }
    return group;
  } catch (error) {
    console.warn("Could not group layers.", error);
    for (const layer of layers) {
      try {
        layer.name = `${name} / ${layer.name}`;
      } catch (renameError) {
      }
    }
  }
  return null;
}

function renameLayers(layers, prefix) {
  layers.forEach((layer, index) => {
    try {
      layer.name = layers.length === 1 ? prefix : `${prefix} / ${String(index + 1).padStart(2, "0")} ${layer.name}`;
    } catch (error) {
    }
  });
}

async function translateLayers(layers, offsetY) {
  if (!offsetY) {
    return;
  }
  for (const layer of layers) {
    try {
      await layer.translate(0, offsetY);
    } catch (error) {
      console.warn("Could not translate layer.", error);
    }
  }
}

async function closeWithoutSaving(doc) {
  if (!doc || !doc.close) {
    return;
  }
  const options = constants && constants.SaveOptions;
  try {
    await doc.close(options ? options.DONOTSAVECHANGES : undefined);
  } catch (error) {
    try {
      await doc.close();
    } catch (closeError) {
      console.warn("Could not close source document.", closeError);
    }
  }
}

function segmentGroupName(item, index) {
  const number = String(index + 1).padStart(2, "0");
  return `${number} ${stripExtension(item.name)}`;
}

function smartObjectLayerName(item) {
  return stripExtension(item.name);
}

function assertBatchPlayResult(result, message) {
  const errorResult = Array.isArray(result) ? result.find(item => item && item._obj === "error") : null;
  if (errorResult) {
    throw new Error(`${message}: ${errorResult.message || errorResult.result || "Photoshop 명령 실패"}`);
  }
}

function createRenameActiveLayerCommand(name) {
  return {
    _obj: "set",
    _target: [
      {
        _ref: "layer",
        _enum: "ordinal",
        _value: "targetEnum"
      }
    ],
    to: {
      _obj: "layer",
      name
    }
  };
}

function createConvertSmartObjectToLayersCommand() {
  return {
    _obj: "placedLayerConvertToLayers",
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function createPlaceEmbeddedSmartObjectCommand(metric, canvas) {
  const token = fs.createSessionToken(metric.item.entry);
  const x = Math.round(Number(metric.offsetX) || 0);
  const y = Math.round(Number(metric.offsetY) || 0);
  const horizontalOffset = Math.round(x + metric.width / 2 - canvas.width / 2);
  const verticalOffset = Math.round(y + metric.height / 2 - canvas.height / 2);

  return {
    _obj: "placeEvent",
    "null": {
      _path: token,
      _kind: "local"
    },
    freeTransformCenterState: {
      _enum: "quadCenterState",
      _value: "QCSAverage"
    },
    offset: {
      _obj: "offset",
      horizontal: {
        _unit: "pixelsUnit",
        _value: horizontalOffset
      },
      vertical: {
        _unit: "pixelsUnit",
        _value: verticalOffset
      }
    },
    _isCommand: false,
    _options: {
      dialogOptions: "dontDisplay"
    }
  };
}

function getStitchMode(value) {
  return value === "horizontal" ? "horizontal" : "vertical";
}

function calculateStitchCanvas(metrics, gap, stitchMode) {
  const mode = getStitchMode(stitchMode);
  if (mode === "horizontal") {
    return {
      width: Math.max(1, metrics.reduce((sum, metric) => sum + metric.width, 0) + Math.max(0, metrics.length - 1) * gap),
      height: Math.max(...metrics.map(metric => metric.height))
    };
  }
  return {
    width: Math.max(...metrics.map(metric => metric.width)),
    height: Math.max(1, metrics.reduce((sum, metric) => sum + metric.height, 0) + Math.max(0, metrics.length - 1) * gap)
  };
}

function applyStitchOffsets(metrics, canvas, gap, stitchMode) {
  const mode = getStitchMode(stitchMode);
  let offset = 0;
  for (const metric of metrics) {
    if (mode === "horizontal") {
      metric.offsetX = offset;
      metric.offsetY = Math.round((canvas.height - metric.height) / 2);
      offset += metric.width + gap;
    } else {
      metric.offsetX = Math.round((canvas.width - metric.width) / 2);
      metric.offsetY = offset;
      offset += metric.height + gap;
    }
  }
}

async function stitchPsdFilesAsSmartObjects(items, options, onProgress) {
  if (items.length === 0) {
    throw new Error("PSD 파일을 먼저 선택하세요.");
  }

  const gap = Math.round(Number(options.gap) || 0);
  const stitchMode = getStitchMode(options.stitchMode);
  onProgress(`${items.length}개 PSD 크기 분석 중`);
  const metrics = await Promise.all(items.map(item => readPsdMetric(item)));

  const canvas = calculateStitchCanvas(metrics, gap, stitchMode);
  applyStitchOffsets(metrics, canvas, gap, stitchMode);

  let finalDoc = null;
  await core.executeAsModal(async executionContext => {
    finalDoc = await app.createDocument({
      width: canvas.width,
      height: canvas.height,
      resolution: metrics[0] ? metrics[0].resolution : 72,
      name: options.outputName || "PSD Stitch",
      fill: "transparent"
    });
    app.activeDocument = finalDoc;

    const commands = [];
    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index];
      commands.push(createPlaceEmbeddedSmartObjectCommand(metric, canvas));
      commands.push(createRenameActiveLayerCommand(smartObjectLayerName(metric.item)));
      if (options.convertSmartObjects) {
        commands.push(createConvertSmartObjectToLayersCommand());
      }
    }

    const label = `${metrics.length}개 스마트 오브젝트 일괄 배치 중`;
    onProgress(label);
    executionContext.reportProgress({
      value: 0.5,
      commandName: label
    });
    const result = await action.batchPlay(commands, { synchronousExecution: false });
    assertBatchPlayResult(result, "스마트 오브젝트 일괄 배치 실패");

    if (finalDoc) {
      app.activeDocument = finalDoc;
    }
  }, {
    commandName: "Stitch PSD files as Smart Objects",
    interactive: false
  });

  return {
    canvas,
    metrics: metrics.map(metric => ({
      id: metric.id,
      width: metric.width,
      height: metric.height,
      resolution: metric.resolution
    }))
  };
}

async function stitchPsdFilesAsLayers(items, options, onProgress) {
  if (items.length === 0) {
    throw new Error("PSD 파일을 먼저 선택하세요.");
  }

  let finalDoc = null;
  const metrics = [];
  const openedSources = [];

  await core.executeAsModal(async executionContext => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const label = `${index + 1}/${items.length} 열기: ${item.name}`;
      onProgress(label);
      executionContext.reportProgress({
        value: (index + 1) / (items.length * 2),
        commandName: label
      });

      const sourceDoc = await app.open(item.entry);
      const width = roundPixel(sourceDoc.width);
      const height = roundPixel(sourceDoc.height);
      const resolution = Number(sourceDoc.resolution) || 72;
      metrics.push({ id: item.id, width, height, resolution });
      openedSources.push({ doc: sourceDoc, item, width, height, resolution });
    }

    const maxWidth = Math.max(...openedSources.map(source => source.width));
    const totalHeight = openedSources.reduce((sum, source) => sum + source.height, 0) + Math.max(0, openedSources.length - 1) * options.gap;
    finalDoc = await app.createDocument({
      width: maxWidth,
      height: Math.max(1, totalHeight),
      resolution: openedSources[0] ? openedSources[0].resolution : 72,
      name: options.outputName || "PSD Stitch",
      fill: "transparent"
    });

    let offsetY = 0;
    for (let index = 0; index < openedSources.length; index += 1) {
      const source = openedSources[index];
      const label = `${index + 1}/${openedSources.length} 복사: ${source.item.name}`;
      onProgress(label);
      executionContext.reportProgress({
        value: (items.length + index + 1) / (items.length * 2),
        commandName: label
      });

      const layers = getTopLevelLayers(source.doc);
      const copiedLayers = layers.length > 0 ? (await source.doc.duplicateLayers(layers, finalDoc) || []) : [];
      app.activeDocument = finalDoc;
      if (copiedLayers.length === 0) {
        throw new Error(`${source.item.name} 레이어를 복사하지 못했습니다.`);
      }
      renameLayers(copiedLayers, segmentGroupName(source.item, index));
      await translateLayers(copiedLayers, offsetY);
      offsetY += source.height + options.gap;
    }

    if (options.closeSources) {
      for (const source of openedSources) {
        if (source.doc && source.doc !== finalDoc) {
          await closeWithoutSaving(source.doc);
        }
      }
    }

    if (finalDoc) {
      app.activeDocument = finalDoc;
    }
  }, {
    commandName: "Stitch PSD files",
    interactive: false
  });

  return metrics;
}

function ControlButton({ children, className = "", disabled = false, onClick, title, ariaLabel }) {
  function handleClick(event) {
    if (disabled) {
      return;
    }
    if (onClick) {
      onClick(event);
    }
  }

  function handleKeyDown(event) {
    if (disabled || !onClick) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(event);
    }
  }

  return (
    <div
      className={`control-button ${className}${disabled ? " disabled" : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? "true" : "false"}
      aria-label={ariaLabel}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function ChevronIcon({ direction }) {
  const points = direction === "up" ? "4 10 8 6 12 10" : "4 6 8 10 12 6";
  return (
    <svg className="chevron-icon" viewBox="0 0 16 16" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function App() {
  const [items, setItems] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [gap, setGap] = useState(0);
  const [closeSources, setCloseSources] = useState(true);
  const [convertSmartObjects, setConvertSmartObjects] = useState(true);
  const [stitchMode, setStitchMode] = useState("vertical");
  const [activeTab, setActiveTab] = useState("files");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("PSD 조각을 선택하세요.");
  const [lastResultSize, setLastResultSize] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const marqueeRef = useRef(null);
  const marqueeActive = Boolean(marquee);

  useEffect(() => {
    marqueeRef.current = marquee;
  }, [marquee]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeContextMenu();
        setSelectedIds([]);
        setSelectionAnchorId(null);
        setMarquee(null);
      }

      if (event.key === "Delete" && activeTab === "files" && !busy && selectedIds.length > 0) {
        event.preventDefault();
        removeItemsByIds(selectedIds);
        closeContextMenu();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, busy, selectedIds]);

  useEffect(() => {
    if (!marqueeActive) {
      return undefined;
    }

    function handleMouseMove(event) {
      const current = marqueeRef.current;
      if (!current) {
        return;
      }
      event.preventDefault();
      const next = {
        ...current,
        currentX: event.clientX,
        currentY: event.clientY
      };
      marqueeRef.current = next;
      setMarquee(next);
      const nextSelectedIds = getItemIdsInMarquee(next);
      setSelectedIds(nextSelectedIds);
      setSelectionAnchorId(nextSelectedIds.length > 0 ? nextSelectedIds[0] : null);
    }

    function handleMouseUp() {
      marqueeRef.current = null;
      setMarquee(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [marqueeActive]);

  useEffect(() => {
    if (!draggingId) {
      return undefined;
    }

    function handleMouseUp() {
      finishDrag();
    }

    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingId]);

  async function chooseFiles() {
    if (busy) {
      return;
    }
    const files = await fs.getFileForOpening({
      allowMultiple: true,
      types: ["psd", "psb"]
    });
    if (!files || files.length === 0) {
      return;
    }
    const selectedFiles = Array.isArray(files) ? files : [files];
    const nextItems = sortItems(selectedFiles.filter(Boolean).map(createFileItem));
    setItems(nextItems);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    setMarquee(null);
    closeContextMenu();
    setLastResultSize(null);
    setStatus(`${nextItems.length}개 PSD를 불러왔습니다. 순서를 확인하세요.`);
  }

  async function runStitch() {
    if (busy || items.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("PSD를 스마트 오브젝트로 배치하는 중입니다.");
    setLastResultSize(null);
    try {
      const result = await stitchPsdFilesAsSmartObjects(
        items,
        {
          gap: Number(gap) || 0,
          outputName: "PSD Stitch",
          convertSmartObjects,
          stitchMode
        },
        message => setStatus(message)
      );
      setLastResultSize(result.canvas);
      setStatus(`완료: ${items.length}개 PSD를 ${stitchMode === "horizontal" ? "가로" : "세로"}로 합쳤습니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function runLayerStitch() {
    if (busy || items.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("Photoshop에서 PSD를 열어 레이어를 복사하는 중입니다.");
    setLastResultSize(null);
    try {
      const metrics = await stitchPsdFilesAsLayers(
        items,
        {
          gap: Number(gap) || 0,
          closeSources,
          outputName: "PSD Stitch"
        },
        message => setStatus(message)
      );
      setStatus(`완료: ${items.length}개 PSD 레이어를 세로로 합쳤습니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function adjustGap(delta) {
    setGap(current => Math.round(Number(current) || 0) + delta);
  }

  function moveUp(index) {
    setItems(current => moveItem(current, index, index - 1));
  }

  function moveDown(index) {
    setItems(current => moveItem(current, index, index + 1));
  }

  function removeItemsByIds(itemIds) {
    const idSet = new Set(itemIds);
    setItems(current => current.filter(item => !idSet.has(item.id)));
    setSelectedIds(current => current.filter(itemId => !idSet.has(itemId)));
    setSelectionAnchorId(current => (current && idSet.has(current) ? null : current));
    setLastResultSize(null);
  }

  function getRangeItemIds(anchorId, targetId) {
    const anchorIndex = items.findIndex(item => item.id === anchorId);
    const targetIndex = items.findIndex(item => item.id === targetId);
    if (anchorIndex < 0 || targetIndex < 0) {
      return [targetId];
    }
    const startIndex = Math.min(anchorIndex, targetIndex);
    const endIndex = Math.max(anchorIndex, targetIndex);
    return items.slice(startIndex, endIndex + 1).map(item => item.id);
  }

  function mergeSelectedIds(baseIds, addedIds) {
    const selectedSet = new Set(baseIds.concat(addedIds));
    return items.filter(item => selectedSet.has(item.id)).map(item => item.id);
  }

  function toggleSelectedId(itemId) {
    if (selectedIds.indexOf(itemId) !== -1) {
      return selectedIds.filter(selectedId => selectedId !== itemId);
    }
    return mergeSelectedIds(selectedIds, [itemId]);
  }

  function handleModifiedRowSelection(event, item) {
    event.preventDefault();
    closeContextMenu();
    setDraggingId(null);
    setMarquee(null);

    if (event.shiftKey) {
      const anchorId = selectionAnchorId && items.some(currentItem => currentItem.id === selectionAnchorId)
        ? selectionAnchorId
        : (selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : item.id);
      const rangeIds = getRangeItemIds(anchorId, item.id);
      const nextIds = event.ctrlKey || event.metaKey ? mergeSelectedIds(selectedIds, rangeIds) : rangeIds;
      setSelectedIds(nextIds);
      setSelectionAnchorId(anchorId);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedIds(toggleSelectedId(item.id));
      setSelectionAnchorId(item.id);
    }
  }

  function getContextTargetIds(itemId) {
    if (contextMenu && Array.isArray(contextMenu.itemIds) && contextMenu.itemIds.indexOf(itemId) !== -1) {
      return contextMenu.itemIds;
    }
    if (selectedIds.indexOf(itemId) !== -1 && selectedIds.length > 1) {
      return selectedIds;
    }
    return [itemId];
  }

  function moveItemsToStart(itemIds) {
    const idSet = new Set(itemIds);
    setItems(current => {
      const selected = current.filter(item => idSet.has(item.id));
      const rest = current.filter(item => !idSet.has(item.id));
      return selected.concat(rest);
    });
    setSelectedIds(itemIds);
  }

  function moveItemsToEnd(itemIds) {
    const idSet = new Set(itemIds);
    setItems(current => {
      const selected = current.filter(item => idSet.has(item.id));
      const rest = current.filter(item => !idSet.has(item.id));
      return rest.concat(selected);
    });
    setSelectedIds(itemIds);
  }

  function removeItem(itemId) {
    removeItemsByIds(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function moveItemToStart(itemId) {
    moveItemsToStart(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function moveItemToEnd(itemId) {
    moveItemsToEnd(getContextTargetIds(itemId));
    closeContextMenu();
  }

  function handleContextMenuKey(event, action) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function getMarqueeRect(selection) {
    const left = Math.min(selection.startX, selection.currentX);
    const top = Math.min(selection.startY, selection.currentY);
    const right = Math.max(selection.startX, selection.currentX);
    const bottom = Math.max(selection.startY, selection.currentY);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  function getMarqueeStyle(selection) {
    const rect = getMarqueeRect(selection);
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function rectsIntersect(rect, rowRect) {
    return rect.left <= rowRect.right && rect.right >= rowRect.left && rect.top <= rowRect.bottom && rect.bottom >= rowRect.top;
  }

  function getItemIdsInMarquee(selection) {
    const rect = getMarqueeRect(selection);
    return Array.from(document.querySelectorAll(".file-row[data-item-id]"))
      .filter(row => rectsIntersect(rect, row.getBoundingClientRect()))
      .map(row => row.getAttribute("data-item-id"))
      .filter(Boolean);
  }

  function startMarqueeSelection(event) {
    if (busy || event.button !== 0 || items.length === 0 || event.target.closest(".file-row")) {
      return;
    }
    event.preventDefault();
    closeContextMenu();
    setDraggingId(null);
    setSelectedIds([]);
    setSelectionAnchorId(null);
    const next = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY
    };
    marqueeRef.current = next;
    setMarquee(next);
  }

  function openContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) {
      return;
    }
    const targetIds = selectedIds.indexOf(item.id) !== -1 && selectedIds.length > 0 ? selectedIds.slice() : [item.id];
    const menuWidth = 126;
    const menuHeight = 68;
    const viewportWidth = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : event.clientX + menuWidth;
    const viewportHeight = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : event.clientY + menuHeight;
    setSelectedIds(targetIds);
    setSelectionAnchorId(item.id);
    setContextMenu({
      itemId: item.id,
      itemIds: targetIds,
      x: Math.max(4, Math.min(event.clientX, viewportWidth - menuWidth - 4)),
      y: Math.max(4, Math.min(event.clientY, viewportHeight - menuHeight - 4))
    });
  }

  function handleRowMouseDown(event, item) {
    if (busy || event.button !== 0 || isRowControlTarget(event.target)) {
      return;
    }
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      handleModifiedRowSelection(event, item);
      return;
    }
    event.preventDefault();
    closeContextMenu();
    setSelectedIds([item.id]);
    setSelectionAnchorId(item.id);
    setDraggingId(item.id);
  }

  function handleRowMouseEnter(targetId) {
    if (!draggingId || draggingId === targetId) {
      return;
    }
    setItems(current => {
      const fromIndex = current.findIndex(item => item.id === draggingId);
      const toIndex = current.findIndex(item => item.id === targetId);
      return moveItem(current, fromIndex, toIndex);
    });
  }

  function finishDrag() {
    setDraggingId(null);
  }

  function isRowControlTarget(target) {
    return Boolean(target && target.closest && target.closest(".row-actions"));
  }

  return (
    <div className="app-shell" onClick={closeContextMenu}>
      <nav className="tabs" aria-label="PSD Stitcher sections">
        <ControlButton
          className={`tab-button ${activeTab === "files" ? "active" : ""}`}
          onClick={() => setActiveTab("files")}
        >
          PSD 합치기
        </ControlButton>
        <ControlButton
          className={`tab-button ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          설정
        </ControlButton>
      </nav>

      {activeTab === "files" && (
        <div className="tab-panel">
          <section className="toolbar">
            <ControlButton className="primary" onClick={chooseFiles} disabled={busy}>
              PSD 파일 열기
            </ControlButton>
          </section>

          <div className="list-header">
            <div className="section-title">선택된 파일 리스트 <span>{items.length}</span></div>
            <ControlButton className="list-sort" onClick={() => setItems(sortItems(items))} disabled={busy || items.length < 2}>
              이름순 정렬
            </ControlButton>
          </div>
          <section className="file-list" aria-label="PSD order" onMouseDown={startMarqueeSelection} onScroll={closeContextMenu}>
            {items.length === 0 ? (
              <div className="empty">PSD/PSB 파일을 여러 개 선택하면 여기에 순서가 표시됩니다.</div>
            ) : (
              <div className="file-table">
                <div className="file-row file-row-head">
                  <div className="index">순서</div>
                  <div className="file-main">파일명</div>
                  <div className="row-actions">이동</div>
                </div>
                {items.map((item, index) => {
                  const selected = selectedIds.indexOf(item.id) !== -1;
                  return (
                    <div
                      className={`file-row ${item.id === draggingId ? "dragging" : ""} ${selected ? "selected" : ""}`}
                      key={item.id}
                      data-item-id={item.id}
                      onMouseDown={event => handleRowMouseDown(event, item)}
                      onMouseEnter={() => handleRowMouseEnter(item.id)}
                      onContextMenu={event => openContextMenu(event, item)}
                    >
                      <div className="index">{String(index + 1).padStart(2, "0")}</div>
                      <div className="file-main">
                        <strong>{item.name}</strong>
                      </div>
                      <div className="row-actions">
                        <ControlButton className="icon-button arrow-up" ariaLabel="위로 이동" title="위로 이동" onClick={() => moveUp(index)} disabled={busy || index === 0}>
                          <ChevronIcon direction="up" />
                        </ControlButton>
                        <ControlButton className="icon-button arrow-down" ariaLabel="아래로 이동" title="아래로 이동" onClick={() => moveDown(index)} disabled={busy || index === items.length - 1}>
                          <ChevronIcon direction="down" />
                        </ControlButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {marquee && <div className="marquee-box" style={getMarqueeStyle(marquee)} />}
          {contextMenu && (
            <div
              className="context-menu"
              role="menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={event => event.stopPropagation()}
              onContextMenu={event => event.preventDefault()}
            >
              <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => removeItem(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => removeItem(contextMenu.itemId))}>
                {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 제거" : "목록에서 제거"}
              </div>
              <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => moveItemToStart(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => moveItemToStart(contextMenu.itemId))}>
                {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 맨 위로" : "맨 위로"}
              </div>
              <div className="context-menu-item" role="menuitem" tabIndex={0} onClick={() => moveItemToEnd(contextMenu.itemId)} onKeyDown={event => handleContextMenuKey(event, () => moveItemToEnd(contextMenu.itemId))}>
                {contextMenu.itemIds && contextMenu.itemIds.length > 1 ? "선택 항목 맨 아래로" : "맨 아래로"}
              </div>
            </div>
          )}

          <section className="bottom-panel">
            <section className="status">
              <strong>{busy ? "실행 중" : "상태"}</strong>
              <span>{items.length > 0 ? `${items.length}개 선택됨 · ${status}` : status}</span>
              {lastResultSize && <em>최근 결과 크기: {lastResultSize.width} x {lastResultSize.height}px</em>}
            </section>
            <ControlButton className="primary merge-button" onClick={runStitch} disabled={busy || items.length === 0}>
              PSD 합치기
            </ControlButton>
          </section>
        </div>
      )}

      {activeTab === "settings" && (
        <section className="settings">
          <div className="setting-row">
            <div className="setting-label">스티치 방향</div>
            <div className="segmented-control" role="group" aria-label="스티치 방향">
              <ControlButton className={`segment-button ${stitchMode === "vertical" ? "active" : ""}`} onClick={() => setStitchMode("vertical")} disabled={busy}>
                세로
              </ControlButton>
              <ControlButton className={`segment-button ${stitchMode === "horizontal" ? "active" : ""}`} onClick={() => setStitchMode("horizontal")} disabled={busy}>
                가로
              </ControlButton>
            </div>
          </div>
          <div className="setting-row">
            <span className="setting-label">간격(px)</span>
            <div className="gap-stepper" aria-label="간격 픽셀">
              <ControlButton className="stepper-button" onClick={() => adjustGap(-1)} disabled={busy} ariaLabel="간격 줄이기">
                -
              </ControlButton>
              <div className="gap-value" aria-live="polite">{gap}</div>
              <ControlButton className="stepper-button" onClick={() => adjustGap(1)} disabled={busy} ariaLabel="간격 늘리기">
                +
              </ControlButton>
            </div>
          </div>
          <label className="setting-row check-row">
            <span className="setting-label">스마트 오브젝트를 레이어로 변환</span>
            <input type="checkbox" checked={convertSmartObjects} onChange={event => setConvertSmartObjects(event.target.checked)} disabled={busy} />
          </label>
        </section>
      )}

      {activeTab === "settings" && (
        <section className="status">
          <strong>{busy ? "실행 중" : "상태"}</strong>
          <span>{items.length > 0 ? `${items.length}개 선택됨 · ${status}` : status}</span>
          {lastResultSize && <em>최근 결과 크기: {lastResultSize.width} x {lastResultSize.height}px</em>}
        </section>
      )}
    </div>
  );
}

const stitcherController = new PanelController(() => <App />, {
  id: "stitcher",
  menuItems: [
    { id: "reload", label: "Reload Plugin", enabled: true, checked: false, oninvoke: () => location.reload() }
  ]
});

entrypoints.setup({
  plugin: {
    create() {},
    destroy() {}
  },
  panels: {
    stitcher: stitcherController
  }
});
