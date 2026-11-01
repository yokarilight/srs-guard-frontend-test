import {
  SCREEN_MAX_BYTES,
  SCREEN_NAME_MAX_LENGTH,
  screenContentTypes,
  SRS_MAX_BYTES,
  SRS_MAX_PAGES,
} from '../../../contracts/index.ts'
import { formatBytes } from '../../../lib/format.ts'
import { countPdfPages } from '../../../lib/pdf.ts'

const hasExtension = (file: File, extensions: string[]) =>
  extensions.some((ext) => file.name.toLowerCase().endsWith(ext))

/** F2-1：上傳前先檢查類型、大小與頁數，回傳錯誤訊息；後端會再驗證一次 */
export async function checkSrsFile(file: File): Promise<string | null> {
  if (file.type !== 'application/pdf' && !hasExtension(file, ['.pdf'])) return `「${file.name}」不是 PDF 檔`
  if (file.size === 0) return `「${file.name}」是空的檔案`
  if (file.size > SRS_MAX_BYTES) {
    return `檔案大小 ${formatBytes(file.size)}，超過 ${formatBytes(SRS_MAX_BYTES)} 上限`
  }
  const pages = await countPdfPages(file).catch(() => null)
  // 無法判斷頁數時交給後端驗證
  if (pages !== null && pages > SRS_MAX_PAGES) return `共 ${pages} 頁，超過 ${SRS_MAX_PAGES} 頁上限`
  return null
}

/** F2-2：截圖只接受 PNG / JPG，單張大小上限 */
export function checkScreenFile(file: File): string | null {
  const typeOk =
    (screenContentTypes as readonly string[]).includes(file.type) || hasExtension(file, ['.png', '.jpg', '.jpeg'])
  if (!typeOk) return '只接受 PNG 或 JPG'
  if (file.size === 0) return '是空的檔案'
  if (file.size > SCREEN_MAX_BYTES) return `${formatBytes(file.size)}，超過 ${formatBytes(SCREEN_MAX_BYTES)} 上限`
  return null
}

/** 預設畫面名稱：檔名去掉副檔名；與既有名稱重複時加上 (2)、(3)… */
export function defaultScreenName(fileName: string, taken: Set<string>) {
  const base = (fileName.replace(/\.[^.]+$/, '').trim() || '未命名畫面').slice(0, SCREEN_NAME_MAX_LENGTH - 4)
  let name = base
  for (let i = 2; taken.has(name); i++) name = `${base} (${i})`
  return name
}
