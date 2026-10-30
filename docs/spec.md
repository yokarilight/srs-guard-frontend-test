# 專案需求開發工廠：需求規格書

Oct 29, 2026 · @Jason Tong · v0.2

## 1. 背景與目標

專案需求開發工廠讓 AI 先把 SRS 與 Figma 的缺漏問清楚，再把需求拆成各職位專屬的 markdown 文件。MVP 先在 localhost 開發與執行，之後再部署到外網；需登入才能使用。

**現況問題**

- Figma 設計稿只畫部分畫面，缺少完整的使用者操作流程。
- SRS 品質不穩定，有時過於簡略，有時冗長到抓不到重點。
- 前端、後端、QA、主管都無法第一時間知道自己要做什麼。

**目標**

1. 開發前由 AI 審查 SRS（PDF）與 Figma 輸入，列出不合理、矛盾或缺漏之處，並強制釐清後才能往下走。
2. 依釐清結果產出各角色文件：前端、後端、QA、主管，外加使用者自訂的角色。
3. SRS 更新時重新審查整份，角色文件保留歷史版本。

## 2. 技術架構

建議用 pnpm workspace 把前後端放在同一個 repo，共用 TypeScript 型別。AI 呼叫一律走後端，API key 不進前端。

| 層 | 技術 | 說明 |
| --- | --- | --- |
| Repo 結構 | pnpm workspace | `apps/web`、`apps/server`、`packages/shared`（型別、狀態列舉、zod schema） |
| 前端 | Vite + TypeScript + React | 建議搭配 React Router、TanStack Query；markdown 渲染用 react-markdown + remark-gfm |
| 後端 | Node.js + NestJS + TypeScript | 依模組拆分：auth、users、topics、revisions、issues、roles、documents、ai；負責檔案上傳、呼叫 AI、狀態控管 |
| 資料庫 | MongoDB Atlas | 存使用者、主題、SRS 版本、問題、對話、角色文件；搭配 @nestjs/mongoose |
| 檔案儲存 | MongoDB GridFS | 存 PDF 與截圖，免另外架物件儲存 |
| AI | Anthropic Claude API（官方 Node SDK） | 審查與產出文件用 `claude-opus-5-5`，對話釐清用 `claude-haiku-5-5`；模型名稱放環境變數方便替換。PDF 以文件區塊、截圖以圖片區塊送入 |
| 進度回報 | Server-Sent Events | 審查與產生文件以背景任務執行，前端顯示進度與串流內容 |
| 執行環境 | localhost | 前端用 Vite dev server，後端在本機跑 NestJS，透過 Vite proxy 把 `/api` 轉到後端 |

**AI 輸出格式**：要求 Claude 以結構化 JSON 回傳問題清單與文件內容（例如透過 tool use 定義 schema），後端驗證後存 DB，再組成 markdown 供檢視與下載。這樣問題狀態才能逐項追蹤，不必解析自由文字。

**Figma 輸入**：公司沒有 Figma Personal Access Token，AI 無法讀取 Figma 連結內容。設計稿審查以上傳的截圖為準；連結只作為參考，附在問題清單與角色文件中。

## 3. 使用者角色與核心流程

所有人都需登入。建立主題的人是該主題的上傳者，只有他能上傳、回答 AI 的問題與產出文件；其他登入者都能檢視所有主題與角色文件（唯讀）。

| 角色 | 在系統中的行為 |
| --- | --- |
| 管理者 | 建立、停用帳號與重設密碼；同時具備一般使用者的權限 |
| 上傳者（主題建立者） | 建立主題、上傳 SRS 與 Figma、回答 AI 的問題、選擇要產出的角色 |
| 前端、後端、QA、主管 | 登入後直接檢視或下載自己角色的文件；設定「我的角色」後，開啟文件時預設顯示該角色 |
| 自訂角色 | 同上，例如設計師、PM、DevOps |


![流程圖](flow-chart.webp)

釐清關卡在「都已處理？」：未通過就留在釐清步驟。每個版本的狀態依序為 草稿 → 審查中 → 待釐清 → 釐清完成 → 文件產生中 → 已完成，任一 AI 步驟失敗時標為「失敗」並可重試。

## 4. 功能需求

共 8 個模組。編號用於後續拆票與 QA 對照。

### F1. 主題管理

