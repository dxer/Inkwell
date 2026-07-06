import { createFileRoute } from "@tanstack/react-router";
import { putAsset } from "../../lib/storage";
import { generateId } from "../../lib/id";

// Direct multipart upload endpoint — bypasses the TanStack server-function RPC
// layer (which JSON-encodes payloads and chokes on large base64 bodies with
// "Failed to fetch" / "Network connection lost"). Accepts a raw binary file
// via FormData, persists it via putAsset (R2 in prod, in-memory in local dev),
// and returns the public URL.
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const formData = await request.formData();
          const file = formData.get("file");

          if (!(file instanceof File)) {
            return new Response(JSON.stringify({ error: "未提供文件" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const ext = (file.name.split(".").pop() || "png").replace(/[^a-zA-Z0-9]/g, "") || "png";
          const key = `${generateId()}.${ext}`;
          const buffer = await file.arrayBuffer();
          const url = await putAsset(key, buffer, file.type || "image/png");

          return new Response(JSON.stringify({ url }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || "上传失败" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
