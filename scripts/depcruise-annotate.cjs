// scripts/depcruise-annotate.cjs
// 目的: このPRの "src/components/Molecules/MoleculesBox/MoleculesBox.tsx" に
//       固定文言のレビューコメントを 1 件だけ投稿する（Files changed に出ることを確認）
// 依存: なし（Node の fetch を使用）。ワークフロー側で pull-requests: write 権限が必要。

const fs = require('fs');

async function gh(pathname, init = {}) {
  const token =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN が見つかりません（permissions: pull-requests: write が必要）');
    return { ok: false, status: 0, text: async () => 'no token' };
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers || {}),
  };
  return fetch(`https://api.github.com${pathname}`, { ...init, headers });
}

async function main() {
  // リポジトリとPR番号
  const repoFull = process.env.GITHUB_REPOSITORY; // e.g. "owner/repo"
  if (!repoFull) {
    console.error('GITHUB_REPOSITORY が見つかりません');
    return;
  }
  const [owner, repo] = repoFull.split('/');

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error('GITHUB_EVENT_PATH が見つかりません');
    return;
  }
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pull_number = event.pull_request?.number;
  if (!pull_number) {
    console.error('pull_request.number が見つかりません（PR以外のイベント）');
    return;
  }

  // 差分ファイル一覧を取得
  const filesRes = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/files?per_page=300`);
  if (!filesRes.ok) {
    console.error('listFiles 取得に失敗:', filesRes.status, await filesRes.text());
    return;
  }
  const files = await filesRes.json();

  // 目標ファイル（固定）
  const TARGET_PATH = 'src/components/Molecules/MoleculesBox/MoleculesBox.tsx';

  // 差分に存在するか確認（リネーム対応で previous_filename も見る）
  const targetInDiff = files.find(
    (f) => f.filename === TARGET_PATH || f.previous_filename === TARGET_PATH
  );

  if (targetInDiff) {
    // Files changed の MoleculesBox.tsx（現パス）に 1 行目で固定コメント
    const reviewRes = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'COMMENT',
        comments: [
          {
            path: targetInDiff.filename, // 現在の差分上のパスに合わせる
            side: 'RIGHT',
            line: 1, // まずは 1 行目固定（行番号解決は後で拡張可能）
            body:
              '**[TEST] dependency-cruiser warning (fixed message)**\n' +
              'MoleculesBox.tsx に対する決め打ち警告（動作検証用）。',
          },
        ],
      }),
    });

    if (!reviewRes.ok) {
      console.error('createReview 失敗:', reviewRes.status, await reviewRes.text());
    } else {
      console.log('OK: Files changed の MoleculesBox.tsx に固定コメントを投稿しました。');
    }
  } else {
    // 差分に無い場合は PR 全体コメントで知らせる
    const listed = files.slice(0, 50).map((f) => `- ${f.filename}`).join('\n');
    const issueRes = await gh(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body:
          `MoleculesBox.tsx (${TARGET_PATH}) がこのPRの差分に見つかりませんでした。\n` +
          `差分ファイル候補:\n${listed}`,
      }),
    });
    if (!issueRes.ok) {
      console.error('fallback issue comment 失敗:', issueRes.status, await issueRes.text());
    } else {
      console.log('差分に対象が無いため、PR全体コメントを投稿しました。');
    }
  }
}

main().catch((e) => {
  console.error(e);
});
