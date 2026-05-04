import React, { useMemo, useState } from "react";

import "./styles.css";

import { entrypoints } from "uxp";
import { PanelController } from "./controllers/PanelController.jsx";

const { app, core, constants } = require("photoshop");
const { storage } = require("uxp");

const fs = storage.localFileSystem;

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

function roundPixel(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.round(number)) : 1;
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

async function stitchPsdFiles(items, options, onProgress) {
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

function App() {
  const [items, setItems] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const [gap, setGap] = useState(0);
  const [closeSources, setCloseSources] = useState(true);
  const [activeTab, setActiveTab] = useState("files");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("PSD 조각을 선택하세요.");
  const [lastMetrics, setLastMetrics] = useState([]);

  const totalPreviewHeight = useMemo(() => {
    if (lastMetrics.length === 0) {
      return null;
    }
    return lastMetrics.reduce((sum, metric) => sum + metric.height, 0) + Math.max(0, lastMetrics.length - 1) * Number(gap || 0);
  }, [lastMetrics, gap]);

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
    setLastMetrics([]);
    setStatus(`${nextItems.length}개 PSD를 불러왔습니다. 순서를 확인하세요.`);
  }

  async function runStitch() {
    if (busy || items.length === 0) {
      return;
    }
    setBusy(true);
    setStatus("Photoshop에서 PSD를 여는 중입니다.");
    setLastMetrics([]);
    try {
      const metrics = await stitchPsdFiles(
        items,
        {
          gap: Number(gap) || 0,
          closeSources,
          outputName: "PSD Stitch"
        },
        message => setStatus(message)
      );
      setLastMetrics(metrics);
      setStatus(`완료: ${items.length}개 PSD를 세로로 합쳤습니다.`);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function updateGap(event) {
    const value = Math.max(0, Math.round(Number(event.target.value) || 0));
    setGap(value);
  }

  function moveUp(index) {
    setItems(current => moveItem(current, index, index - 1));
  }

  function moveDown(index) {
    setItems(current => moveItem(current, index, index + 1));
  }

  function handleDrop(index) {
    if (dragIndex === null) {
      return;
    }
    setItems(current => moveItem(current, dragIndex, index));
    setDragIndex(null);
  }

  return (
    <div className="app-shell">
      <nav className="tabs" aria-label="PSD Stitcher sections">
        <button
          className={activeTab === "files" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("files")}
        >
          파일
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("settings")}
        >
          설정
        </button>
      </nav>

      {activeTab === "files" && (
        <div className="tab-panel">
          <section className="toolbar">
            <button className="primary" type="button" onClick={chooseFiles} disabled={busy}>
              PSD 파일 열기
            </button>
            <button className="secondary" type="button" onClick={() => setItems(sortItems(items))} disabled={busy || items.length < 2}>
              이름순 정렬
            </button>
            <button className="primary" type="button" onClick={runStitch} disabled={busy || items.length === 0}>
              합치기 실행
            </button>
          </section>

          <div className="section-title">선택한 PSD <span>{items.length}</span></div>
          <section className="file-list" aria-label="PSD order">
            {items.length === 0 ? (
              <div className="empty">PSD/PSB 파일을 여러 개 선택하면 여기에 순서가 표시됩니다.</div>
            ) : (
              items.map((item, index) => {
                const metric = lastMetrics.find(entry => entry.id === item.id);
                return (
                  <div
                    className="file-row"
                    key={item.id}
                    draggable={!busy}
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="file-icon" aria-hidden="true" />
                    <div className="file-main">
                      <strong>{item.name}</strong>
                    </div>
                    <div className="file-date">
                      {metric ? `${metric.width} x ${metric.height}px` : item.modifiedLabel}
                    </div>
                    <div className="index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="row-actions">
                      <button type="button" aria-label="위로 이동" title="위로 이동" onClick={() => moveUp(index)} disabled={busy || index === 0}>▲</button>
                      <button type="button" aria-label="아래로 이동" title="아래로 이동" onClick={() => moveDown(index)} disabled={busy || index === items.length - 1}>▼</button>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}

      {activeTab === "settings" && (
        <section className="settings">
          <label>
            간격(px)
            <input type="number" min="0" step="1" value={gap} onChange={updateGap} disabled={busy} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={closeSources} onChange={event => setCloseSources(event.target.checked)} disabled={busy} />
            원본 PSD 탭 닫기
          </label>
        </section>
      )}

      <section className="status">
        <strong>{busy ? "실행 중" : "상태"}</strong>
        <span>{items.length > 0 ? `${items.length}개 선택됨 · ${status}` : status}</span>
        {totalPreviewHeight !== null && <em>최근 결과 높이: {totalPreviewHeight}px</em>}
      </section>
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