- F1-1 建立主題：名稱（必填）、描述（選填）
- F1-2 主題列表：顯示名稱、建立者、目前狀態、SRS 版本號、最後更新時間；可切換「全部主題」與「我的主題」
- F1-3 進入主題頁，依狀態顯示目前步驟
- F1-4 編輯主題名稱與描述、刪除主題（刪除需二次確認，連同所有版本與檔案）

### F2. 輸入上傳（SRS + Figma）

- F2-1 上傳 SRS PDF（單檔，30 頁、20 MB 以內；前端先檢查並提示，後端再驗證一次）
- F2-2 上傳 Figma 截圖（多張，PNG / JPG），可為每張加上畫面名稱
- F2-3 貼上 Figma 連結（可多個），僅作為參考附在文件中；AI 不讀取連結內容，設計稿審查以截圖為準
- F2-4 頁面內預覽 PDF 與截圖
- F2-5 至少需有 SRS 才能開始審查；Figma 為選填

### F3. AI 審查與問題清單

- F3-1 使用者按「開始審查」後執行，顯示進度
- F3-2 審查範圍：SRS 內部的缺漏與矛盾，以及 SRS 與 Figma 之間的落差（例如 SRS 有功能但沒有畫面、畫面缺少錯誤或空狀態、流程中斷）
- F3-3 每個問題項目包含：
  - 編號（如 ISS-001）
  - 類型：缺漏、矛盾、模糊、不可行、流程不完整、設計稿缺漏
  - 嚴重度：阻擋開發、建議修正、提醒
  - 來源位置：SRS 頁碼或段落、Figma 畫面名稱
  - 問題說明與建議釐清方向
  - 受影響角色
  - 狀態：未處理、已釐清、接受現狀、不適用
- F3-4 問題清單可在頁面檢視，並下載為 `issues.md`
- F3-5 審查完全沒有問題時，直接進入「釐清完成」

### F4. 釐清互動

- F4-1 每個問題項目有獨立對話串，使用者回答或補充，AI 回覆追問或確認
- F4-2 AI 判斷已釐清時提出結論摘要，使用者確認後狀態改為「已釐清」
- F4-3 使用者可手動標記「接受現狀」或「不適用」，需填寫原因
- F4-4 釐清結論存入 DB，作為產生角色文件的依據
- F4-5 所有問題項目（不分嚴重度）都處理完，才解鎖「產生角色文件」
- F4-6 顯示釐清進度，例如 12 / 15 已處理

### F5. 角色管理

- F5-1 預設角色：前端、後端、QA、主管
- F5-2 新增自訂角色：名稱、職責描述、希望文件包含的章節（選填）
- F5-3 每個主題可勾選這次要產出哪些角色
- F5-4 自訂角色為全域設定，所有主題共用

### F6. 角色文件產出

- F6-1 依「SRS + Figma + 釐清結論」為每個勾選的角色各產出一份 markdown
- F6-2 預設角色的文件內容：
  - **前端**：頁面與元件清單、完整使用者操作流程、表單欄位與驗證規則、各畫面狀態（loading、empty、error、權限不足）、需串接的 API、Figma 缺少的畫面
  - **後端**：資料模型、API 規格（路徑、參數、回應、錯誤碼）、商業規則、權限、排程或外部串接
  - **QA**：測試範圍、測試案例（正常、邊界、例外）、驗收標準、測試資料需求
  - **主管**：需求一頁摘要、範圍內與範圍外、風險與接受現狀的項目、跨角色相依關係、工作項目清單（供估工）
- F6-3 自訂角色依其職責描述產生
- F6-4 每條需求標註來源（SRS 頁碼、Figma 畫面或 ISS 編號）
- F6-5 依角色分頁檢視，渲染 markdown
- F6-6 單檔下載 `.md`，或全部打包成 `.zip`

### F7. 版本管理

- F7-1 上傳新版 SRS 時建立新版本（v1、v2…），重新審查整份並重新走釐清流程
- F7-2 舊版本的問題清單、釐清紀錄、角色文件全部保留且唯讀
- F7-3 可切換檢視任一版本的角色文件與問題清單
- F7-4 新版審查時，AI 參考上一版的釐清結論，已釐清的問題不重複詢問；上一版標為「接受現狀」的項目一律重新列出，讓使用者再確認一次

### F8. 帳號與登入

