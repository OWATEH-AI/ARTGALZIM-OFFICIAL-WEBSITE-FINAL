import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  preview: {
    // Upgrade to a paid plan to enable AI Gateway for your project.
    // aiGateway: true,
    buckets: {
      uploads: { access: "private" },
      assets: { access: "private" },
      media: { access: "private" },
      documents: { access: "private" },
      backups: { access: "private" },
      exports: { access: "private" },
    },
    functions: {
      api: { name: "api", source: "./hello.ts" },
    },
  },
});
