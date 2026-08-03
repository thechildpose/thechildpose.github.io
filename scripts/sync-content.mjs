import fs from "fs"
import path from "path"
import YAML from "yaml"

const VAULT_ROOT =
  "/Users/sylvia/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/Second-Brain"
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

// Rewrites plain `[[target]]` / `[[target#heading]]` wikilinks (no existing
// custom `|alias`, and not an `![[embed]]`) that point at another published
// article: display text becomes that article's resolved title instead of
// the raw filename, and the link target becomes its clean output slug
// (skipping the alias-redirect hop). Links with an existing `|alias`, or
// pointing at files outside `articleMap`, are left untouched.
function rewireWikilinks(body, articleMap) {
  const wikilinkPattern = /(?<!!)\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?\]\]/g
  return body.replace(wikilinkPattern, (whole, target, heading, alias) => {
    if (alias) return whole
    const info = articleMap.get(target.trim())
    if (!info) return whole
    return `[[${info.outputName}${heading ?? ""}|${info.title}]]`
  })
}

const files = fs.readdirSync(VAULT_DIR).filter((f) => f.endsWith(".md"))

// Pass 1: parse every published article and resolve its title + clean slug,
// without writing anything yet — later articles' wikilinks may reference
// earlier or later files in read-order, so the full map must exist first.
const articleMap = new Map()
const parsed = []

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
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags = [...frontmatter.tags].sort((a, b) => a.localeCompare(b, "zh"))
  }

  const rawName = path.basename(file, ".md")
  const outputName =
    typeof frontmatter.slug === "string" && frontmatter.slug.trim()
      ? frontmatter.slug.trim()
      : stripBracketTags(rawName)

  articleMap.set(rawName, { outputName, title: frontmatter.title })
  parsed.push({ file, rawName, outputName, frontmatter, body })
}

// Pass 2: rewrite wikilinks against the full map, then write output files.
let publishedCount = 0
for (const { rawName, outputName, frontmatter, body } of parsed) {
  const publicBody = rewireWikilinks(extractPublicBody(body), articleMap)
  syncEmbeddedAttachments(publicBody)

  const rawCategory =
    typeof frontmatter.网站文件夹 === "string" ? frontmatter.网站文件夹.trim() : ""
  const category = CATEGORY_RENAMES[rawCategory] ?? rawCategory
  const targetDir = category ? path.join(DEST_DIR, category) : DEST_DIR
  fs.mkdirSync(targetDir, { recursive: true })

  // If the slug changed from the raw filename, keep the old name as an
  // alias so alias-redirects generates a redirect page there — this covers
  // any already-shared/indexed links to the old URL (in-body wikilinks no
  // longer need this now that rewireWikilinks points them at the new slug
  // directly, but external links still do).
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
