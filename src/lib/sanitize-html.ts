import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { isSafePublicImageUrl } from "./security";

const DROP_SUBTREE_TAGS = new Set([
    "script",
    "style",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "applet",
    "svg",
    "math",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "meta",
    "link",
    "base",
    "head",
    "title",
    "noscript",
    "template",
]);

const ALLOWED_TAGS = new Set([
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "mark",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "div",
    "span",
    "figure",
    "figcaption",
    "sup",
    "sub",
]);

const GLOBAL_ALLOWED_ATTRS = new Set(["class", "title", "dir", "lang"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const SAFE_DOM_ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const SAFE_CLASS_TOKEN_RE = /^[a-zA-Z0-9_-]+$/;

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel"]),
    img: new Set(["src", "alt", "width", "height", "loading"]),
    th: new Set(["colspan", "rowspan", "scope"]),
    td: new Set(["colspan", "rowspan"]),
    ol: new Set(["start", "type"]),
    div: new Set(["data-callout"]),
    figure: new Set(["data-figure"]),
};

function hasControlChars(value: string): boolean {
    return /[\u0000-\u001f\u007f]/.test(value);
}

function isSafeLinkHref(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed || hasControlChars(trimmed)) return false;
    if (trimmed.startsWith("#")) return true;
    if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
        return true;
    }
    try {
        const parsed = new URL(trimmed);
        return (
            parsed.protocol === "https:" ||
            parsed.protocol === "http:" ||
            parsed.protocol === "mailto:" ||
            parsed.protocol === "tel:"
        );
    } catch {
        return false;
    }
}

function isSafeImgSrc(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed || hasControlChars(trimmed)) return false;
    if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
        return true;
    }
    return isSafePublicImageUrl(trimmed);
}

function isElementNode(node: AnyNode): node is Element {
    return node.type === "tag" || node.type === "script" || node.type === "style";
}

function stripComments(root: AnyNode) {
    if ("children" in root && Array.isArray(root.children)) {
        for (const child of [...root.children]) {
            if (child.type === "comment") {
                if (child.parent && "children" in child.parent && Array.isArray(child.parent.children)) {
                    child.parent.children = child.parent.children.filter((c) => c !== child);
                }
            } else {
                stripComments(child);
            }
        }
    }
}

/**
 * Allowlist-based HTML sanitizer for rich-text news dispatches and postal guides edited via Tiptap.
 * Removes executable tags (`<script>`, `<svg>`, `<iframe>`, etc.), HTML comments, event handlers (`on*`),
 * DOM clobbering `id` attributes outside headings, and unsafe URL protocols (`javascript:`, `data:`, `vbscript:`).
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
    if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

    const $ = cheerio.load(dirtyHtml, null, false);

    // Strip HTML comments
    for (const rootNode of $.root().toArray()) {
        stripComments(rootNode);
    }

    // 1. Remove dangerous container subtrees completely
    for (const badTag of DROP_SUBTREE_TAGS) {
        $(badTag).remove();
    }

    // 2. Walk remaining elements in reverse document order so unwrapping preserves safe children
    const elements = $("*").toArray().reverse();
    for (const node of elements) {
        if (!isElementNode(node)) continue;
        const tag = node.tagName.toLowerCase();

        if (DROP_SUBTREE_TAGS.has(tag)) {
            $(node).remove();
            continue;
        }

        if (!ALLOWED_TAGS.has(tag)) {
            $(node).replaceWith($(node).contents());
            continue;
        }

        const tagAllowed = TAG_ALLOWED_ATTRS[tag];
        const attribs = { ...(node.attribs || {}) };

        for (const [attrName, attrValue] of Object.entries(attribs)) {
            const lowerAttr = attrName.toLowerCase();

            if (lowerAttr.startsWith("on") || lowerAttr === "style" || lowerAttr === "srcdoc") {
                $(node).removeAttr(attrName);
                continue;
            }

            // Allow `id` only on headings with safe identifier format to prevent DOM clobbering
            if (lowerAttr === "id") {
                if (!HEADING_TAGS.has(tag) || !SAFE_DOM_ID_RE.test(attrValue.trim())) {
                    $(node).removeAttr(attrName);
                }
                continue;
            }

            if (lowerAttr === "class") {
                const safeTokens = attrValue
                    .split(/\s+/)
                    .filter((tok) => SAFE_CLASS_TOKEN_RE.test(tok));
                if (safeTokens.length === 0) {
                    $(node).removeAttr(attrName);
                } else {
                    $(node).attr("class", safeTokens.join(" "));
                }
                continue;
            }

            const allowed = GLOBAL_ALLOWED_ATTRS.has(lowerAttr) || Boolean(tagAllowed?.has(lowerAttr));
            if (!allowed) {
                $(node).removeAttr(attrName);
                continue;
            }

            if (tag === "a" && lowerAttr === "href" && !isSafeLinkHref(attrValue)) {
                $(node).removeAttr(attrName);
                continue;
            }

            if (tag === "a" && lowerAttr === "target") {
                if (attrValue !== "_blank" && attrValue !== "_self") {
                    $(node).removeAttr(attrName);
                }
            }

            if (tag === "img" && lowerAttr === "src" && !isSafeImgSrc(attrValue)) {
                $(node).remove();
                break;
            }
        }

        if (tag === "a") {
            const href = $(node).attr("href") || "";
            const isExternal = /^https?:\/\//i.test(href.trim());
            if ($(node).attr("target") === "_blank" || isExternal) {
                $(node).attr("rel", "noopener noreferrer");
            }
        }
    }

    return $.html();
}
