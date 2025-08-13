// scripts/depcruise-annotate.cjs
// 目的: PR内の src/components/Molecules/MoleculesBox/MoleculesBox.tsx の
//      「差分上の実在する追加行」に固定メッセージのレビューコメントを投稿する。

const fs = require('fs');

async function gh(pathname, init = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.INPUT_GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN がありません（pull-requests: write が必要）');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers || {}),
  };
  return fetch(`https://api.github.com${pathname}`, { ...init, headers });
}

function findFirstAddedLineInNewFile(patch) {
  // unified diff を読み、最初の hunk の + 側の行番号を返す
  // 例: @@ -12,4 +20,7 @@  の +20 が新ファイル側の開始行
  if (!patch) return null;
  const lines = patch.split('\n');

  let newLineBase = null; // hunk開始時の新ファイル側開始行
  let newLine = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // hunk ヘッダをパース: @@ -a,b +c,d @@
      const m = line.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (m) {
        newLineBase = parseInt(m[2], 10);
      } else {
        newLineBase = null;
      }
      continue;
    }
    if (newLineBase == null) continue; // hunk外はスキップ

    // 文脈/追加/削除の各行で新ファイル側の行番号を進める
    if (line.startsWith('+')) {
      // 最初の追加行を見つけたら、その時点の newLine を返す
      newLine = newLine ?? newLineBase;
      return newLine;
    } else if (line.startsWith('-')) {
      // 旧ファイル側のみ。新ファイルの行は進めない
      // noop
    } else {
      // ' ' (コンテキスト) は新ファイル側の行も進む
      newLineBase += 1;
    }
    // 追加行でなければ、追加行が現れたときに newLineBase を使うのでここは何もしない
  }
  return null;
}

async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY; // owner/repo
  if (!repoFull) throw new Error('GITHUB_REPOSITORY がありません');
  const [owner, repo] = repoFull.split('/');

  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pull_number = ev.pull_request?.number;
  if (!pull_number) throw new Error('pull_request.number がありません');
  const headSHA = ev.pull_request?.head?.sha;
  if (!headSHA) throw new Error('pull_request.head.sha がありません');

  // 差分ファイル一覧
  const filesRes = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/files?per_page=300`);
  if (!filesRes.ok) throw new Error(`listFiles 失敗: ${filesRes.status} ${await filesRes.text()}`);
  const files = await filesRes.json();

  // 目標ファイル
  const TARGET_PATH = 'src/components/Molecules/MoleculesBox/MoleculesBox.tsx';
  const target = files.find(
    (f) => f.filename === TARGET_PATH || f.previous_filename === TARGET_PATH
  );

  if (!target) {
    // 差分に見つからない場合はPR全体コメントで通知
    const listed = files.slice(0, 50).map((f) => `- ${f.filename}`).join('\n');
    await gh(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body:
          `MoleculesBox.tsx (${TARGET_PATH}) がこのPRの差分に見つかりませんでした。\n` +
          `差分ファイル候補:\n${listed}`,
      }),
    });
    return;
  }

  // diff hunk から「新ファイル側の最初の追加行」を取得
  const firstAddedLine = findFirstAddedLineInNewFile(target.patch);
  if (!firstAddedLine) {
    // 追加行が無い（リネームのみ/コンテキストのみ）場合は、PR全体コメントにフォールバック
    await gh(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body:
          `MoleculesBox.tsx の差分に追加行が見つからず、差分行コメントを付けられませんでした。` +
          `（renameやコンテキストのみの可能性）`,
      }),
    });
    return;
  }

  // 単発API: Create a review comment for a pull request
  // 必須: commit_id(head), path, side: 'RIGHT', line: 差分で追加された「新ファイル側の実在行」
  const createRes = await gh(`/repos/${owner}/${repo}/pulls/${pull_number}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      commit_id: headSHA,
      path: target.filename, // 現在の差分上のパス
      side: 'RIGHT',
      line: firstAddedLine,
      body: `⚠️ dependency-cruiser violation: ${v.rule?.name || ''}\n${v.comment || ''}`
    }),
  });

  if (!createRes.ok) {
    console.error('createReviewComment 失敗:', createRes.status, await createRes.text());
    // フォールバック：PR全体コメント
    await gh(`/repos/${owner}/${repo}/issues/${pull_number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body:
          `差分行コメントに失敗したため、PR全体コメントにフォールバックしました。\n` +
          `target: ${target.filename}, firstAddedLine: ${firstAddedLine}`,
      }),
    });
  } else {
    console.log(
      `OK: ${target.filename} の差分 追加行 ${firstAddedLine} にインラインコメントを投稿しました。`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
