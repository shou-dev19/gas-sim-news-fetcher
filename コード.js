// Gemini APIを呼び出す関数
function getGeminiSummary(title) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + apiKey;

  const prompt = `以下のニュース記事のタイトルから、格安SIMユーザーにとってどのようなメリットや注目点があるか、30文字程度で簡潔に要約してください。\n\n記事タイトル: ${title}`;

  const payload = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates[0].content.parts[0].text) {
      return json.candidates[0].content.parts[0].text.trim();
    }
    // レスポンスが想定外だった場合、その内容の一部を返す
    return "要約不可: " + (json.error ? json.error.message : "レスポンス構造エラー");
  } catch (e) {
    return "エラー: " + e.toString();
  }
}

function fetchSimNews() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. キーワードの取得とクエリ作成 ---
  const keywordSheet = ss.getSheetByName('検索キーワード');
  if (!keywordSheet) {
    console.error("「検索キーワード」シートが見つかりません。シートを作成してください。");
    return;
  }

  // A列のデータをすべて取得（空行を除外）
  const lastRowOfKeywords = keywordSheet.getLastRow();
  if (lastRowOfKeywords === 0) {
    console.warn("キーワードが入力されていません。");
    return;
  }
  
  const keywordValues = keywordSheet.getRange(1, 1, lastRowOfKeywords, 1).getValues();
  const keywords = keywordValues
    .flat()
    .filter(k => k !== "" && k !== null); // 空文字やnullを除外

  if (keywords.length === 0) {
    console.warn("有効なキーワードが見つかりませんでした。");
    return;
  }

  // キーワードを " OR " で結合（キーワードにスペースが含まれる場合はダブルクォーテーションで囲む）
  const query = keywords.map(k => {
    return k.includes(" ") ? `"${k}"` : k;
  }).join(' OR ');
  
  console.log("生成されたクエリ: " + query);

  // --- 2. ニュース取得処理 ---
  const sheet = ss.getSheetByName('ニュース一覧');
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;

  const response = UrlFetchApp.fetch(url);
  const xml = response.getContentText();
  const document = XmlService.parse(xml);
  const root = document.getRootElement();
  const channel = root.getChild('channel');
  const items = channel.getChildren('item');

  // スプレッドシート内の既存のURLを取得（重複チェック用）
  const lastRow = sheet.getLastRow();
  let existingUrls = [];
  if (lastRow > 1) {
    existingUrls = sheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
  }

  const newArticles = [];
  const now = new Date();

  items.forEach(item => {
    const title = item.getChildText('title');
    const link = item.getChildText('link');
    const pubDate = new Date(item.getChildText('pubDate'));
    const source = item.getChild('source').getText();

    if (!existingUrls.includes(link)) {
      console.log("要約を生成中: " + title);
      // ここでGemini APIを呼び出す
      const summary = getGeminiSummary(title);
      
      // [取得日, 公開日, タイトル, リンク, 要約, ソース]
      newArticles.push([now, pubDate, title, link, summary, source]);
      
      // APIの負荷軽減のため少し待機（必要に応じて）
      Utilities.sleep(500);
    }
  });

  if (newArticles.length > 0) {
    newArticles.sort((a, b) => b[1] - a[1]);
    sheet.insertRowsAfter(1, newArticles.length);
    sheet.getRange(2, 1, newArticles.length, 6).setValues(newArticles);
    console.log(`${newArticles.length} 件の新着記事を追加しました。`);
  } else {
    console.log("新着記事はありませんでした。");
  }
}