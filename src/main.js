import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";
import * as Cesium from "cesium";
import shp from "shpjs";
import wellknown from "wellknown";

const viewer = new Cesium.Viewer("viewer", {
  animation: false,
  timeline: false,
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  baseLayerPicker: false,
  geocoder: false,
});

const fileInput = document.getElementById("fileInput");
const clearBtn = document.getElementById("clearBtn");
const layersEl = document.getElementById("layers");
const logEl = document.getElementById("log");

const loadedDataSources = [];

function log(message) {
  const t = new Date().toLocaleTimeString();
  logEl.textContent = `[${t}] ${message}\n${logEl.textContent}`;
}

function appendLayer(name) {
  const item = document.createElement("li");
  item.textContent = name;
  layersEl.appendChild(item);
}

async function addGeoJSON(geojson, name) {
  const dataSource = await Cesium.GeoJsonDataSource.load(geojson, {
    stroke: Cesium.Color.CYAN,
    fill: Cesium.Color.CYAN.withAlpha(0.25),
    clampToGround: true,
  });
  dataSource.name = name;
  await viewer.dataSources.add(dataSource);
  loadedDataSources.push(dataSource);
  appendLayer(name);
  await viewer.flyTo(dataSource);
}

function wktToGeoJSON(wktText) {
  const geom = wellknown.parse(wktText);
  if (!geom) {
    throw new Error("WKT 解析失败，请检查格式");
  }
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: geom }] };
}

function dxfLikeToGeoJSON(text) {
  // 极简 DXF/LWPOLYLINE 解析，仅用于示例与轻量预览
  const lines = text.split(/\r?\n/);
  const points = [];
  for (let i = 0; i < lines.length - 3; i++) {
    if (lines[i].trim() === "10" && lines[i + 2]?.trim() === "20") {
      const x = Number(lines[i + 1]);
      const y = Number(lines[i + 3]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push([x, y]);
      }
    }
  }
  if (points.length < 2) {
    throw new Error("未识别到可用几何（DWG/DXF）");
  }
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { source: "DWG/DXF" }, geometry: { type: "LineString", coordinates: points } }],
  };
}

async function handleFile(file) {
  const name = file.name;
  const lower = name.toLowerCase();
  log(`开始读取：${name}`);

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    const text = await file.text();
    await addGeoJSON(JSON.parse(text), name);
    log(`已加载 GeoJSON：${name}`);
    return;
  }

  if (lower.endsWith(".wkt") || lower.endsWith(".txt")) {
    const text = await file.text();
    await addGeoJSON(wktToGeoJSON(text), name);
    log(`已加载 WKT：${name}`);
    return;
  }

  if (lower.endsWith(".zip") || lower.endsWith(".shp")) {
    const buffer = await file.arrayBuffer();
    const geojson = await shp(buffer);
    await addGeoJSON(geojson, name);
    log(`已加载 Shapefile：${name}`);
    return;
  }

  if (lower.endsWith(".dwg") || lower.endsWith(".dxf")) {
    const text = await file.text();
    await addGeoJSON(dxfLikeToGeoJSON(text), name);
    log(`已尝试加载 DWG/DXF：${name}`);
    return;
  }

  throw new Error(`不支持的格式：${name}`);
}

fileInput.addEventListener("change", async (event) => {
  const files = [...(event.target.files || [])];
  for (const file of files) {
    try {
      await handleFile(file);
    } catch (error) {
      log(`加载失败 ${file.name}：${error.message}`);
    }
  }
  fileInput.value = "";
});

clearBtn.addEventListener("click", async () => {
  for (const source of loadedDataSources) {
    await viewer.dataSources.remove(source, true);
  }
  loadedDataSources.length = 0;
  layersEl.innerHTML = "";
  log("已清空所有图层");
});

log("系统已启动，可添加 GIS 文件进行预览");
