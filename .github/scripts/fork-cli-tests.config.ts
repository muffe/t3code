import { defineConfig } from "vite-plus";
import baseConfig from "../../vite.config.ts";

const { projects: _projects, ...test } = baseConfig.test ?? {};

export default defineConfig({ test });
