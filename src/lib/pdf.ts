/**
 * 讀取 PDF 頁數，供上傳前的檢查使用（後端會再驗證一次）。
 *
 * 不引入 pdf.js，直接解析 PDF 結構：從 Catalog 找到根 Pages 節點的 /Count；
 * PDF 1.5 以後常把物件壓縮在 object stream 裡，以瀏覽器內建的 DecompressionStream 解開。
 * 無法判斷時回傳 null（加密、損毀或少見的結構）。
 */
export async function countPdfPages(blob: Blob): Promise<number | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!isPdf(bytes)) return null

  // windows-1252 解碼每個 byte 對應一個字元，字串索引等於 byte 位置
  const text = new TextDecoder('windows-1252').decode(bytes)
  const objects = new Map<number, string>()

  for (const match of text.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj\b/g)) {
    const [whole, num, body] = match as unknown as [string, string, string]
    // 增量更新時後面的定義會覆蓋前面的
    objects.set(Number(num), body)
    if (/\/Type\s*\/ObjStm\b/.test(body)) {
      const bodyOffset = match.index + whole.length - body.length - 'endobj'.length
      await readObjectStream(bytes, body, bodyOffset, objects).catch(() => undefined)
    }
  }

  const count = (body: string | undefined) => {
    const value = body && /\/Type\s*\/Pages\b/.test(body) ? /\/Count\s+(\d+)/.exec(body)?.[1] : undefined
    return value === undefined ? null : Number(value)
  }

  // 1. Catalog → /Pages → /Count
  for (const body of [...objects.values()].reverse()) {
    if (!/\/Type\s*\/Catalog\b/.test(body)) continue
    const pagesRef = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(body)?.[1]
    const root = count(pagesRef === undefined ? undefined : objects.get(Number(pagesRef)))
    if (root !== null) return root
  }

  // 2. 找不到 Catalog 時：取所有 Pages 節點中最大的 /Count（根節點包含所有子節點）
  const counts = [...objects.values()].map(count).filter((n): n is number => n !== null)
  if (counts.length > 0) return Math.max(...counts)

  // 3. 數葉節點 /Type /Page
  const leaves = [...objects.values()].filter((body) => /\/Type\s*\/Page(?![A-Za-z])/.test(body)).length
  return leaves > 0 ? leaves : null
}

/** 檔頭為 %PDF- */
export function isPdf(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

async function readObjectStream(bytes: Uint8Array, body: string, bodyOffset: number, objects: Map<number, string>) {
  const keyword = /\bstream\r?\n/.exec(body)
  if (!keyword) return
  const dict = body.slice(0, keyword.index)
  const n = Number(/\/N\s+(\d+)/.exec(dict)?.[1])
  const first = Number(/\/First\s+(\d+)/.exec(dict)?.[1])
  if (!n || Number.isNaN(first)) return

  const start = bodyOffset + keyword.index + keyword[0].length
  // /Length 可能是間接參照，取不到時改用 endstream 的位置
  const directLength = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict)?.[1]
  const end = directLength ? start + Number(directLength) : bodyOffset + body.lastIndexOf('endstream')
  let data = bytes.slice(start, end)

  if (/\/FlateDecode\b/.test(dict)) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'))
    data = new Uint8Array(await new Response(stream).arrayBuffer())
  } else if (/\/Filter\b/.test(dict)) {
    return
  }

  const decoded = new TextDecoder('windows-1252').decode(data)
  const header = decoded.slice(0, first).trim().split(/\s+/).map(Number)
  for (let i = 0; i < n; i++) {
    const num = header[i * 2]
    const offset = header[i * 2 + 1]
    if (num === undefined || offset === undefined) break
    const next = header[i * 2 + 3]
    objects.set(num, decoded.slice(first + offset, next === undefined ? undefined : first + next))
  }
}
