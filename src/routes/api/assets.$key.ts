import { createFileRoute } from "@tanstack/react-router";
import { getAsset } from "../../lib/storage";

export const Route = createFileRoute("/api/assets/$key")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { key: string } }) => {
        const { key } = params;
        if (!key) {
          return new Response("Asset key is required", { status: 400 });
        }

        const asset = await getAsset(key);
        if (!asset) {
          return new Response("Asset not found", { status: 404 });
        }

        // Cast ArrayBuffer to solve TypeScript type assignment constraints
        return new Response(asset.data.buffer as ArrayBuffer, {
          headers: {
            "Content-Type": asset.mimeType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
