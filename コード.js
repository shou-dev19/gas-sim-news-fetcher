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
  
  // --- 1. キーワードの取得 ---
  const keywordSheet = ss.getSheetByName('検索キーワード');
  if (!keywordSheet) {
    console.error("「検索キーワード」シートが見つかりません。シートを作成してください。");
    return;
  }

  const lastRowOfKeywords = keywordSheet.getLastRow();
  if (lastRowOfKeywords === 0) {
    console.warn("キーワードが入力されていません。");
    return;
  }
  
  const keywordValues = keywordSheet.getRange(1, 1, lastRowOfKeywords, 1).getValues();
  const keywords = keywordValues
    .flat()
    .filter(k => k !== "" && k !== null);

  if (keywords.length === 0) {
    console.warn("有効なキーワードが見つかりませんでした。");
    return;
  }

  // --- 2. ニュース取得処理（キーワードを分割して実行） ---
  const sheet = ss.getSheetByName('ニュース一覧');
  const BATCH_SIZE = 5; // URL長制限を避けるため5件ずつ処理
  const allItemsMap = new Map(); // 重複排除用のMap (key: link)

  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    const query = batch.map(k => k.includes(" ") ? `"${k}"` : k).join(' OR ');
    console.log(`バッチ処理中 (${i + 1}-${Math.min(i + BATCH_SIZE, keywords.length)}): ${query}`);

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;

    try {
      const response = UrlFetchApp.fetch(url);
      const xml = response.getContentText();
      const document = XmlService.parse(xml);
      const root = document.getRootElement();
      const channel = root.getChild('channel');
      const items = channel.getChildren('item');

      items.forEach(item => {
        const link = item.getChildText('link');
        if (!allItemsMap.has(link)) {
          allItemsMap.set(link, item);
        }
      });
    } catch (e) {
      console.error(`検索エラー (クエリ: ${query}): ${e.toString()}`);
    }
  }

  // --- 3. 新規記事の抽出と要約生成 ---
  const lastRow = sheet.getLastRow();
  let existingUrls = [];
  if (lastRow > 1) {
    existingUrls = sheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
  }

  const newArticles = [];
  const now = new Date();
  const items = Array.from(allItemsMap.values());

  items.forEach(item => {
    const title = item.getChildText('title');
    const link = item.getChildText('link');
    const pubDate = new Date(item.getChildText('pubDate'));
    const source = item.getChild('source').getText();

    if (!existingUrls.includes(link)) {
      console.log("要約を生成中: " + title);
      const summary = getGeminiSummary(title);
      newArticles.push([now, pubDate, title, link, summary, source]);
      Utilities.sleep(500); // API負荷軽減
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