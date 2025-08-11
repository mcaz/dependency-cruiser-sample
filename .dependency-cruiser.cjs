/* eslint-disable */
const path = require("path");

module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { extensions: [".ts", ".tsx", ".js", ".jsx", ".json"] },
  },
  forbidden: [
    // Upward imports forbidden
    {
      name: "no-up-from-atoms",
      severity: "error",
      from: { path: "^src/components/Atoms" },
      to:   { path: "^src/components/(Molecules|Organisms|Templates|Pages)" }
    },
    {
      name: "no-up-from-molecules",
      severity: "error",
      from: { path: "^src/components/Molecules" },
      to:   { path: "^src/components/(Organisms|Templates|Pages)" }
    },
    {
      name: "no-up-from-organisms",
      severity: "error",
      from: { path: "^src/components/Organisms" },
      to:   { path: "^src/components/(Templates|Pages)" }
    },
    {
      name: "no-up-from-templates",
      severity: "error",
      from: { path: "^src/components/Templates" },
      to:   { path: "^src/components/Pages" }
    },
    // Disallow layer barrel import
    {
      name: "no-layer-barrel-imports",
      severity: "warn",
      from: { path: "^src" },
      to:   { path: "^src/components/(Atoms|Molecules|Organisms|Templates|Pages)/index\.(ts|tsx)$" }
    },
  ],
};
