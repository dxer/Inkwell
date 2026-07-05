import React, { useState, useEffect, useRef, useMemo } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import { uploadAssetFn } from "../lib/functions";
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
  onChange: (data: { json: string; html: string }) => void;
  editable?: boolean;
}

// Convert blocknote JSON structures into plain markdown for complete backwards compatibility
function convertBlocksToMarkdown(blocksJson: string): string {
  if (!blocksJson) return "";
  const trimmed = blocksJson.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return blocksJson; // Already raw markdown
  }
  try {
    const blocks = JSON.parse(blocksJson);
    if (!Array.isArray(blocks)) return blocksJson;
    
    let md = "";
    for (const block of blocks) {
      if (!block || !block.type) continue;
      
      const getInlineText = (contentList: any[]) => {
        if (!Array.isArray(contentList)) return "";
        return contentList.map(item => {
          let text = item.text || "";
          if (item.styles?.bold) text = `**${text}**`;
          if (item.styles?.italic) text = `*${text}*`;
          if (item.styles?.code) text = `\`${text}\``;
          return text;
        }).join("");
      };

      const inlineText = getInlineText(block.content);

      switch (block.type) {
        case "paragraph":
          md += `${inlineText}\n\n`;
          break;
        case "heading":
          const level = block.props?.level || 1;
          md += `${"#".repeat(level)} ${inlineText}\n\n`;
          break;
        case "bulletListItem":
          md += `- ${inlineText}\n`;
          break;
        case "numberedListItem":
          md += `1. ${inlineText}\n`;
          break;
        case "image":
          const url = block.props?.url || "";
          const caption = block.props?.caption || "图片";
          md += `![${caption}](${url})\n\n`;
          break;
        case "codeBlock":
          const codeText = block.content?.[0]?.text || "";
          const language = block.props?.language || "";
          md += `\`\`\`${language}\n${codeText}\n\`\`\`\n\n`;
          break;
        case "blockquote":
          md += `> ${inlineText}\n\n`;
          break;
        default:
          md += `${inlineText}\n\n`;
          break;
      }
    }
    return md.trim();
  } catch (e) {
    return blocksJson;
  }
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64Str = reader.result.split(",")[1];
        resolve(base64Str);
      } else {
        reject(new Error("文件转换失败"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function Editor({ initialContent, onChange, editable = true }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Parse compat markdown values
  const initialText = useMemo(() => {
    return convertBlocksToMarkdown(initialContent || "");
  }, [initialContent]);

  const [markdown, setMarkdown] = useState(initialText);
  const [splitMode, setSplitMode] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Sync state when async database loads
  useEffect(() => {
    setMarkdown(initialText);
  }, [initialText]);

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
        hljs.highlightElement(block as HTMLElement);
      });
    }
  }, [htmlContent, splitMode]);

  // Handle value change dispatching
  const handleChange = (val: string) => {
    try {
      const compiledHtml = marked.parse(val) as string;
      onChange({ json: val, html: compiledHtml });
    } catch (e) {
      onChange({ json: val, html: `<p>${val}</p>` });
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
          const base64 = await fileToBase64(file);
          const res = await uploadAssetFn({
            data: {
              name: file.name,
              type: file.type,
              base64,
            },
          });
          
          setMarkdown((prev) => prev.replace(`![图片上传中...](${tempId})`, `![图片](${res.url})`));
          handleChange(markdown.replace(`![图片上传中...](${tempId})`, `![图片](${res.url})`));
        } catch (err: any) {
          console.error("Paste image failed:", err);
          setMarkdown((prev) => prev.replace(`![图片上传中...](${tempId})`, ""));
          handleChange(markdown.replace(`![图片上传中...](${tempId})`, ""));
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
          const base64 = await fileToBase64(file);
          const res = await uploadAssetFn({
            data: {
              name: file.name,
              type: file.type,
              base64,
            },
          });
          
          setMarkdown((prev) => prev.replace(`![图片上传中...](${tempId})`, `![图片](${res.url})`));
          handleChange(markdown.replace(`![图片上传中...](${tempId})`, `![图片](${res.url})`));
        } catch (err: any) {
          console.error("Drop image failed:", err);
          setMarkdown((prev) => prev.replace(`![图片上传中...](${tempId})`, ""));
          handleChange(markdown.replace(`![图片上传中...](${tempId})`, ""));
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
