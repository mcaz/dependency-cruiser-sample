// scripts/depcruise-annotate.cjs
// 依存ゼロ。PRの最初の変更ファイルの 1 行目に固定コメントを付けるだけ。
// これで「Files changed」に出れば、パス解決やJSONパースが原因ではなかった、と切り分けできます。

const fs = require('fs');

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN が見つかりません（permissions: pull-requests: write が必要）');
    process.exit(0); // 失敗させず終了
  }

  const repoFull = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (!repoFull) {
    console.error('GITHUB_REPOSITORY が見つかりません');
    process.exit(0);
  }
  const [owner, repo] = repoFull.split('/');

  // PR番号をイベントペイロードから取得
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.error('GITHUB_EVENT_PATH が見つかりません');
    process.exit(0);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pull_number = event.pull_request?.number;
  if (!pull_number) {
    console.error('pull_request.number が見つかりません（PR以外のイベント？）');
    process.exit(0);
  }

  // 変更ファイルを 1 件だけ取得（Files changed に必ずあるパスを使う）
  const filesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/files?per_page=1`,
    { headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } }
  );
  if (!filesRes.ok) {
    console.error('listFiles 取得に失敗しました', filesRes.status, await filesRes.text());
    process.exit(0);
  }
  const files = await filesRes.json();
  if (!files.length) {
    console.log('変更ファイルがありません。PRレビューコメントは作成しません。');
    process.exit(0);
  }

  const targetPath = files[0].filename; // PRの1つ目の変更ファイル
  // 固定コメント本文（テスト用）
  const body = [
    '**[TEST] dependency-cruiser warning (fixed message)**',
    'このコメントは depcruise.json を読まずに、スクリプトが固定文言で投稿しています。',
    '→ Files changed に表示されれば、API・権限・パス解決の配線はOKです。',
  ].join('\n');

  // PRレビュー（コメント）を作成：差分行の 1 行目に固定で置く
  const reviewRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event: 'COMMENT',
        comments: [
          {
            path: targetPath,
            side: 'RIGHT',
            line: 1,
            body,
          },
        ],
      }),
    }
  );

  if (!reviewRes.ok) {
    console.error('createReview 失敗', reviewRes.status, await reviewRes.text());
    // フォールバック：PR全体コメント
    const issueRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${pull_number}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          body: `${body}\n\n（差分行に付けられなかったため、PR全体コメントとして投稿）`,
        }),
      }
    );
    if (!issueRes.ok) {
      console.error('fallback issue comment も失敗', issueRes.status, await issueRes.text());
    }
    process.exit(0);
  }

  console.log('OK: Files changed への固定コメントを投稿しました。', targetPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
