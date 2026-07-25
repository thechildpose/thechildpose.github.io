import { i18n } from "../i18n"
import { FullSlug, getFileExtension, joinSegments, pathToRoot } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"
import { googleFontHref, googleFontSubsetHref } from "../util/theme"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { unescapeHTML } from "../util/escape"
import { CustomOgImagesEmitterName } from "../../.quartz/plugins"
export default (() => {
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
    ctx,
  }: QuartzComponentProps) => {
    const titleSuffix = cfg.pageTitleSuffix ?? ""
    const title =
      (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
    const description =
      fileData.frontmatter?.socialDescription ??
      fileData.frontmatter?.description ??
      unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description)

    const { css, js, additionalHead } = externalResources

    const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
    const path = url.pathname as FullSlug
    const baseDir = fileData.slug === "404" ? path : pathToRoot(fileData.slug!)
    const iconPath = joinSegments(baseDir, "static/icon.png")

    // Url of current page
    const socialUrl =
      fileData.slug === "404" ? url.toString() : joinSegments(url.toString(), fileData.slug!)

    const usesCustomOgImage = ctx.cfg.plugins.emitters.some(
      (e) => e.name === CustomOgImagesEmitterName,
    )
    const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`

    const coreStylesheet = css[0]?.content
    const coreScript = js.find(
      (r) => r.loadTime === "beforeDOMReady" && r.contentType === "external",
    )

    return (
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        {coreStylesheet && <link rel="preload" href={coreStylesheet} as="style" />}
        {coreScript && coreScript.contentType === "external" && (
          <link rel="preload" href={coreScript.src} as="script" />
        )}
        {cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" />
            <link rel="stylesheet" href={googleFontHref(cfg.theme)} />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap"
            />
            {cfg.theme.typography.title && (
              <link rel="stylesheet" href={googleFontSubsetHref(cfg.theme, cfg.pageTitle)} />
            )}
          </>
        )}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="og:site_name" content={cfg.pageTitle}></meta>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta property="og:description" content={description} />
        <meta property="og:image:alt" content={description} />

        {!usesCustomOgImage && (
          <>
            <meta property="og:image" content={ogImageDefaultPath} />
            <meta property="og:image:url" content={ogImageDefaultPath} />
            <meta name="twitter:image" content={ogImageDefaultPath} />
            <meta
              property="og:image:type"
              content={`image/${getFileExtension(ogImageDefaultPath) ?? "png"}`}
            />
          </>
        )}

        {cfg.baseUrl && (
          <>
            <meta property="twitter:domain" content={cfg.baseUrl}></meta>
            <meta property="og:url" content={socialUrl}></meta>
            <meta property="twitter:url" content={socialUrl}></meta>
          </>
        )}

        <link rel="icon" href={iconPath} />
        <meta name="description" content={description} />
        <meta name="generator" content="Quartz" />

        {css.map((resource) => CSSResourceToStyleElement(resource, true))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
        {additionalHead.map((resource) => {
          if (typeof resource === "function") {
            return resource(fileData)
          } else {
            return resource
          }
        })}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  function basePath() {
    return (document.body && document.body.dataset && document.body.dataset.basepath) || "";
  }

  function folderHrefFor(ul) {
    var parentLi = ul.closest("li");
    var container = parentLi && parentLi.querySelector(":scope > .folder-container");
    var folderPath = container && container.dataset && container.dataset.folderpath;
    if (!folderPath) return null;
    return basePath() + "/" + encodeURI(folderPath) + "/";
  }

  function truncateFolder(ul) {
    if (ul.dataset.truncated === "done") return;
    var fileItems = Array.prototype.filter.call(ul.children, function (li) {
      return li.querySelector && li.querySelector(":scope > a.nav-file-title");
    });
    if (fileItems.length <= 6) {
      ul.dataset.truncated = "done";
      return;
    }
    fileItems.forEach(function (li, i) {
      li.style.display = i < 6 ? "" : "none";
    });
    if (!ul.querySelector(":scope > li.explorer-more-link")) {
      var href = folderHrefFor(ul);
      if (href) {
        var li = document.createElement("li");
        li.className = "explorer-more-link";
        var a = document.createElement("a");
        a.href = href;
        a.textContent = "more...";
        li.appendChild(a);
        ul.appendChild(li);
      }
    }
    ul.dataset.truncated = "done";
  }

  function enforceAccordion(ul) {
    var openFolders = Array.prototype.filter.call(ul.children, function (li) {
      return li.querySelector && li.querySelector(":scope > .folder-outer.open");
    });
    if (openFolders.length <= 1) return;
    var keep =
      openFolders.find(function (li) {
        return li.querySelector("a.active, a.is-active");
      }) || openFolders[0];
    openFolders.forEach(function (li) {
      if (li === keep) return;
      var outer = li.querySelector(":scope > .folder-outer.open");
      if (outer) outer.classList.remove("open");
    });
  }

  function processExplorer() {
    document
      .querySelectorAll(".explorer-content ul.content, .explorer-content ul.explorer-ul")
      .forEach(function (ul) {
        truncateFolder(ul);
        enforceAccordion(ul);
      });
  }

  function collapseSiblings(openedFolderOuter) {
    var parentLi = openedFolderOuter.closest("li");
    var parentUl = parentLi && parentLi.parentElement;
    if (!parentUl) return;
    Array.prototype.forEach.call(parentUl.children, function (sibling) {
      if (sibling === parentLi) return;
      var outer = sibling.querySelector(":scope > .folder-outer.open");
      if (outer) outer.classList.remove("open");
    });
  }

  var observer;
  function setup() {
    var explorer = document.querySelector(".explorer");
    if (!explorer) return;
    processExplorer();
    if (observer) observer.disconnect();
    observer = new MutationObserver(function (mutations) {
      var needsTruncate = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === "childList") needsTruncate = true;
        if (m.type === "attributes" && m.attributeName === "class") {
          var target = m.target;
          if (
            target.classList &&
            target.classList.contains("folder-outer") &&
            target.classList.contains("open")
          ) {
            collapseSiblings(target);
          }
        }
      }
      if (needsTruncate) processExplorer();
    });
    observer.observe(explorer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  document.addEventListener("nav", setup);
  document.addEventListener("render", setup);
})();

(function () {
  // This whole script also loads inside the iframes it creates (each pane
  // renders a full page, head and all). Without this guard, every framed
  // page would spin up its own container and re-fetch the same trail from
  // sessionStorage, nesting iframes inside iframes indefinitely.
  if (window.self !== window.top) return;

  var STORAGE_KEY = "tcp-stack-trail";
  var VISIBLE_COUNT = 2;
  var container, closeBtn;

  function basePath() {
    return (document.body && document.body.dataset && document.body.dataset.basepath) || "";
  }

  function currentSlug() {
    var bp = basePath();
    var slug = window.location.pathname;
    if (bp && slug.indexOf(bp) === 0) slug = slug.slice(bp.length);
    slug = slug.replace(/^\\/+/, "").replace(/\\/+$/, "");
    return slug || "index";
  }

  function getTrail() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function setTrail(trail) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
    } catch (e) {}
  }

  function slugToHref(slug) {
    // slug segments come from url.pathname / location.pathname, which the
    // browser already returns percent-encoded — encoding again here would
    // turn "%E3" into "%25E3" and 404.
    return basePath() + "/" + slug;
  }

  function slugFromHref(href) {
    try {
      var url = new URL(href, window.location.origin);
      var bp = basePath();
      var slug = url.pathname;
      if (bp && slug.indexOf(bp) === 0) slug = slug.slice(bp.length);
      slug = slug.replace(/^\\/+/, "").replace(/\\/+$/, "");
      return slug || "index";
    } catch (e) {
      return href;
    }
  }

  function labelFor(slug) {
    var parts = slug.split("/");
    return decodeURIComponent(parts[parts.length - 1] || slug);
  }

  function ensureContainer() {
    if (container) return container;
    container = document.createElement("div");
    container.id = "tcp-stack-container";
    document.body.appendChild(container);
    closeBtn = document.createElement("button");
    closeBtn.className = "tcp-stack-close";
    closeBtn.textContent = "\\u00d7";
    closeBtn.setAttribute("aria-label", "Close stacked view");
    closeBtn.addEventListener("click", closeStack);
    document.body.appendChild(closeBtn);
    return container;
  }

  function closeStack() {
    setTrail([]);
    document.body.classList.remove("tcp-stack-active");
    if (container) container.classList.remove("active");
  }

  function attachLinkInterception(doc, onOpen) {
    if (!doc || doc.__tcpIntercepted) return;
    doc.__tcpIntercepted = true;
    doc.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".markdown-preview-view a.internal");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href || href.indexOf("#") === 0) return;
      e.preventDefault();
      e.stopPropagation();
      onOpen(a);
    });
  }

  function render() {
    var trail = getTrail();
    if (trail.length < 2) {
      document.body.classList.remove("tcp-stack-active");
      if (container) container.classList.remove("active");
      return;
    }
    document.body.classList.add("tcp-stack-active");
    var el = ensureContainer();
    el.classList.add("active");
    el.innerHTML = "";

    var splitAt = Math.max(0, trail.length - VISIBLE_COUNT);
    var collapsedSlugs = trail.slice(0, splitAt);
    var expandedSlugs = trail.slice(splitAt);

    collapsedSlugs.forEach(function (slug, idx) {
      var tab = document.createElement("div");
      tab.className = "tcp-stack-tab";
      var label = document.createElement("div");
      label.className = "tcp-stack-tab-label";
      label.textContent = labelFor(slug);
      tab.appendChild(label);
      tab.addEventListener("click", function () {
        setTrail(trail.slice(0, idx + 1));
        render();
      });
      el.appendChild(tab);
    });

    expandedSlugs.forEach(function (slug) {
      var pane = document.createElement("div");
      pane.className = "tcp-stack-pane";
      var bar = document.createElement("div");
      bar.className = "tcp-stack-pane-bar";
      bar.textContent = labelFor(slug);
      pane.appendChild(bar);
      var iframe = document.createElement("iframe");
      iframe.src = slugToHref(slug);
      iframe.addEventListener("load", function () {
        try {
          attachLinkInterception(iframe.contentDocument, function (a) {
            var newSlug = slugFromHref(a.getAttribute("href"));
            var t = getTrail();
            t.push(newSlug);
            setTrail(t);
            render();
          });
        } catch (e) {
          console.warn("[tcp-stack] cannot access iframe document", e);
        }
      });
      pane.appendChild(iframe);
      el.appendChild(pane);
    });
  }

  function setupTopLevel() {
    attachLinkInterception(document, function (a) {
      var newSlug = slugFromHref(a.getAttribute("href"));
      setTrail([currentSlug(), newSlug]);
      render();
    });
    render();
  }

  document.addEventListener("nav", setupTopLevel);
})();
`,
          }}
        />
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
