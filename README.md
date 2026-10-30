# 專案需求開發工廠

規格見 [docs/spec.md](docs/spec.md)。

## 環境

- Node **24.22.2**（見 `.nvmrc`，`nvm use`）
- pnpm 12

```bash
pnpm install
```

本 repo 只包含前端（Vite + React + TypeScript + React Router + TanStack Query），後端另外開發。

## 專案結構

```
src/
  contracts/   與後端約定的 API 型別與 request body 驗證規則（zod）
  features/    依功能分資料夾：auth、users、settings、roles、topics
  components/  共用元件與版面
  lib/         API client、React Query、表單驗證工具
  mocks/       MSW 模擬 API（只在 dev:mock 模式載入，不會打包進正式版）
  pages/       其他頁面
```

## 開發

```bash
pnpm dev            # 前端，/api 透過 Vite proxy 轉到 http://localhost:3000（可用 API_TARGET 覆寫）
pnpm dev:mock       # 不需要後端，以 MSW 模擬 API（資料存在瀏覽器 localStorage）
pnpm typecheck
pnpm lint
pnpm build
```

### Mock 模式測試帳號

| 帳號 | 密碼 | 權限 |
| --- | --- | --- |
| admin@example.com | admin1234 | 管理者 |
| user@example.com | user1234 | 一般使用者 |

- 模擬 Session 閒置 30 分鐘逾時；在 DevTools 刪除 localStorage 的 `srs-guard-frontend-test-mock-session` 可立即模擬逾時。
- 刪除 `srs-guard-frontend-test-mock-db` 可重設假資料。
- 預設有 4 個主題，涵蓋不同狀態（尚未上傳、審查中、待釐清且有兩個版本、產出失敗），分屬兩個帳號，可用來確認非建立者的唯讀畫面。
- 同一 Email 15 分鐘內登入失敗 5 次會回 429。

## 已完成：F8 帳號與登入（前端）

| 編號 | 內容 | 位置 |
| --- | --- | --- |
| F8-1 | Email + 密碼登入，無註冊入口 | `/login` |
| F8-2 | 使用者管理：建立帳號、停用／啟用、重設密碼（僅管理者，不能停用自己） | `/admin/users` |
| F8-3 | 未登入一律導向登入頁，登入後回到原頁面；任何 API 回 401 視為 Session 逾時並提示 | `RequireAuth` |
| F8-6 | 我的角色 | `/settings` |
| F8-7 | 修改密碼、登出、Session 逾時處理 | `/settings`、頁首 |

F8-4、F8-5（主題的檢視與操作權限）已在 F1 主題頁套用。

## 已完成：F1 主題管理（前端）

| 編號 | 內容 | 位置 |
| --- | --- | --- |
| F1-1 | 建立主題：名稱必填（100 字內）、描述選填（1000 字內），建立後直接進入主題頁 | `/` 建立主題 |
| F1-2 | 主題列表：名稱、建立者、狀態、SRS 版本、最後更新；可切換「全部主題」與「我的主題」（`?scope=mine`） | `/` |
| F1-3 | 主題頁依最新版本狀態顯示步驟條（上傳 → 審查 → 釐清 → 產出）；已完成的步驟可點回去檢視，未解鎖的不能進入；可切換版本（`?v=`、`?step=`） | `/topics/:topicId` |
| F1-4 | 編輯名稱與描述；刪除需輸入主題名稱確認，連同所有版本一併刪除 | 主題頁 |

非建立者進入主題頁時看不到編輯、刪除按鈕，並顯示唯讀提示（F8-5）。各步驟的內容在 F2–F6 實作，目前只有說明文字。

狀態與步驟的對應：無版本或「草稿」→ 上傳；「審查中」→ 審查；「待釐清」→ 釐清；「釐清完成」、「文件產生中」、「已完成」→ 產出；「失敗」依 `failedStage` 停在審查或產出步驟。

### 前端預期的後端 API 契約

Session 以 httpOnly cookie 維持，錯誤格式沿用 NestJS 預設 `{ statusCode, message }`。Request body 的 schema 在 `src/contracts/auth.ts`。

| 方法 | 路徑 | 成功 | 錯誤 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 200 `{ user }`，設定 cookie | 401 帳密錯誤、403 帳號停用、429 限流 |
| POST | `/api/auth/logout` | 204 | |
| GET | `/api/auth/me` | 200 `{ user }` | 401 未登入／逾時 |
| PATCH | `/api/auth/password` | 204 | 400 目前密碼錯誤 |
| PATCH | `/api/me` | 200 `{ user }` | |
| GET | `/api/roles` | 200 `{ roles }` | |
| GET | `/api/users` | 200 `{ users }` | 403 非管理者 |
| POST | `/api/users` | 201 `{ user }` | 409 Email 重複 |
| PATCH | `/api/users/:userId` | 200 `{ user }` | 400 停用自己、404 |
| GET | `/api/topics?scope=all\|mine` | 200 `{ topics }`，依最後更新新到舊 | 400 scope 不正確 |
| POST | `/api/topics` | 201 `{ topic }` | 400 |
| GET | `/api/topics/:topicId` | 200 `{ topic }`（含 `revisions`，新到舊） | 404 |
| PATCH | `/api/topics/:topicId` | 200 `{ topic }` | 403 非建立者、404 |
| DELETE | `/api/topics/:topicId` | 204，連同所有版本與檔案 | 403 非建立者、404 |

主題的型別與 schema 在 `src/contracts/topics.ts`。回傳的主題直接帶 `owner: { id, name }` 與 `currentRevision`（最新版本，未上傳時為 `null`），列表不必再查使用者。版本狀態為 `failed` 時，用 `failedStage: 'review' | 'generate'` 說明是哪一個 AI 步驟失敗。
