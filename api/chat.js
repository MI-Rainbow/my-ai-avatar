// Difyの最新データ仕様（messageイベント）に対応した400エラー完全回避版中継プログラム
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const { text } = request.body;
    const systemToken = process.env.DIFY_API_KEY;
    if (!systemToken) {
      return response.status(500).json({ error: 'Vercel側に DIFY_API_KEY が設定されていません。' });
    }
    
    const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'streaming',
        user: 'vercel-user',
        conversation_id: ""
      })
    });
    
    if (!difyResponse.ok) {
      const errorData = await difyResponse.json().catch(() => ({}));
      console.error('Dify API Error:', errorData);
      return response.status(difyResponse.status).json({ error: 'Dify側でエラーが発生しました。' });
    }
    
    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = '';
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const jsonStr = trimmed.substring(5).trim();
              if (jsonStr === '[DONE]') continue;
              const jsonData = JSON.parse(jsonStr);
              
              // 【★最新仕様への修正箇所】
              // Difyの最新形式（messageまたはagent_messageイベント）から文字データを確実に抽出します
              if (jsonData.event === 'message' && jsonData.answer) {
                fullAnswer += jsonData.answer;
              } else if (jsonData.event === 'agent_message' && jsonData.answer) {
                fullAnswer += jsonData.answer;
              } else if (jsonData.answer) {
                // 予備用のフォールバック処理
                fullAnswer += jsonData.answer;
              }
            } catch (e) {
              // データの切れ目のパースエラーは安全に無視
            }
          }
        }
      }
    }
    
    // index.html側が求めている形（data.answer）にして返却
    return response.status(200).json({
      answer: fullAnswer.trim() || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
}
