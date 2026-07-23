import fs from "fs"
import path from "path"
import YAML from "yaml"

const VAULT_ROOT = "/Users/sylvia/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/Second-Brain"
const VAULT_DIR = path.join(VAULT_ROOT, "raw", "1-mywriting")
const ATTACHMENTS_DIR = path.join(VAULT_ROOT, "attachments")
const DEST_DIR = path.join(import.meta.dirname, "..", "content")
const DEST_ATTACHMENTS_DIR = path.join(DEST_DIR, "attachments")
const PRESERVED_TOP_LEVEL_ENTRIES = new Set([".gitkeep", "attachments", "index.md"])

function stripBracketTags(title) {
  return title.replace(/^(【[^】]*】)+/, "").trim()
}

function extractPublicBody(body) {
  const marker = body.match(/^##\s*正文\s*$/m)
  if (!marker) return body
  return body.slice(marker.index + marker[0].length).replace(/^\n+/, "")
}

fs.mkdirSync(DEST_DIR, { recursive: true })
for (const existing of fs.readdirSync(DEST_DIR)) {
  if (PRESERVED_TOP_LEVEL_ENTRIES.has(existing)) continue
  fs.rmSync(path.join(DEST_DIR, existing), { recursive: true, force: true })
}
fs.mkdirSync(DEST_ATTACHMENTS_DIR, { recursive: true })
for (const existing of fs.readdirSync(DEST_ATTACHMENTS_DIR)) {
  fs.rmSync(path.join(DEST_ATTACHMENTS_DIR, existing))
}

function syncEmbeddedAttachments(body) {
  const embedPattern = /!\[\[([^\]|#]+\.(?:png|jpe?g|gif|webp|svg))(?:\|[^\]]*)?\]\]/gi
  for (const [, filename] of body.matchAll(embedPattern)) {
    const src = path.join(ATTACHMENTS_DIR, filename)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DEST_ATTACHMENTS_DIR, filename))
    } else {
      console.warn(`Warning: embedded image not found in attachments: ${filename}`)
    }
  }
}

const files = fs.readdirSync(VAULT_DIR).filter((f) => f.endsWith(".md"))
let publishedCount = 0

for (const file of files) {
  const raw = fs.readFileSync(path.join(VAULT_DIR, file), "utf-8")
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) continue

  const [, frontmatterRaw, body] = match
  const frontmatter = YAML.parse(frontmatterRaw) ?? {}
  if (frontmatter.publish !== true) continue

  if (!frontmatter.title) {
    frontmatter.title = frontmatter.标题 || stripBracketTags(path.basename(file, ".md"))
  }

  const publicBody = extractPublicBody(body)
  syncEmbeddedAttachments(publicBody)

  const category = typeof frontmatter.网站文件夹 === "string" ? frontmatter.网站文件夹.trim() : ""
  const targetDir = category ? path.join(DEST_DIR, category) : DEST_DIR
  fs.mkdirSync(targetDir, { recursive: true })

  const newRaw = `---\n${YAML.stringify(frontmatter)}---\n${publicBody}`
  fs.writeFileSync(path.join(targetDir, file), newRaw, "utf-8")
  publishedCount++
}

console.log(`Synced ${publishedCount} published article(s) to ${DEST_DIR}`)
