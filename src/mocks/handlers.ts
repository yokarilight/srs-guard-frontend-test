import {
  changePasswordSchema,
  createRoleSchema,
  createTopicSchema,
  createUserSchema,
  generateDocumentsSchema,
  loginSchema,
  topicScopes,
  updateRoleSchema,
  updateTopicSchema,
  updateMeSchema,
  updateUserSchema,
  type ApiErrorBody,
  type Role,
  type RevisionSummary,
  type TopicDetail,
  type TopicScope,
  type TopicSummary,
} from '../contracts/index.ts'
import { delay, http, HttpResponse } from 'msw'
import type { z } from 'zod'
import {
  currentUser,
  db,
  endSession,
  findUserByEmail,
  persist,
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

function toRevisionSummary({ topicId: _topicId, generateFinishAt: _finishAt, ...revision }: MockRevision): RevisionSummary {
  return revision
}

/** 模擬背景任務：產生文件的時間到了就標為已完成（實際文件內容在 F6 實作） */
function settleGenerating(revision: MockRevision) {
  if (revision.status !== 'generating' || !revision.generateFinishAt || revision.generateFinishAt > Date.now()) return
  revision.status = 'completed'
  delete revision.generateFinishAt
  const topic = db.topics.find((t) => t.id === revision.topicId)
  if (topic) topic.updatedAt = new Date().toISOString()
  persist()
}

/** 該主題的所有版本，新到舊 */
function revisionsOf(topicId: string) {
  const revisions = db.revisions.filter((r) => r.topicId === topicId).sort((a, b) => b.version - a.version)
  revisions.forEach(settleGenerating)
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
    topic.updatedAt = new Date().toISOString()
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
    db.topics = db.topics.filter((t) => t.id !== topic.id)
    db.revisions = db.revisions.filter((r) => r.topicId !== topic.id)
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
