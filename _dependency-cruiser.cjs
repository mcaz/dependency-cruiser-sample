/* eslint-disable */

/**
 * dependency-cruiser 設定（CJS）
 * - 目的:
 *   - レイヤー間依存の制約（Atoms → 上位NG など）
 *   - バレル(index.ts/tsx)の直接 import を警告
 *   - 循環依存・孤立モジュールの検知
 *
 * Tips:
 * - モノレポで PR アノテーションの紐付き精度を上げるため、prefix を付与。
 * - TypeScript は CLI 側で `--ts-config ./tsconfig.json` を渡すのが公式推奨。
 * - import 解決の拡張子は enhancedResolveOptions で合わせる。
 */

const path = require("path");

module.exports = {
  options: {
    prefix: "apps/supporter-web/",
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
  },

  forbidden: [
    {
      name: "no-up-from-atoms",
      comment: "Atoms から上位（Molecules/Organisms/Templates/Pages）への依存は禁止",
      severity: "error",
      from: { path: "^src/components/Atoms" },
      to:   { path: "^src/components/(Molecules|Organisms|Templates|Pages)" },
    },
    {
      name: "no-up-from-molecules",
      comment: "Molecules から上位（Organisms/Templates/Pages）への依存は禁止",
      severity: "error",
      from: { path: "^src/components/Molecules" },
      to:   { path: "^src/components/(Organisms|Templates|Pages)" },
    },
    {
      name: "no-up-from-organisms",
      comment: "Organisms から上位（Templates/Pages）への依存は禁止",
      severity: "error",
      from: { path: "^src/components/Organisms" },
      to:   { path: "^src/components/(Templates|Pages)" },
    },
    {
      name: "no-up-from-templates",
      comment: "Templates から Pages への依存は禁止",
      severity: "error",
      from: { path: "^src/components/Templates" },
      to:   { path: "^src/components/Pages" },
    },
    {
      name: "no-layer-barrel-imports",
      comment: "各レイヤー直下の index.(ts|tsx) への import を禁止",
      severity: "warn",
      from: { path: "^src" },
      to:   { path: "^src/components/(Atoms|Molecules|Organisms|Templates|Pages)/index\\.(ts|tsx)$" },
    },
    {
      name: "no-circular",
      comment: "循環依存は禁止（import 経路を見直してください）",
      severity: "error",
      from: {},
      to:   { circular: true },
    },
    {
      name: "no-orphans",
      comment: "どこからも参照されていない（or どこにも参照していない）モジュールを検出",
      severity: "warn",
      from: { orphan: true },
      to:   {},
    },
    {
      name: "no-unresolved",
      comment: "解決できない import を禁止（パス/alias/拡張子の設定を見直す）",
      severity: "error",
      from: {},
      to:   { couldNotResolve: true },
    },
  ],

  allowed: [
    // 許可例を必要に応じて追加
  ],
};
