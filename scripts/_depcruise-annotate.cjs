/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT_PREFIX   = (process.env.ROOT_PREFIX || "").replace(/\/+/g, "");
const MAX_ANNOS     = Number(process.env.MAX_ANNOS || 40);
const INCLUDE_WARN  = String(process.env.INCLUDE_WARN || "true") !== "false";
const INCLUDE_ERROR = String(process.env.INCLUDE_ERROR || "true") !== "false";

function esc(s){return String(s).replace(/%/g,"%25").replace(/\r/g,"%0D").replace(/\n/g,"%0A");}
function toRepoRel(p){
  if(!p) return null;
  let s = String(p).replace(/\\/g,"/").replace(/^(\.\/|\/)/,"");
  if(path.isAbsolute(s)){
    const root = process.cwd().replace(/\\/g,"/");
    s = s.startsWith(root) ? s.slice(root.length).replace(/^\/+/, "") : path.basename(s);
  }
  if(ROOT_PREFIX && !s.startsWith(ROOT_PREFIX + "/")) s = `${ROOT_PREFIX}/${s}`;
  return s;
}

function defaultHandler(v){
  const file = toRepoRel(v.from || v.module);
  if(!file) return null;
  const sev  = String(v.rule?.severity || "warn").toLowerCase();
  if((sev === "error" && !INCLUDE_ERROR) || (sev !== "error" && !INCLUDE_WARN)) return null;

  const line = v.line || 1;
  return {
    kind: sev === "error" ? "error" : "warning",
    file,
    line,
    title: v.rule?.name || "depcruise",
    msg: v.comment || (v.to ? String(v.to) : "")
  };
}

const handlers = {
  "no-layer-barrel-imports": (v) => {
    const h = defaultHandler(v);
    if(!h) return null;
    if (h.file.includes("/__tests__/")) return null;
    h.title = "no-layer-barrel-imports";
    h.msg = v.comment || "レイヤー直下の index.ts への import を禁止します";
    return h;
  },
  "no-up-from-atoms": (v) => {
    const h = defaultHandler(v);
    if(!h) return null;
    h.kind = "error";
    h.title = "no-up-from-atoms";
    h.msg = v.comment || `Atoms から上位レイヤーへの依存は禁止: -> ${v.to || ""}`;
    return h;
  },
};

function main(){
  if(!fs.existsSync("depcruise.json")){
    console.log("depcruise.json not found."); return;
  }
  const report = JSON.parse(fs.readFileSync("depcruise.json","utf8"));
  const violations = report?.summary?.violations || [];

  if(!violations.length){ console.log("No dependency-cruiser violations."); return; }

  let out = 0;
  for(const v of violations){
    const name = v.rule?.name || "default";
    const handler = handlers[name] || defaultHandler;
    const anno = handler(v);
    if(!anno) continue;

    if(!fs.existsSync(path.resolve(process.cwd(), anno.file))) continue;

    console.log(`::${anno.kind} file=${esc(anno.file)},line=${anno.line},title=${esc(anno.title)}::${esc(anno.msg)}`);
    if(++out >= MAX_ANNOS) break;
  }
  console.log(`dependency-cruiser: annotated ${out}/${violations.length} issues`);
}

main();
