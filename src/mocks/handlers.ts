import {
  changePasswordSchema,
  createRoleSchema,
  createTopicSchema,
  createFigmaLinkSchema,
  createUserSchema,
  generateDocumentsSchema,
  LINK_MAX_COUNT,
  renameFigmaScreenSchema,
  SCREEN_MAX_BYTES,
  SCREEN_MAX_COUNT,
  screenNameSchema,
  SRS_MAX_BYTES,
  SRS_MAX_PAGES,
  loginSchema,
  topicScopes,
  updateRoleSchema,
  updateTopicSchema,
  updateMeSchema,
  updateUserSchema,
  type ApiErrorBody,
  type FigmaLink,
  type FigmaScreen,
  type Role,
  type RevisionDetail,
  type RevisionSummary,
  type StoredFile,
  type TopicDetail,
  type TopicScope,
  type TopicSummary,
} from '../contracts/index.ts'
import { delay, http, HttpResponse } from 'msw'
import type { z } from 'zod'
import { formatBytes } from '../lib/format.ts'
import { countPdfPages, isPdf } from '../lib/pdf.ts'
import { deleteFiles, getFile, putFile } from './fileStore.ts'
import {
  currentUser,
  db,
  endSession,
  findUserByEmail,
  persist,
  sampleFileOf,
  startSession,
  toPublicUser,
  type MockRevision,
  type MockTopic,
} from './db.ts'

function error(statusCode: number, message: string) {
  return HttpResponse.json<ApiErrorBody>({ statusCode, message }, { status: statusCode })
}

async function parseBody<S extends z.ZodType>(request: Request, schema: S) {
  const result = schema.safeParse(await request.json().catch(() => null))
  return result.success
    ? { data: result.data, response: null }
    : { data: null, response: error(400, result.error.issues.map((i) => i.message).join('、')) }
}

function requireUser() {
  const user = currentUser()
  return user ? { user, response: null } : { user: null, response: error(401, 'Unauthorized') }
}

function requireAdmin() {
  const auth = requireUser()
  if (auth.user && auth.user.role !== 'admin') return { user: null, response: error(403, 'Forbidden') }
  return auth
}

function toRevisionSummary({
  topicId: _topicId,
  srs: _srs,
  figmaScreens: _screens,
  figmaLinks: _links,
  reviewFinishAt: _reviewAt,
  generateFinishAt: _generateAt,
  ...revision
}: MockRevision): RevisionSummary {
  return revision
}

function toRevisionDetail({ reviewFinishAt: _reviewAt, generateFinishAt: _generateAt, ...revision }: MockRevision): RevisionDetail {
  return revision
}

function touchTopic(topicId: string) {
  const topic = db.topics.find((t) => t.id === topicId)
  if (topic) topic.updatedAt = new Date().toISOString()
}

/**
 * 模擬背景任務：
 * - 審查的時間到了就進入待釐清（問題清單在 F3 實作）
 * - 產生文件的時間到了就標為已完成（實際文件內容在 F6 實作）
 */
function settleTasks(revision: MockRevision) {
  const now = Date.now()
  if (revision.status === 'reviewing' && revision.reviewFinishAt && revision.reviewFinishAt <= now) {
    revision.status = 'clarifying'
    delete revision.reviewFinishAt
  } else if (revision.status === 'generating' && revision.generateFinishAt && revision.generateFinishAt <= now) {
    revision.status = 'completed'
    delete revision.generateFinishAt
  } else {
    return
  }
  touchTopic(revision.topicId)
  persist()
}

/** 該主題的所有版本，新到舊 */
function revisionsOf(topicId: string) {
  const revisions = db.revisions.filter((r) => r.topicId === topicId).sort((a, b) => b.version - a.version)
  revisions.forEach(settleTasks)
  return revisions
}

/** 自訂角色只限管理者修改，預設角色不可修改或刪除 */
function findCustomRole(roleId: unknown) {
  const role = db.roles.find((r) => r.id === roleId)
  if (!role) return { role: null, response: error(404, '角色不存在') }
  if (role.isBuiltIn) return { role: null, response: error(403, '預設角色無法修改或刪除') }
  return { role, response: null }
}

