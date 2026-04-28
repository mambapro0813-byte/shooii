# Cesium GIS 数据预览工具

一个基于 Cesium 的轻量 GIS 数据预览软件，支持快速加载并查看常见地理数据格式。

## 支持格式

- GeoJSON (`.geojson` / `.json`)
- Shapefile (`.zip` / `.shp`)
- WKT (`.wkt` / `.txt`)
- DWG / DXF（浏览器端按 DXF 文本兼容方式解析）

> 说明：二进制 DWG 在纯前端环境下无法稳定直接解析，建议在生产中先转换为 DXF/GeoJSON。

## 启动

```bash
npm install
npm run dev
```

## 构成

- `index.html`：页面布局与文件导入控件
- `src/main.js`：Cesium 初始化与多格式解析逻辑
- `src/style.css`：界面样式
