import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { Explorer } from "./.quartz/plugins"

// Left-sidebar Explorer: pin top-level category folders to this reading
// order instead of the default alphabetical sort; anything not listed here
// (or nested deeper) falls back to alphabetical, same as before.
//
// This function is shipped to the browser as a *string* (Explorer serializes
// it via .toString() and rebuilds it client-side with `new Function`), so
// it cannot close over anything from this module, and it must not bind any
// nested helper to a name (`const foo = (...) => ...`) — esbuild's
// keepNames wraps those in a `__name(...)` call that doesn't exist in the
// reconstructed scope, throwing "__name is not defined" at runtime and
// silently blanking the Explorer. Anonymous functions (inline callback
// args, or the top-level sortFn itself) aren't wrapped, so all lookups
// below are written as inline anonymous callbacks instead of named consts.
Explorer({
  sortFn: (a: { isFolder: boolean; displayName?: string; slugSegment?: string }, b: typeof a) => {
    const CATEGORY_ORDER = [
      "基础理念",
      "学习理念",
      "学校",
      "引导式玩耍",
      "增效方法",
      "小生活",
      "Paul Graham",
    ]
    if (a.isFolder && b.isFolder) {
      const rawA = a.displayName ?? a.slugSegment ?? ""
      const rawB = b.displayName ?? b.slugSegment ?? ""
      const idxA = CATEGORY_ORDER.findIndex((label) => rawA.startsWith(label))
      const idxB = CATEGORY_ORDER.findIndex((label) => rawB.startsWith(label))
      const ra = idxA === -1 ? CATEGORY_ORDER.length : idxA
      const rb = idxB === -1 ? CATEGORY_ORDER.length : idxB
      if (ra !== rb) return ra - rb
    } else if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1
    }
    return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  },
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
