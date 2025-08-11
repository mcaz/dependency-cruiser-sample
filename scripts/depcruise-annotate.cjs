/* eslint-disable no-console */
const fs = require("fs");

function main() {
  if (!fs.existsSync("depcruise.json")) {
    console.log("depcruise.json not found.");
    return;
  }
  const report = JSON.parse(fs.readFileSync("depcruise.json","utf8"));
  const violations = (report?.summary?.violations?.length ? report.summary.violations : report.violations) || [];
  if (!violations.length) {
    console.log("No dependency-cruiser violations.");
    return;
  }
  const limit = 40;
  let count = 0;
  for (const v of violations) {
    const from = v.from || v.module || {};
    const file = from.resolved || from.source || from;
    const line = from.line || 1;
    const severity = (v.rule?.severity || v.severity || "warn").toLowerCase();
    const ruleName = v.rule?.name || v.name || "depcruise";
    const msg = (v.comment || v.rule?.comment || v.to || JSON.stringify(v)).toString().replace(/\n/g," ");
    const kind = severity === "error" ? "error" : "warning";
    if (typeof file === "string" && file.startsWith("src")) {
      console.log(`::${kind} file=${file},line=${line},title=${ruleName}::${msg}`);
      count++;
      if (count >= limit) break;
    }
  }
  console.log(`dependency-cruiser: annotated ${count}/${violations.length} issues`);
}

main();