- F8-1 Email + 密碼登入，不開放公開註冊
- F8-2 帳號由管理者在「使用者管理」頁建立，可停用帳號與重設密碼；第一位管理者由部署後執行的初始化腳本建立
- F8-3 未登入時所有頁面導向登入頁，所有 API 皆需驗證
- F8-4 所有登入者都能檢視全部主題、問題清單、釐清紀錄與角色文件（唯讀）
- F8-5 只有主題建立者能上傳、回答問題、產出文件與刪除主題
- F8-6 使用者可設定「我的角色」，開啟角色文件時預設顯示該角色
- F8-7 修改密碼、登出與 Session 逾時

## 5. 非功能需求

| 項目 | 要求 |
| --- | --- |
| 安全 | 除登入外所有 API 需驗證；API key 與 MongoDB 連線字串只存在後端環境變數；Atlas 的 IP 清單只開放開發者的 IP，DB 帳號只給最小權限；密碼以 bcrypt 或 argon2 雜湊，Session 用 httpOnly cookie |
| 上傳驗證 | 後端檢查檔案類型（PDF、PNG、JPG）、PDF 30 頁、20 MB 以內，截圖單張大小上限 |
| 濫用防護 | 登入與 AI 相關 API 設定限流，避免暴力破解與 token 費用暴增 |
| 長任務 | 審查與產生文件以背景任務執行，SSE 回報進度；狀態即時寫入 DB，關閉頁面再回來可看到目前狀態 |
| 失敗處理 | AI 呼叫失敗或回傳格式不符時自動重試，最終失敗則狀態回到上一步並顯示錯誤，可手動重試 |
| 可追溯 | 角色文件每條需求都能對應回 SRS 頁碼、Figma 畫面或 ISS 編號 |
| 一致性 | 同一版本的所有角色文件來自同一份釐清結論，避免各角色資訊互相矛盾 |
| 成本 | 記錄每次 AI 呼叫的模型與 token 用量，方便評估費用 |
| 語言 | 介面與產出文件預設為繁體中文 |

## 6. 資料模型

以「主題 → 版本」為主軸：每次上傳新 SRS 都產生一個 Revision，問題、對話、角色文件都掛在 Revision 底下，舊版自然保留。

```ts
// MongoDB collections（初稿）
User {
  _id, email, passwordHash, name, role, preferredRoleId?, disabled,
  createdAt
}

Topic {
  _id, ownerId,                  // 建立者，只有他能操作
  name, description,
  currentRevisionId,
  createdAt, updatedAt
}

Revision {                       // 每份 SRS 一個版本
  _id, topicId, version,         // 1, 2, 3...
  status: 'draft' | 'reviewing' | 'clarifying' | 'clarified'
        | 'generating' | 'completed' | 'failed',
  srsFileId, srsPageCount,       // GridFS，<= 30 頁、20 MB
  figmaScreens: [{ fileId, name }],
  figmaLinks: [{ url, label? }], // 只存參考，不讀取
  selectedRoleIds: [],
  createdAt
}

Issue {
  _id, revisionId, code,         // ISS-001
  type, severity,
  sourceRefs: [{ kind: 'srs' | 'figma', page?, section?, screen? }],
  description, suggestion,
  affectedRoles: [],
  status: 'open' | 'resolved' | 'accepted' | 'not_applicable',
  resolution,                    // 釐清結論或接受原因
  carriedFromIssueId?,           // 從上一版「接受現狀」重提的項目
  createdAt, updatedAt
}

IssueMessage {
  _id, issueId, author: 'user' | 'ai', content, createdAt
}

Role {                           // 預設 + 自訂
  _id, key, name, description,
  sections: [],                  // 希望文件包含的章節
  isBuiltIn
}

RoleDocument {
  _id, revisionId, roleId,
  markdown, generatedAt
}

AiRun {                          // 追蹤長任務與 token 用量
  _id, revisionId, roleId?, kind: 'review' | 'clarify' | 'generate',
  model, status, inputTokens, outputTokens,
  error?, startedAt, finishedAt
}
```

## 7. API 草案

