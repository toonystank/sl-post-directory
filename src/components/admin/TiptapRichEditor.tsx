"use client";

import * as React from "react";
import { EditorContent, Node, mergeAttributes, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image as TiptapImage } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
    Bold,
    Italic,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    AlertTriangle,
    Image as ImageIcon,
    Code2,
    Table as TableIcon,
    Link2,
    Undo2,
    Redo2,
    Search,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/shell/Sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AdminImageUpload from "./AdminImageUpload";
import { cn } from "@/lib/utils";

const AlertCallout = Node.create({
    name: "alertCallout",
    group: "block",
    content: "block+",
    defining: true,
    parseHTML() {
        return [{ tag: "div[data-callout]" }, { tag: "div.callout-alert" }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes(HTMLAttributes, {
                class: "callout-alert",
                "data-callout": "alert",
            }),
            0,
        ];
    },
});

const FigureImage = Node.create({
    name: "figureImage",
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: "" },
            alt: { default: "" },
            caption: { default: "" },
        };
    },
    parseHTML() {
        return [
            {
                tag: "figure[data-figure]",
                getAttrs: (dom) => {
                    const el = dom as HTMLElement;
                    const img = el.querySelector("img");
                    const cap = el.querySelector("figcaption");
                    return {
                        src: img?.getAttribute("src") || "",
                        alt: img?.getAttribute("alt") || "",
                        caption: cap?.textContent || "",
                    };
                },
            },
        ];
    },
    renderHTML({ HTMLAttributes }) {
        const src = String(HTMLAttributes.src || "");
        const alt = String(HTMLAttributes.alt || "");
        const caption = String(HTMLAttributes.caption || "");
        const previewSrc = src
            ? src.includes("-/")
                ? src
                : `${src.endsWith("/") ? src : `${src}/`}-/preview/1000x800/-/quality/smart/`
            : "";

        if (caption.trim()) {
            return [
                "figure",
                { "data-figure": "true" },
                ["img", { src: previewSrc, alt }],
                ["figcaption", {}, caption.trim()],
            ];
        }
        return [
            "figure",
            { "data-figure": "true" },
            ["img", { src: previewSrc, alt }],
        ];
    },
});

export interface SiteVarItem {
    key: string;
    value: string;
    description: string | null;
}

interface TiptapRichEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    variables: SiteVarItem[];
}

function ToolbarButton({
    active,
    disabled,
    onClick,
    label,
    children,
    highlight,
}: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    label: string;
    children: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            title={label}
            className={cn(
                "tap shrink-0 inline-flex min-h-[42px] min-w-[42px] items-center justify-center gap-1 rounded-sm border px-2.5 text-xs font-bold transition-colors disabled:opacity-40",
                active
                    ? "border-foreground bg-foreground text-background"
                    : highlight
                      ? "border-foreground/50 bg-secondary/40 text-foreground hover:bg-secondary/70"
                      : "border-transparent bg-transparent text-foreground hover:bg-muted"
            )}
        >
            {children}
        </button>
    );
}

