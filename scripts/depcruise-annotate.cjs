// scripts/depcruise-annotate.cjs
const fs = require('fs');
const path = require('path');

async function gh(pathname, init = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  const h = init.headers || {};
  return fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...h,
    },
  });
}

const toRel = (p) => String(p || '').replace(/^(\.\/|\/)/, '');

async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY;
  const [owner, repo] = repoFull.split('/');
  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pull_number = ev.pull_request?.number;
  const ROOT_PREFIX = process.env.ROOT_PREFIX || ''; // 例: apps/supporter-web/

  // 変更ファイル一覧
  const filesRes = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/files?per_page=300`);
  const files = await filesRes.json();
  const changed = new Set();
  for (const f of files) {
    if (f.filename) changed.add(f.filename);
    if (f.previous_filename) changed.add(f.previous_filename);
  }

  // ① 固定コメント（検証用・一度だけ）
  if (files[0]?.filename) {
    await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'COMMENT',
        comments: [
          {
            path: files[0].filename,
            side: 'RIGHT',
            line: 1,
            body:
              '**[TEST] dependency-cruiser warning (fixed message)**\n' +
              'このコメントは固定文言です。次に depcruise.json 由来の本番コメントを試投します。',
          },
        ],
      }),
    });
  }

  // ② depcruise.json から本番コメント
  const reportPath = path.join(process.cwd(), 'depcruise.json');
  if (!fs.existsSync(reportPath)) {
    console.log('no depcruise.json – skip real annotations');
    return;
  }
  const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const violations = (data.violations || data.summary?.violations || []).filter((v) =>
    ['error', 'warn', 'warning'].includes(String(v.severity).toLowerCase())
  );

  const comments = [];
  for (const v of violations) {
    // from / to の候補を両方見る
    const cands = [v.from?.resolved, v.from?.source, v.from, v.to?.resolved, v.to?.source, v.to]
      .map(toRel)
      .filter(Boolean);

    let target = null;
    for (const c of cands) {
      const withPrefix = path.posix.join(ROOT_PREFIX, c); // apps/supporter-web/src/... に合わせる
      if (changed.has(withPrefix)) {
        target = withPrefix;
        break;
      }
      if (changed.has(c)) {
        target = c;
        break;
      }
    }
    if (!target) continue; // 差分外 → 後で全体コメント

    const body = [
      `dependency-cruiser violation (${v.severity})`,
      v.rule?.name ? `rule: \`${v.rule.name}\`` : null,
      v.comment ? `comment: ${v.comment}` : null,
      v.from && v.to
        ? `from: \`${toRel(v.from?.source || v.from)}\` -> to: \`${toRel(v.to?.source || v.to)}\``
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    comments.push({ path: target, side: 'RIGHT', line: 1, body });
    if (comments.length >= 50) break; // スパム防止
  }

  if (comments.length) {
    await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ event: 'COMMENT', comments }),
    });
  }

  // ③ 差分に紐づけられなかった違反があるなら、PR全体コメントで要約（ゼロ表示防止）
  const unmapped = violations.length - comments.length;
  if (unmapped > 0) {
    const summary = violations
      .slice(comments.length, comments.length + 30)
      .map(
        (v) =>
          `- ${v.severity} ${v.rule?.name ?? ''}: ${toRel(v.from?.source || v.from)} -> ${toRel(
            v.to?.source || v.to
          )}`
      )
      .join('\n');
    await gh(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body:
          `dependency-cruiser violations (not in changed files): ${unmapped} item(s)\n\n` + summary,
      }),
    });
  }
}

main().catch((e) => {
  console.error(e);
});
