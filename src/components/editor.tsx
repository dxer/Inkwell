import React, { useState, useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import { toast } from "sonner";
import {
  Bold, Italic, Link2, Code, Quote, ImageIcon,
  Columns, Eye, Loader2
} from "lucide-react";

// Configure marked compiler options
marked.setOptions({
  gfm: true,
  breaks: true
});

interface EditorProps {
  initialContent?: string;
  onChange: (data: { markdown: string; html: string }) => void;
  editable?: boolean;
}

// Upload a single image file via direct multipart POST (bypasses the
// server-function RPC layer, which fails on large base64 payloads).
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `上传失败 (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.url as string;
}

export default function Editor({ initialContent, onChange, editable = true }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [markdown, setMarkdown] = useState(initialContent || "");
  const [splitMode, setSplitMode] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Sync state when async database loads
  useEffect(() => {
    setMarkdown(initialContent || "");
  }, [initialContent]);

  // Compile markdown to raw HTML
  const htmlContent = useMemo(() => {
    try {
      return marked.parse(markdown) as string;
    } catch (e) {
      return `<p class="text-destructive">Markdown 编译错误: ${(e as Error).message}</p>`;
    }
  }, [markdown]);

  // Syntax highlighting trigger
  useEffect(() => {
    if (previewRef.current && splitMode) {
      previewRef.current.querySelectorAll("pre code").forEach((block) => {
        const el = block as HTMLElement;
        // Check both class and dataset to prevent double-highlighting warning
        if (!el.classList.contains("hljs") && !el.dataset.highlighted) {
          hljs.highlightElement(el);
        }
      });
    }
  }, [htmlContent, splitMode]);

  // Handle value change dispatching
  const handleChange = (val: string) => {
    try {
      const compiledHtml = marked.parse(val) as string;
      onChange({ markdown: val, html: compiledHtml });
    } catch (e) {
      onChange({ markdown: val, html: `<p>${val}</p>` });
    }
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentVal = textarea.value;

    const newVal = currentVal.substring(0, startPos) + text + currentVal.substring(endPos);
    setMarkdown(newVal);
    handleChange(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = startPos + text.length;
    }, 0);
  };

  // Paste image handler
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        setUploading(true);
        const tempId = `uploading-${Date.now()}`;
        insertAtCursor(`![图片上传中...](${tempId})`);

        try {
          const url = await uploadImage(file);

          setMarkdown((prev) => {
            const next = prev.replace(`![图片上传中...](${tempId})`, `![图片](${url})`);
            handleChange(next);
            return next;
          });
        } catch (err: any) {
          console.error("Paste image failed:", err);
          setMarkdown((prev) => {
            const next = prev.replace(`![图片上传中...](${tempId})`, "");
            handleChange(next);
            return next;
          });
          toast.error("粘贴图片上传失败", { description: err.message || "" });
        } finally {
          setUploading(false);
        }
      }
    }
  };

  // Drag and drop image handler
  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        setUploading(true);
        const tempId = `uploading-${Date.now()}`;
        insertAtCursor(`![图片上传中...](${tempId})`);

        try {
          const url = await uploadImage(file);

          setMarkdown((prev) => {
            const next = prev.replace(`![图片上传中...](${tempId})`, `![图片](${url})`);
            handleChange(next);
            return next;
          });
        } catch (err: any) {
          console.error("Drop image failed:", err);
          setMarkdown((prev) => {
            const next = prev.replace(`![图片上传中...](${tempId})`, "");
            handleChange(next);
            return next;
          });
          toast.error("拖放图片上传失败", { description: err.message || "" });
        } finally {
          setUploading(false);
        }
      }
    }
  };

  // Key Tab interception for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const newVal = val.substring(0, start) + "  " + val.substring(end);
      setMarkdown(newVal);
      handleChange(newVal);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Toolbar clicks helpers
  const handleToolbarClick = (action: string) => {
    switch (action) {
      case "bold":
        insertAtCursor("**粗体文本**");
        break;
      case "italic":
        insertAtCursor("*斜体文本*");
        break;
      case "link":
        insertAtCursor("[链接文字](https://example.com)");
        break;
      case "code":
        insertAtCursor("\n```javascript\n// 在此输入代码\n```\n");
        break;
      case "quote":
        insertAtCursor("\n> 引用段落\n");
        break;
      case "image":
        insertAtCursor("![图片描述](https://example.com/image.jpg)");
        break;
    }
  };

  return (
    <div className="w-full flex flex-col min-h-[450px] bg-background text-foreground rounded-lg border border-border overflow-hidden">
      {/* Toolbar header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/10 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleToolbarClick("bold")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="加粗"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToolbarClick("italic")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="斜体"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToolbarClick("link")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="插入链接"
          >
            <Link2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToolbarClick("code")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="代码块"
          >
            <Code size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToolbarClick("quote")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="引用"
          >
            <Quote size={16} />
          </button>
          <button
            type="button"
            onClick={() => handleToolbarClick("image")}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="插入图片"
          >
            <ImageIcon size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {uploading && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-2">
              <Loader2 size={12} className="animate-spin text-primary" /> 上传图片中…
            </span>
          )}
          <button
            type="button"
            onClick={() => setSplitMode(!splitMode)}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              splitMode 
                ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20" 
                : "bg-background text-muted-foreground hover:text-foreground border border-border hover:bg-secondary"
            }`}
            title={splitMode ? "切换为单栏" : "开启分屏预览"}
          >
            <Columns size={13} />
            <span>{splitMode ? "分屏预览" : "纯编辑器"}</span>
          </button>
        </div>
      </div>

      {/* Editor columns grid */}
      <div className="flex-1 min-h-[400px] grid grid-cols-1 divide-y lg:divide-y-0 lg:divide-x divide-border lg:grid-cols-2">
        {/* Left editing pane */}
        <div className={`p-4 flex flex-col min-h-0 bg-background ${!splitMode && "lg:col-span-2"}`}>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              handleChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            className="flex-1 w-full min-h-[380px] bg-transparent resize-none border-0 p-0 text-sm font-mono focus:outline-none focus:ring-0 leading-relaxed placeholder:text-muted-foreground/30 text-foreground"
            placeholder="在此输入 Markdown 正文。支持拖入或直接粘贴图片上传…"
            disabled={!editable}
          />
        </div>

        {/* Right rendering pane */}
        {splitMode && (
          <div className="p-6 overflow-y-auto bg-secondary/10 dark:bg-card/10 max-h-[500px]">
            <div className="border-b border-border/40 pb-2 mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Eye size={12} /> 实时预览
              </span>
            </div>
            <div 
              ref={previewRef}
              className="prose-reader text-sm leading-relaxed max-w-none text-foreground break-words"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
