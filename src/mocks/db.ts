import type { FailedStage, RevisionStatus, Role, User } from '../contracts/index.ts'

/** 開發用的假資料庫，存在 localStorage，重新整理後仍保留 */
interface MockUser extends User {
  password: string
}

export interface MockTopic {
  id: string
  ownerId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface MockRevision {
  id: string
  topicId: string
  version: number
  status: RevisionStatus
  failedStage: FailedStage | null
  createdAt: string
}

interface MockDb {
  users: MockUser[]
  roles: Role[]
  topics: MockTopic[]
  revisions: MockRevision[]
}

interface MockSession {
  userId: string
  expiresAt: number
}

const DB_KEY = 'srs-guard-frontend-test-mock-db'
const SESSION_KEY = 'srs-guard-frontend-test-mock-session'
/** 閒置 30 分鐘後 Session 逾時（每次請求會延長） */
export const SESSION_TTL_MS = 30 * 60 * 1000

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function seed(): MockDb {
  const now = new Date().toISOString()
  return {
    users: [
      {
        id: 'u-admin',
        email: 'admin@example.com',
        name: '系統管理者',
        role: 'admin',
        preferredRoleId: null,
        disabled: false,
        createdAt: now,
        password: 'admin1234',
      },
      {
        id: 'u-member',
        email: 'user@example.com',
        name: '王小明',
        role: 'user',
        preferredRoleId: 'r-frontend',
        disabled: false,
        createdAt: now,
        password: 'user1234',
      },
    ],
    roles: [
      { id: 'r-frontend', key: 'frontend', name: '前端', description: '', sections: [], isBuiltIn: true },
      { id: 'r-backend', key: 'backend', name: '後端', description: '', sections: [], isBuiltIn: true },
      { id: 'r-qa', key: 'qa', name: 'QA', description: '', sections: [], isBuiltIn: true },
      { id: 'r-manager', key: 'manager', name: '主管', description: '', sections: [], isBuiltIn: true },
    ],
    topics: [
      {
        id: 't-member-center',
        ownerId: 'u-member',
        name: '會員中心改版',
        description: '重新設計會員資料、訂單紀錄與點數頁面。',
        createdAt: daysAgo(10),
        updatedAt: daysAgo(1),
      },
      {
        id: 't-order-export',
        ownerId: 'u-admin',
        name: '訂單匯出功能',
        description: '後台可依條件匯出訂單 CSV。',
        createdAt: daysAgo(3),
        updatedAt: daysAgo(0.1),
      },
      {
        id: 't-report-dashboard',
        ownerId: 'u-admin',
        name: '營運報表儀表板',
        description: '',
        createdAt: daysAgo(6),
        updatedAt: daysAgo(2),
      },
      {
        id: 't-push-settings',
        ownerId: 'u-member',
        name: '推播通知設定',
        description: '',
        createdAt: daysAgo(0.5),
        updatedAt: daysAgo(0.5),
      },
    ],
    revisions: [
      { id: 'rev-mc-1', topicId: 't-member-center', version: 1, status: 'completed', failedStage: null, createdAt: daysAgo(10) },
      { id: 'rev-mc-2', topicId: 't-member-center', version: 2, status: 'clarifying', failedStage: null, createdAt: daysAgo(2) },
      { id: 'rev-oe-1', topicId: 't-order-export', version: 1, status: 'reviewing', failedStage: null, createdAt: daysAgo(0.1) },
      { id: 'rev-rd-1', topicId: 't-report-dashboard', version: 1, status: 'failed', failedStage: 'generate', createdAt: daysAgo(6) },
    ],
  }
}

export const db: MockDb = (() => {
  try {
    const saved = localStorage.getItem(DB_KEY)
    // 舊版假資料沒有的 collection 用預設值補上
    if (saved) return { ...seed(), ...(JSON.parse(saved) as Partial<MockDb>) }
  } catch {
    // 資料損毀就重新建立
  }
  return seed()
})()

export function persist() {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function toPublicUser({ password: _password, ...user }: MockUser): User {
  return user
}

export function findUserByEmail(email: string) {
  return db.users.find((u) => u.email === email.trim().toLowerCase())
}

export function startSession(userId: string) {
  const session: MockSession = { userId, expiresAt: Date.now() + SESSION_TTL_MS }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function endSession() {
  localStorage.removeItem(SESSION_KEY)
}

/** 取得目前登入者並延長 Session；逾時、帳號停用或不存在時回傳 null */
export function currentUser(): MockUser | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const session = JSON.parse(raw) as MockSession
  const user = db.users.find((u) => u.id === session.userId)
  if (!user || user.disabled || session.expiresAt < Date.now()) {
    endSession()
    return null
  }
  startSession(user.id)
  return user
}
