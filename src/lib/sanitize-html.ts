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

const GLOBAL_ALLOWED_ATTRS = new Set(["class", "id", "title", "dir", "lang"]);

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel"]),
    img: new Set(["src", "alt", "width", "height", "loading"]),
    th: new Set(["colspan", "rowspan", "scope"]),
    td: new Set(["colspan", "rowspan"]),
    ol: new Set(["start", "type"]),
};

function isSafeLinkHref(raw: string): boolean {
    const trimmed = raw.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("#") || (trimmed.startsWith("/") && !trimmed.startsWith("//"))) {
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
    if (!trimmed) return false;
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
        return true;
    }
    return isSafePublicImageUrl(trimmed);
}

function isElementNode(node: AnyNode): node is Element {
    return node.type === "tag" || node.type === "script" || node.type === "style";
}

/**
 * Allowlist-based HTML sanitizer for rich-text blog articles edited via Jodit.
 * Removes executable tags (`<script>`, `<svg>`, `<iframe>`, etc.), event handlers (`on*`),
 * and unsafe URL protocols (`javascript:`, `data:`, `vbscript:`).
 */
export function sanitizeRichHtml(dirtyHtml: string): string {
    if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

    const $ = cheerio.load(dirtyHtml, null, false);

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

        if (tag === "a" && $(node).attr("target") === "_blank") {
            $(node).attr("rel", "noopener noreferrer");
        }
    }

    return $.html();
}
