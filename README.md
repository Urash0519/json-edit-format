# JSON Studio

無廣告、純前端的 JSON 格式化與雙欄比對工具，適合檢查 API 回應、設定檔及日常 JSON 資料。

**線上使用：<https://Urash0519.github.io/json-edit-format/>**

## 功能

- 左右獨立的 CodeMirror 編輯器：語法上色、行號、折疊、搜尋與復原。
- 嚴格 JSON 驗證，中文錯誤訊息與點擊定位；拒絕註解、尾端逗號及重複屬性。
- 格式化（2 / 4 格縮排）與壓縮，保留大整數、小數及指數的原始數字文字，不會因浮點轉換遺失精度。
- 結構比對：忽略空白與物件鍵順序，保留陣列順序；列出新增、刪除、修改及 JSON Pointer 路徑。點擊值可跳回對應編輯位置。
- 支援檔案開啟、複製、下載、交換左右，手機可上下排列操作。
- 所有依賴隨網站打包，無廣告、分析追蹤或第三方 CDN 請求。

## 使用方式

1. 在任一編輯器貼上 JSON，或按「開啟檔案」。
2. 下方即時顯示驗證結果。按錯誤訊息可定位；按「格式化」整理縮排。
3. 兩側都放入合法 JSON 後，按「比對內容」。修改資料後請重新比對。
4. 離開前自行複製或下載。資料不會自動保存，重新整理即清空。

快捷鍵：`Ctrl / Cmd + Enter` 格式化目前編輯器；`Ctrl / Cmd + F` 搜尋；`Ctrl / Cmd + Z` 復原（包含清空操作）。

## 隱私與限制

JSON 只存在目前分頁的記憶體，不會上傳，也不使用 localStorage。GitHub Pages 仍會接收正常的網站資源請求，但不會收到編輯器內容。

檔案匯入上限 5 MB。比對最多顯示前 500 筆差異，每個值預覽最多 400 個字元；完整資料保留於編輯器。陣列依索引逐項比對，插入項目可能造成多筆差異。數值 `1`、`1.0`、`1e0` 視為相等。重複屬性名稱會視為錯誤，避免比對時忽略資料。這是一般大小 JSON 的工具；極深巢狀或大量貼上可能受瀏覽器效能限制。不包含原參考網站的雲端儲存、表格模式或 Schema 驗證。

## 本機開發

需要 Node.js 24 與 npm。

```sh
npm ci
npm run dev
```

```sh
npm test        # 驗證、數字精度、結構差異等核心測試
npm run build  # 輸出靜態檔案至 dist/
npm run preview
```

技術：Vite、JavaScript、CodeMirror 6、Microsoft jsonc-parser。格式化直接編輯語法文字；比對使用語法樹，數字以十進位係數與 BigInt 指數正規化，不經浮點數比較。

## GitHub Pages 部署

在儲存庫 **Settings → Pages → Source** 選擇 **GitHub Actions**。推送到 `main` 後，`.github/workflows/deploy.yml` 自動安裝鎖定依賴、執行測試、建置並部署；也可從 Actions 手動執行。Vite 使用相對資源路徑，支援此儲存庫的子目錄網址。

部署不需要新增個人 access token：工作流程使用 GitHub 提供的 `GITHUB_TOKEN` 與 Pages OIDC 權限。

## 參考

操作需求參考 [JSON Editor Online](https://jsoneditoronline.org/)，介面與實作獨立製作，未複製其程式或品牌素材。