/** 角色名稱不分大小寫不可重複（含預設角色） */
function isRoleNameTaken(name: string, exceptId?: string) {
  const normalized = name.toLowerCase()
  return db.roles.some((r) => r.id !== exceptId && r.name.toLowerCase() === normalized)
}

/** 有人設為「我的角色」或有版本選擇產出此角色時，視為使用中 */
function roleUsage(roleId: string) {
  return {
    users: db.users.filter((u) => u.preferredRoleId === roleId).length,
    revisions: db.revisions.filter((r) => r.selectedRoleIds.includes(roleId)).length,
  }
}

function toTopicSummary({ ownerId, ...topic }: MockTopic): TopicSummary {
  const owner = db.users.find((u) => u.id === ownerId)
  const latest = revisionsOf(topic.id)[0]
  return {
    ...topic,
    owner: { id: ownerId, name: owner?.name ?? '（已刪除的使用者）' },
    currentRevision: latest ? toRevisionSummary(latest) : null,
  }
}

function toTopicDetail(topic: MockTopic): TopicDetail {
  return { ...toTopicSummary(topic), revisions: revisionsOf(topic.id).map(toRevisionSummary) }
}

/** 主題相關的寫入只限建立者 */
function findOwnTopic(topicId: unknown, userId: string) {
  const topic = db.topics.find((t) => t.id === topicId)
  if (!topic) return { topic: null, response: error(404, '主題不存在') }
  if (topic.ownerId !== userId) return { topic: null, response: error(403, '只有主題建立者可以進行此操作') }
  return { topic, response: null }
}

function findRevision(revisionId: unknown) {
  const revision = db.revisions.find((r) => r.id === revisionId)
  if (revision) settleTasks(revision)
  return revision
}

/** 版本相關的寫入只限建立者；draftOnly 時另需為最新版本且尚未開始審查 */
function findOwnRevision(revisionId: unknown, userId: string, { draftOnly = false } = {}) {
  const revision = findRevision(revisionId)
  if (!revision) return { revision: null, response: error(404, '版本不存在') }
  const { topic, response } = findOwnTopic(revision.topicId, userId)
  if (!topic) return { revision: null, response }
  if (draftOnly && (revisionsOf(topic.id)[0]?.id !== revision.id || revision.status !== 'draft')) {
    return { revision: null, response: error(409, '此版本已開始審查，無法再修改 SRS 與 Figma') }
  }
  return { revision, response: null }
}

/** 依檔頭判斷實際類型，不信任副檔名與 Content-Type */
async function sniffContentType(file: Blob) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (isPdf(head)) return 'application/pdf'
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png'
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  return null
}

async function readForm(request: Request) {
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  return { form, file: file instanceof File ? file : null }
}