REST 為主，長任務另提供 SSE 事件串流。

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/api/topics` | 主題列表 |
| POST | `/api/topics` | 建立主題 |
| GET / PATCH / DELETE | `/api/topics/:topicId` | 主題詳情、編輯、刪除 |
| POST | `/api/topics/:topicId/revisions` | 上傳 SRS PDF，建立新版本（multipart） |
| GET | `/api/revisions/:revisionId` | 版本詳情與狀態 |
| POST | `/api/revisions/:revisionId/figma/screens` | 上傳 Figma 截圖 |
| POST | `/api/revisions/:revisionId/figma/links` | 新增 Figma 連結 |
| POST | `/api/revisions/:revisionId/review` | 開始 AI 審查 |
| GET | `/api/revisions/:revisionId/issues` | 問題清單 |
| GET | `/api/revisions/:revisionId/issues.md` | 下載問題清單 markdown |
| GET / POST | `/api/issues/:issueId/messages` | 取得對話、送出回答 |
| PATCH | `/api/issues/:issueId` | 手動改狀態（接受現狀、不適用，附原因） |
| POST | `/api/revisions/:revisionId/generate` | 產生角色文件（body 帶 roleIds） |
| GET | `/api/revisions/:revisionId/documents` | 角色文件列表 |
| GET | `/api/documents/:documentId/download` | 下載單一 `.md` |
| GET | `/api/revisions/:revisionId/documents.zip` | 打包下載全部 |
| GET / POST / PATCH / DELETE | `/api/roles` | 角色管理 |
| GET | `/api/revisions/:revisionId/events` | SSE：審查、對話、產生文件的進度 |

另加以下 API：

- 驗證：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`、`PATCH /api/auth/password`
- 個人設定：`PATCH /api/me`（我的角色）
- 使用者管理（僅管理者）：`GET / POST /api/users`、`PATCH /api/users/:userId`（停用、重設密碼）

除登入外所有 API 都需驗證；讀取對所有登入者開放，主題相關的寫入只限建立者。

## 8. 頁面結構

主題頁採「步驟條 + 內容區」設計，步驟依版本狀態鎖定或解鎖，使用者一眼看出卡在哪一步。

| 路由 | 頁面 | 主要內容 |
| --- | --- | --- |
| `/` | 主題列表 | 主題卡片或表格、狀態標籤、建立主題按鈕 |
| `/topics/:topicId` | 主題頁 | 步驟條（上傳 → 審查 → 釐清 → 產出）、版本切換下拉選單 |
| ├ 上傳 | 步驟 1 | PDF 上傳與預覽、Figma 截圖與連結、開始審查 |
| ├ 審查 | 步驟 2 | 進度顯示、串流中的審查結果 |
| ├ 釐清 | 步驟 3 | 左側問題清單（可依嚴重度、狀態、角色篩選），右側該問題的對話串與狀態操作；頂部進度條；下載 `issues.md` |
| └ 產出 | 步驟 4 | 勾選角色、產生按鈕；完成後依角色分頁顯示 markdown，提供單檔與 zip 下載 |
| `/roles` | 角色管理 | 預設角色（唯讀）與自訂角色的新增、編輯、刪除 |

另加 `/login` 登入頁（未登入時一律導向此頁）、`/settings` 個人設定（我的角色、修改密碼）、`/admin/users` 使用者管理（僅管理者）。非建立者進入主題頁時，所有操作按鈕隱藏，只能檢視與下載。

## 9. MVP 範圍與待決事項

MVP 交付 F1–F8 的完整主流程，先在 localhost 開發，需登入；多人協作與外部串接延到之後的版本。

| 範圍 | 項目 |
| --- | --- |
| MVP 包含 | 登入、主題管理、SRS PDF 上傳（30 頁、20 MB 以內）、使用者管理、Figma 截圖上傳、AI 審查、逐項釐清、預設與自訂角色、角色文件產出與下載、版本保留 |
| MVP 簡化 | Figma 連結只存參考、不讀取內容；不開放公開註冊，帳號由管理者建立 |
| 之後版本 | 多人協作回答、細緻權限、新舊版本差異比對、推送到 Jira 或 Notion、文件範本自訂、Figma API 串接、部署到外網（屆時再評估平台的上傳大小與執行時間限制） |

### 已決事項

| 項目 | 決定 |
| --- | --- |
| 部署 | 現階段在 localhost 開發；之後部署到外網，需登入 |
| 帳號建立 | 管理者手動建立 |
| 檢視權限 | 所有登入者都能檢視他人的主題與角色文件 |
| 釐清關卡 | 所有問題項目（不分嚴重度）都處理完才能產出文件 |
| 後端框架 | NestJS |
| Figma | 沒有 Personal Access Token；AI 只看截圖，連結僅作參考 |
| SRS 上限 | 30 頁、20 MB 以內 |
| 模型 | 審查與產出用能力較強的模型（`claude-opus-5-5`），對話釐清用較快的模型（`claude-haiku-5-5`） |
| 接受現狀的項目 | 新版審查時重新列出，再確認一次 |

### 待決事項

目前沒有待決事項。