export default function TiptapRichEditor({
    value,
    onChange,
    placeholder,
    variables,
}: TiptapRichEditorProps) {
    const [photoSheetOpen, setPhotoSheetOpen] = React.useState(false);
    const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
    const [photoAlt, setPhotoAlt] = React.useState("");
    const [photoCaption, setPhotoCaption] = React.useState("");

    const [varSheetOpen, setVarSheetOpen] = React.useState(false);
    const [varSearch, setVarSearch] = React.useState("");

    const [linkSheetOpen, setLinkSheetOpen] = React.useState(false);
    const [linkUrl, setLinkUrl] = React.useState("");
    const [linkText, setLinkText] = React.useState("");

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                link: {
                    openOnClick: false,
                    HTMLAttributes: {
                        target: "_blank",
                        rel: "noopener noreferrer",
                    },
                },
            }),
            TiptapImage.configure({
                HTMLAttributes: {
                    class: "rounded-md max-w-full h-auto",
                },
            }),
            Placeholder.configure({
                placeholder:
                    placeholder ||
                    "Write postal news, breaking alerts, tariff changes, or how-to steps...",
            }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            AlertCallout,
            FigureImage,
        ],
        content: value,
        onUpdate: ({ editor: instance }) => {
            onChange(instance.getHTML());
        },
        editorProps: {
            attributes: {
                class: "prose-custom max-w-none focus:outline-none text-base",
            },
        },
    });

    React.useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (value !== current) {
            editor.commands.setContent(value || "", { emitUpdate: false });
        }
    }, [editor, value]);

    const filteredVariables = React.useMemo(() => {
        const q = varSearch.trim().toLowerCase();
        const nonJson = variables.filter((v) => !v.key.startsWith("rates_"));
        if (!q) return nonJson;
        return nonJson.filter(
            (v) =>
                v.key.toLowerCase().includes(q) ||
                v.value.toLowerCase().includes(q) ||
                (v.description?.toLowerCase().includes(q) ?? false)
        );
    }, [varSearch, variables]);

    const handleInsertPhoto = () => {
        if (!editor || !photoUrl) return;
        editor
            .chain()
            .focus()
            .insertContent({
                type: "figureImage",
                attrs: {
                    src: photoUrl,
                    alt: photoAlt.trim() || "Sri Lanka Post update photo",
                    caption: photoCaption.trim(),
                },
            })
            .run();
        setPhotoUrl(null);
        setPhotoAlt("");
        setPhotoCaption("");
        setPhotoSheetOpen(false);
    };

    const handleInsertLink = () => {
        if (!editor) return;
        const trimmed = linkUrl.trim();
        if (!trimmed) {
            editor.chain().focus().unsetLink().run();
            setLinkSheetOpen(false);
            return;
        }
        if (linkText.trim() && editor.state.selection.empty) {
            editor
                .chain()
                .focus()
                .insertContent(`<a href="${trimmed.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">${linkText.trim()}</a>`)
                .run();
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
        }
        setLinkUrl("");
        setLinkText("");
        setLinkSheetOpen(false);
    };

    const insertVariableTag = (key: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(`{{${key}}}`).run();
        setVarSheetOpen(false);
    };

    const editorReady = Boolean(editor);

    return (
        <div className="rounded-md border-2 border-foreground bg-card overflow-hidden">
            {/* Single-row sticky horizontally scrollable mobile-first toolbar */}
            <div className="sticky top-14 md:top-0 z-20 flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-border bg-muted/70 px-2 py-1.5">
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("heading", { level: 2 })}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    label="Heading 2"
                >
                    <Heading2 className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("heading", { level: 3 })}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                    label="Heading 3"
                >
                    <Heading3 className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("bold")}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    label="Bold"
                >
                    <Bold className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("italic")}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    label="Italic"
                >
                    <Italic className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("bulletList")}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    label="Bullet List"
                >
                    <List className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("orderedList")}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    label="Numbered List"
                >
                    <ListOrdered className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("blockquote")}
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    label="Quote"
                >
                    <Quote className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("alertCallout")}
                    onClick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .insertContent({
                                type: "alertCallout",
                                content: [
                                    {
                                        type: "paragraph",
                                        content: [{ type: "text", text: "Service Notice: Write important dates or affected areas here." }],
                                    },
                                ],
                            })
                            .run()
                    }
                    label="Insert Alert Callout"
                    highlight
                >
                    <AlertTriangle className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="hidden sm:inline">Alert</span>
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    onClick={() => setPhotoSheetOpen(true)}
                    label="Insert Photo"
                    highlight
                >
                    <ImageIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="hidden sm:inline">Photo</span>
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    onClick={() => setVarSheetOpen(true)}
                    label="Insert Variable"
                    highlight
                >
                    <Code2 className="h-4 w-4" aria-hidden="true" />
                    <span>{`{{Var}}`}</span>
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    onClick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .insertTable({ rows: 3, cols: 2, withHeaderRow: true })
                            .run()
                    }
                    label="Insert Table"
                >
                    <TableIcon className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady}
                    active={editor?.isActive("link")}
                    onClick={() => {
                        const prev = editor?.getAttributes("link")?.href as string | undefined;
                        setLinkUrl(prev || "https://");
                        setLinkText("");
                        setLinkSheetOpen(true);
                    }}
                    label="Insert or Edit Link"
                >
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady || !editor?.can().undo()}
                    onClick={() => editor?.chain().focus().undo().run()}
                    label="Undo"
                >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
                <ToolbarButton
                    disabled={!editorReady || !editor?.can().redo()}
                    onClick={() => editor?.chain().focus().redo().run()}
                    label="Redo"
                >
                    <Redo2 className="h-4 w-4" aria-hidden="true" />
                </ToolbarButton>
            </div>

            <div className="tiptap-editor bg-card min-h-[320px]">
                <EditorContent editor={editor} />
            </div>

            {/* Insert Photo Sheet */}
            <Sheet open={photoSheetOpen} onOpenChange={setPhotoSheetOpen}>
                <SheetContent
                    title="Insert Inline Article Photo"
                    description="Upload via Uploadcare CDN with alt text & caption"
                    bodyClassName="space-y-4"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPhotoSheetOpen(false)}
                                className="h-11 border-2 border-foreground"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={!photoUrl}
                                onClick={handleInsertPhoto}
                                className="h-11 font-bold"
                            >
                                Insert Figure
                            </Button>
                        </div>
                    }
                >
                    <AdminImageUpload
                        value={photoUrl}
                        onChange={setPhotoUrl}
                        label="Upload Article Photo"
                        aspect="4:3"
                        metadataTag="article-inline"
                    />
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="inline-photo-alt">
                            Alt Text (Accessibility)
                        </label>
                        <Input
                            id="inline-photo-alt"
                            value={photoAlt}
                            onChange={(e) => setPhotoAlt(e.target.value)}
                            placeholder="Describe the photo (e.g. Colombo Central Mail Exchange counter)"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="inline-photo-caption">
                            Caption (Optional)
                        </label>
                        <Input
                            id="inline-photo-caption"
                            value={photoCaption}
                            onChange={(e) => setPhotoCaption(e.target.value)}
                            placeholder="Photo caption or credit shown below the image"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                </SheetContent>
            </Sheet>

            {/* Variable Picker Sheet */}
            <Sheet open={varSheetOpen} onOpenChange={setVarSheetOpen}>
                <SheetContent
                    title="Insert Site Variable"
                    description="Insert live values maintained in Site Variables"
                    bodyClassName="space-y-3"
                >
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                            value={varSearch}
                            onChange={(e) => setVarSearch(e.target.value)}
                            placeholder="Filter variables..."
                            className="pl-9 h-11 text-base bg-background"
                        />
                    </div>

                    {filteredVariables.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            No variables matched. Add one under Operations &rarr; Site Variables.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {filteredVariables.map((v) => (
                                <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => insertVariableTag(v.key)}
                                    className="tap flex min-h-[48px] w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left hover:border-foreground"
                                >
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs font-bold text-primary">{`{{${v.key}}}`}</p>
                                        {v.description && (
                                            <p className="text-xs text-muted-foreground truncate">{v.description}</p>
                                        )}
                                    </div>
                                    <span className="shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 font-mono text-xs font-semibold max-w-[140px] truncate">
                                        {v.value}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Link Sheet */}
            <Sheet open={linkSheetOpen} onOpenChange={setLinkSheetOpen}>
                <SheetContent
                    title="Insert External / Internal Link"
                    description="Add a link without leaving the keyboard"
                    bodyClassName="space-y-4"
                    footer={
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLinkSheetOpen(false)}
                                className="h-11 border-2 border-foreground"
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={handleInsertLink} className="h-11 font-bold">
                                Apply Link
                            </Button>
                        </div>
                    }
                >
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="tiptap-link-url">
                            URL
                        </label>
                        <Input
                            id="tiptap-link-url"
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://slpost.gov.lk/..."
                            className="h-11 text-base bg-background"
                        />
                    </div>
                    <div>
                        <label className="label-mono block mb-1.5" htmlFor="tiptap-link-text">
                            Link Text (If no text selected)
                        </label>
                        <Input
                            id="tiptap-link-text"
                            value={linkText}
                            onChange={(e) => setLinkText(e.target.value)}
                            placeholder="Read official notice"
                            className="h-11 text-base bg-background"
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