async function storeFile(file: File, contentType: string): Promise<StoredFile> {
  const stored: StoredFile = {
    id: `f-${crypto.randomUUID()}`,
    fileName: file.name,
    contentType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
  await putFile(stored.id, file)
  return stored
}

/** F2-1 後端驗證：PDF、20 MB、30 頁以內 */
async function validateSrs(
  file: File | null,
): Promise<{ file: File; pageCount: number; response: null } | { file: null; pageCount: null; response: Response }> {
  const invalid = (message: string) => ({ file: null, pageCount: null, response: error(400, message) })
  if (!file) return invalid('請選擇要上傳的 SRS PDF')
  if ((await sniffContentType(file)) !== 'application/pdf') return invalid('只能上傳 PDF 檔')
  if (file.size > SRS_MAX_BYTES) {
    return invalid(`SRS 檔案超過 ${formatBytes(SRS_MAX_BYTES)} 上限`)
  }
  const pageCount = await countPdfPages(file).catch(() => null)
  if (pageCount === null) return invalid('無法讀取 PDF 頁數，檔案可能已損毀或加密')
  if (pageCount > SRS_MAX_PAGES) {
    return invalid(`SRS 共 ${pageCount} 頁，超過 ${SRS_MAX_PAGES} 頁上限`)
  }
  return { file, pageCount, response: null }
}

/** 版本之間會共用檔案（沿用 SRS、複製截圖），只刪除已經沒有任何版本使用的檔案；須在更新 db 之後呼叫 */
function releaseFiles(fileIds: string[]) {
  const inUse = new Set(db.revisions.flatMap(fileIdsOf))
  return deleteFiles(fileIds.filter((id) => !inUse.has(id)))
}

function fileIdsOf(revision: MockRevision) {
  return [revision.srs.id, ...revision.figmaScreens.map((s) => s.file.id)]
}

function findStoredFile(fileId: unknown): StoredFile | undefined {
  for (const revision of db.revisions) {
    if (revision.srs.id === fileId) return revision.srs
    const screen = revision.figmaScreens.find((s) => s.file.id === fileId)
    if (screen) return screen.file
  }
  return undefined
}

// 登入限流：同一個 Email 15 分鐘內失敗 5 次就鎖住
const MAX_FAILURES = 5
const FAILURE_WINDOW_MS = 15 * 60 * 1000
const loginFailures = new Map<string, number[]>()

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await delay(300)
    const { data, response } = await parseBody(request, loginSchema)
    if (!data) return response

    const recent = (loginFailures.get(data.email) ?? []).filter((t) => t > Date.now() - FAILURE_WINDOW_MS)
    if (recent.length >= MAX_FAILURES) return error(429, 'Too Many Requests')

    const user = findUserByEmail(data.email)
    if (!user || user.password !== data.password) {
      loginFailures.set(data.email, [...recent, Date.now()])
      return error(401, 'Email 或密碼錯誤')
    }
    if (user.disabled) return error(403, '帳號已停用')

    loginFailures.delete(data.email)
    startSession(user.id)
    return HttpResponse.json({ user: toPublicUser(user) })
  }),

  http.post('/api/auth/logout', () => {
    endSession()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/auth/me', () => {
    const { user, response } = requireUser()
    if (!user) return response
    return HttpResponse.json({ user: toPublicUser(user) })
  }),

  http.patch('/api/auth/password', async ({ request }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, changePasswordSchema)
    if (!body.data) return body.response
    if (body.data.currentPassword !== user.password) return error(400, '目前密碼不正確')
    user.password = body.data.newPassword
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('/api/me', async ({ request }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, updateMeSchema)
    if (!body.data) return body.response
    const { preferredRoleId } = body.data
    if (preferredRoleId && !db.roles.some((r) => r.id === preferredRoleId)) return error(400, '角色不存在')
    user.preferredRoleId = preferredRoleId
    persist()
    return HttpResponse.json({ user: toPublicUser(user) })
  }),

  http.get('/api/roles', () => {
    const { user, response } = requireUser()
    if (!user) return response
    return HttpResponse.json({ roles: db.roles })
  }),

  http.post('/api/roles', async ({ request }) => {
    const { user, response } = requireAdmin()
    if (!user) return response
    const body = await parseBody(request, createRoleSchema)
    if (!body.data) return body.response
    if (isRoleNameTaken(body.data.name)) return error(409, '已有相同名稱的角色')
    const id = crypto.randomUUID()
    const role: Role = { ...body.data, id: `r-${id}`, key: `custom-${id}`, isBuiltIn: false }
    db.roles.push(role)
    persist()
    return HttpResponse.json({ role }, { status: 201 })
  }),

  http.patch('/api/roles/:roleId', async ({ request, params }) => {
    const { user, response } = requireAdmin()
    if (!user) return response
    const body = await parseBody(request, updateRoleSchema)
    if (!body.data) return body.response
    const { role, response: denied } = findCustomRole(params.roleId)
    if (!role) return denied
    if (body.data.name && isRoleNameTaken(body.data.name, role.id)) return error(409, '已有相同名稱的角色')
    Object.assign(role, body.data)
    persist()
    return HttpResponse.json({ role })
  }),

  http.delete('/api/roles/:roleId', async ({ params }) => {
    const { user, response } = requireAdmin()
    if (!user) return response
    const { role, response: denied } = findCustomRole(params.roleId)
    if (!role) return denied
    const usage = roleUsage(role.id)
    if (usage.users > 0 || usage.revisions > 0) {
      const reasons = [
        usage.users > 0 && `${usage.users} 位使用者設為「我的角色」`,
        usage.revisions > 0 && `${usage.revisions} 個版本已選擇產出此角色`,
      ].filter(Boolean)
      return error(409, `此角色使用中（${reasons.join('、')}），無法刪除`)
    }
    await delay(200)
    db.roles = db.roles.filter((r) => r.id !== role.id)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/users', () => {
    const { user, response } = requireAdmin()
    if (!user) return response
    return HttpResponse.json({ users: db.users.map(toPublicUser) })
  }),

  http.post('/api/users', async ({ request }) => {
    const { user, response } = requireAdmin()
    if (!user) return response
    const body = await parseBody(request, createUserSchema)
    if (!body.data) return body.response
    if (findUserByEmail(body.data.email)) return error(409, '此 Email 已被使用')
    const created = {
      ...body.data,
      id: `u-${crypto.randomUUID()}`,
      preferredRoleId: null,
      disabled: false,
      createdAt: new Date().toISOString(),
    }
    db.users.push(created)
    persist()
    return HttpResponse.json({ user: toPublicUser(created) }, { status: 201 })
  }),

  http.patch('/api/users/:userId', async ({ request, params }) => {
    const { user, response } = requireAdmin()
    if (!user) return response
    const body = await parseBody(request, updateUserSchema)
    if (!body.data) return body.response
    const target = db.users.find((u) => u.id === params.userId)
    if (!target) return error(404, '使用者不存在')
    if (target.id === user.id && (body.data.disabled || body.data.role === 'user')) {
      return error(400, '無法停用自己或移除自己的管理者權限')
    }
    Object.assign(target, body.data)
    persist()
    return HttpResponse.json({ user: toPublicUser(target) })
  }),

  http.get('/api/topics', async ({ request }) => {
    const { user, response } = requireUser()
    if (!user) return response
    await delay(200)
    const scope = new URL(request.url).searchParams.get('scope') ?? 'all'
    if (!topicScopes.includes(scope as TopicScope)) return error(400, 'scope 只能是 all 或 mine')
    const topics = db.topics
      .filter((t) => scope === 'all' || t.ownerId === user.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toTopicSummary)
    return HttpResponse.json({ topics })
  }),

  http.post('/api/topics', async ({ request }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, createTopicSchema)
    if (!body.data) return body.response
    const now = new Date().toISOString()
    const topic: MockTopic = {
      ...body.data,
      id: `t-${crypto.randomUUID()}`,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    db.topics.push(topic)
    persist()
    return HttpResponse.json({ topic: toTopicDetail(topic) }, { status: 201 })
  }),

  http.get('/api/topics/:topicId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    await delay(200)
    const topic = db.topics.find((t) => t.id === params.topicId)
    if (!topic) return error(404, '主題不存在')
    return HttpResponse.json({ topic: toTopicDetail(topic) })
  }),

  http.patch('/api/topics/:topicId', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, updateTopicSchema)
    if (!body.data) return body.response
    const { topic, response: denied } = findOwnTopic(params.topicId, user.id)
    if (!topic) return denied
    Object.assign(topic, body.data, { updatedAt: new Date().toISOString() })
    persist()
    return HttpResponse.json({ topic: toTopicDetail(topic) })
  }),

  // F5-3：勾選角色並開始產生文件（文件內容在 F6 實作，這裡只模擬狀態變化）
  http.post('/api/revisions/:revisionId/generate', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, generateDocumentsSchema)
    if (!body.data) return body.response
    const revision = db.revisions.find((r) => r.id === params.revisionId)
    if (!revision) return error(404, '版本不存在')
    const { topic, response: denied } = findOwnTopic(revision.topicId, user.id)
    if (!topic) return denied
    if (revisionsOf(topic.id)[0]?.id !== revision.id) return error(409, '只能在最新版本產生文件')
    const canGenerate =
      revision.status === 'clarified' || (revision.status === 'failed' && revision.failedStage === 'generate')
    if (!canGenerate) return error(409, '此版本目前無法產生文件')
    const roleIds = [...new Set(body.data.roleIds)]
    if (roleIds.some((id) => !db.roles.some((r) => r.id === id))) return error(400, '角色不存在')

    await delay(300)
    Object.assign(revision, {
      status: 'generating',
      failedStage: null,
      selectedRoleIds: roleIds,
      generateFinishAt: Date.now() + 5000,
    })
    touchTopic(topic.id)
    persist()
    return HttpResponse.json({ revision: toRevisionSummary(revision) }, { status: 202 })
  }),

  // F2-1、F7-1：建立新版本。有 file 時上傳新的 SRS，沒有時沿用上一版；上一版的 Figma 截圖與連結一律複製
  http.post('/api/topics/:topicId/revisions', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { topic, response: denied } = findOwnTopic(params.topicId, user.id)
    if (!topic) return denied
    const latest = revisionsOf(topic.id)[0]
    if (latest?.status === 'draft') return error(409, '目前版本尚未開始審查，請直接更換 SRS')
    if (latest?.status === 'reviewing' || latest?.status === 'generating') {
      return error(409, '目前版本有進行中的 AI 任務，請稍後再上傳新版')
    }
    const { file: upload } = await readForm(request)
    if (!upload && !latest) return error(400, '請選擇要上傳的 SRS PDF')
    let srsFile = latest?.srs
    if (upload) {
      const srs = await validateSrs(upload)
      if (!srs.file) return srs.response
      srsFile = { ...(await storeFile(srs.file, 'application/pdf')), pageCount: srs.pageCount }
    }
    if (!srsFile) return error(400, '請選擇要上傳的 SRS PDF')

    await delay(500)
    const now = new Date().toISOString()
    const revision: MockRevision = {
      id: `rev-${crypto.randomUUID()}`,
      topicId: topic.id,
      version: (latest?.version ?? 0) + 1,
      status: 'draft',
      failedStage: null,
      selectedRoleIds: [],
      srs: srsFile,
      // 檔案本身與上一版共用，只複製參照
      figmaScreens: (latest?.figmaScreens ?? []).map((screen) => ({ ...screen, id: `fs-${crypto.randomUUID()}` })),
      figmaLinks: (latest?.figmaLinks ?? []).map((link) => ({ ...link, id: `fl-${crypto.randomUUID()}`, createdAt: now })),
      createdAt: now,
    }
    db.revisions.push(revision)
    topic.updatedAt = now
    persist()
    return HttpResponse.json({ revision: toRevisionDetail(revision) }, { status: 201 })
  }),

  http.get('/api/revisions/:revisionId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    await delay(150)
    const revision = findRevision(params.revisionId)
    if (!revision) return error(404, '版本不存在')
    return HttpResponse.json({ revision: toRevisionDetail(revision) })
  }),

  // 草稿階段更換 SRS，覆蓋目前版本
  http.put('/api/revisions/:revisionId/srs', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    const srs = await validateSrs((await readForm(request)).file)
    if (!srs.file) return srs.response
    const { file, pageCount } = srs

    await delay(500)
    const previous = revision.srs.id
    revision.srs = { ...(await storeFile(file, 'application/pdf')), pageCount }
    await releaseFiles([previous])
    touchTopic(revision.topicId)
    persist()
    return HttpResponse.json({ revision: toRevisionDetail(revision) })
  }),

  // F2-2：一次上傳一張截圖（multipart：file、name）
  http.post('/api/revisions/:revisionId/figma/screens', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    if (revision.figmaScreens.length >= SCREEN_MAX_COUNT) return error(400, `每個版本最多 ${SCREEN_MAX_COUNT} 張截圖`)
    const { form, file } = await readForm(request)
    if (!file) return error(400, '請選擇要上傳的截圖')
    const name = screenNameSchema.safeParse(form?.get('name') ?? '')
    if (!name.success) return error(400, name.error.issues.map((i) => i.message).join('、'))
    const contentType = await sniffContentType(file)
    if (contentType !== 'image/png' && contentType !== 'image/jpeg') return error(400, '截圖只接受 PNG 或 JPG')
    if (file.size > SCREEN_MAX_BYTES) return error(400, `截圖超過 ${formatBytes(SCREEN_MAX_BYTES)} 上限`)
    if (revision.figmaScreens.some((s) => s.name === name.data)) return error(409, `已有名稱為「${name.data}」的畫面`)

    await delay(300)
    const screen: FigmaScreen = { id: `fs-${crypto.randomUUID()}`, name: name.data, file: await storeFile(file, contentType) }
    revision.figmaScreens.push(screen)
    touchTopic(revision.topicId)
    persist()
    return HttpResponse.json({ screen }, { status: 201 })
  }),

  http.patch('/api/revisions/:revisionId/figma/screens/:screenId', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, renameFigmaScreenSchema)
    if (!body.data) return body.response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    const screen = revision.figmaScreens.find((s) => s.id === params.screenId)
    if (!screen) return error(404, '截圖不存在')
    if (revision.figmaScreens.some((s) => s.id !== screen.id && s.name === body.data.name)) {
      return error(409, `已有名稱為「${body.data.name}」的畫面`)
    }
    screen.name = body.data.name
    touchTopic(revision.topicId)
    persist()
    return HttpResponse.json({ screen })
  }),

  http.delete('/api/revisions/:revisionId/figma/screens/:screenId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    const screen = revision.figmaScreens.find((s) => s.id === params.screenId)
    if (!screen) return error(404, '截圖不存在')
    await delay(200)
    revision.figmaScreens = revision.figmaScreens.filter((s) => s.id !== screen.id)
    await releaseFiles([screen.file.id])
    touchTopic(revision.topicId)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // F2-3：Figma 連結只存參考
  http.post('/api/revisions/:revisionId/figma/links', async ({ request, params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const body = await parseBody(request, createFigmaLinkSchema)
    if (!body.data) return body.response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    if (revision.figmaLinks.length >= LINK_MAX_COUNT) return error(400, `每個版本最多 ${LINK_MAX_COUNT} 個連結`)
    if (revision.figmaLinks.some((l) => l.url === body.data.url)) return error(409, '此連結已新增過')
    const link: FigmaLink = { id: `fl-${crypto.randomUUID()}`, ...body.data, createdAt: new Date().toISOString() }
    revision.figmaLinks.push(link)
    touchTopic(revision.topicId)
    persist()
    return HttpResponse.json({ link }, { status: 201 })
  }),

  http.delete('/api/revisions/:revisionId/figma/links/:linkId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id, { draftOnly: true })
    if (!revision) return denied
    if (!revision.figmaLinks.some((l) => l.id === params.linkId)) return error(404, '連結不存在')
    revision.figmaLinks = revision.figmaLinks.filter((l) => l.id !== params.linkId)
    touchTopic(revision.topicId)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  // F2-4：取得檔案內容（所有登入者）
  http.get('/api/files/:fileId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const meta = findStoredFile(params.fileId)
    const blob = meta && (sampleFileOf(meta.id) ?? (await getFile(meta.id)))
    if (!meta || !blob) return error(404, '檔案不存在')
    return new HttpResponse(blob, {
      headers: {
        'Content-Type': meta.contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
      },
    })
  }),

  // F3-1：開始審查（問題清單在 F3 實作，這裡只模擬狀態變化：約 5 秒後進入待釐清）
  http.post('/api/revisions/:revisionId/review', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { revision, response: denied } = findOwnRevision(params.revisionId, user.id)
    if (!revision) return denied
    if (revisionsOf(revision.topicId)[0]?.id !== revision.id) return error(409, '只能審查最新版本')
    const canReview = revision.status === 'draft' || (revision.status === 'failed' && revision.failedStage === 'review')
    if (!canReview) return error(409, '此版本目前無法開始審查')

    await delay(300)
    Object.assign(revision, { status: 'reviewing', failedStage: null, reviewFinishAt: Date.now() + 5000 })
    touchTopic(revision.topicId)
    persist()
    return HttpResponse.json({ revision: toRevisionSummary(revision) }, { status: 202 })
  }),

  // 連同所有版本與檔案一併刪除
  http.delete('/api/topics/:topicId', async ({ params }) => {
    const { user, response } = requireUser()
    if (!user) return response
    const { topic, response: denied } = findOwnTopic(params.topicId, user.id)
    if (!topic) return denied
    await delay(300)
    const fileIds = db.revisions.filter((r) => r.topicId === topic.id).flatMap(fileIdsOf)
    db.topics = db.topics.filter((t) => t.id !== topic.id)
    db.revisions = db.revisions.filter((r) => r.topicId !== topic.id)
    await releaseFiles(fileIds)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
