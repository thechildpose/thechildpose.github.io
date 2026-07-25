import fs from "fs"
import path from "path"
import YAML from "yaml"

const VAULT_ROOT = "/Users/sylvia/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/Second-Brain"
const VAULT_DIR = path.join(VAULT_ROOT, "raw", "1-mywriting")
const ATTACHMENTS_DIR = path.join(VAULT_ROOT, "attachments")
const DEST_DIR = path.join(import.meta.dirname, "..", "content")
const DEST_ATTACHMENTS_DIR = path.join(DEST_DIR, "attachments")
const PRESERVED_TOP_LEVEL_ENTRIES = new Set([".gitkeep", "attachments", "index.md"])
const CATEGORY_RENAMES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "category-renames.json"), "utf-8"),
)

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
  const isPublished = frontmatter.publish === true || frontmatter.published === true
  if (!isPublished) continue

  // `published` doubles as the output's display-date field below, so clear
  // out the boolean value first (covers the common `published: true` typo
  // for what should be `publish: true`) to avoid colliding with that.
  delete frontmatter.published

  if (!frontmatter.title) {
    frontmatter.title = frontmatter.标题 || stripBracketTags(path.basename(file, ".md"))
  }
  if (frontmatter.发表日期) {
    frontmatter.published = frontmatter.发表日期
  }

  const publicBody = extractPublicBody(body)
  syncEmbeddedAttachments(publicBody)

  const rawCategory = typeof frontmatter.网站文件夹 === "string" ? frontmatter.网站文件夹.trim() : ""
  const category = CATEGORY_RENAMES[rawCategory] ?? rawCategory
  const targetDir = category ? path.join(DEST_DIR, category) : DEST_DIR
  fs.mkdirSync(targetDir, { recursive: true })

  // The URL slug comes straight from this output filename, so strip the
  // Obsidian bracket tags (【xhs】【网站】etc.) that clutter the raw vault
  // filename. An explicit `slug` field in frontmatter overrides this.
  const rawName = path.basename(file, ".md")
  const outputName =
    typeof frontmatter.slug === "string" && frontmatter.slug.trim()
      ? frontmatter.slug.trim()
      : stripBracketTags(rawName)

  // If the slug changed from the raw filename, keep the old name as an
  // alias so alias-redirects generates a redirect page there — this covers
  // existing wikilinks elsewhere that still reference the old filename, and
  // any already-shared/indexed links to the old URL.
  if (outputName !== rawName) {
    const aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases : []
    if (!aliases.includes(rawName)) aliases.push(rawName)
    frontmatter.aliases = aliases
  }

  const newRaw = `---\n${YAML.stringify(frontmatter)}---\n${publicBody}`
  fs.writeFileSync(path.join(targetDir, `${outputName}.md`), newRaw, "utf-8")
  publishedCount++
}

console.log(`Synced ${publishedCount} published article(s) to ${DEST_DIR}`)
