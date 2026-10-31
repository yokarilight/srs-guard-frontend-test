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
  selectedRoleIds: string[]
  /** 模擬背景任務：文件產生中的版本在此時間後視為完成 */
  generateFinishAt?: number
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

/** F5-1：預設角色，內容對應 F6-2 */
const builtInRoles: Role[] = [
  {
    id: 'r-frontend',
    key: 'frontend',
    name: '前端',
    description: '負責頁面與互動實作，需要知道每個畫面的元件、狀態、表單驗證與要串接的 API。',
    sections: ['頁面與元件清單', '使用者操作流程', '表單欄位與驗證規則', '各畫面狀態', '需串接的 API', 'Figma 缺少的畫面'],
    isBuiltIn: true,
  },
  {
    id: 'r-backend',
    key: 'backend',
    name: '後端',
    description: '負責資料模型與 API，需要知道商業規則、權限與外部串接。',
    sections: ['資料模型', 'API 規格', '商業規則', '權限', '排程或外部串接'],
    isBuiltIn: true,
  },
  {
    id: 'r-qa',
    key: 'qa',
    name: 'QA',
    description: '負責驗證需求，需要測試範圍、各類測試案例與驗收標準。',
    sections: ['測試範圍', '測試案例', '驗收標準', '測試資料需求'],
    isBuiltIn: true,
  },
  {
    id: 'r-manager',
    key: 'manager',
    name: '主管',
    description: '負責範圍與時程，需要一頁摘要、風險、跨角色相依與可估工的工作項目。',
    sections: ['需求一頁摘要', '範圍內與範圍外', '風險與接受現狀的項目', '跨角色相依關係', '工作項目清單'],
    isBuiltIn: true,
  },
]

const customRoles: Role[] = [
  {
    id: 'r-designer',
    key: 'custom-designer',
    name: '設計師',
    description: '負責 UI/UX 設計，需要知道缺少的畫面、狀態與互動細節，以及設計稿與 SRS 的落差。',
    sections: ['缺少的畫面', '各畫面狀態', '互動與動態說明'],
    isBuiltIn: false,
  },
  {
    id: 'r-devops',
    key: 'custom-devops',
    name: 'DevOps',
    description: '負責部署與維運，需要知道環境設定、排程、監控與外部服務相依。',
    sections: [],
    isBuiltIn: false,
  },
]

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
    roles: [...builtInRoles, ...customRoles],
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
      {
        id: 't-coupon-page',
        ownerId: 'u-member',
        name: '優惠券活動頁',
        description: '雙十一優惠券領取與使用流程。',
        createdAt: daysAgo(4),
        updatedAt: daysAgo(0.3),
      },
    ],
    revisions: [
      {
        id: 'rev-mc-1',
        topicId: 't-member-center',
        version: 1,
        status: 'completed',
        failedStage: null,
        selectedRoleIds: ['r-frontend', 'r-backend', 'r-qa', 'r-manager', 'r-designer'],
        createdAt: daysAgo(10),
      },
      { id: 'rev-mc-2', topicId: 't-member-center', version: 2, status: 'clarifying', failedStage: null, selectedRoleIds: [], createdAt: daysAgo(2) },
      { id: 'rev-oe-1', topicId: 't-order-export', version: 1, status: 'reviewing', failedStage: null, selectedRoleIds: [], createdAt: daysAgo(0.1) },
      {
        id: 'rev-rd-1',
        topicId: 't-report-dashboard',
        version: 1,
        status: 'failed',
        failedStage: 'generate',
        selectedRoleIds: ['r-frontend', 'r-backend', 'r-qa'],
        createdAt: daysAgo(6),
      },
      { id: 'rev-cp-1', topicId: 't-coupon-page', version: 1, status: 'clarified', failedStage: null, selectedRoleIds: [], createdAt: daysAgo(4) },
    ],
  }
}

export const db: MockDb = (() => {
  try {
    const saved = localStorage.getItem(DB_KEY)
    // 舊版假資料沒有的 collection 用預設值補上
    if (saved) {
      const merged: MockDb = { ...seed(), ...(JSON.parse(saved) as Partial<MockDb>) }
      // 舊版假資料的版本沒有 selectedRoleIds
      for (const revision of merged.revisions) revision.selectedRoleIds ??= []
      return merged
    }
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
