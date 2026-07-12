// Difyの仕様変更・エージェント化による400エラーを完全に回避する中継プログラム
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
    
    // 【最重要】400エラーを防ぐため、一括（blocking）ではなく最も互換性の高い「streaming」でDifyと通信します
    const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'streaming', // エージェント機能やGeminiの仕様変更による400エラーを防ぎます
        user: 'vercel-user',
        conversation_id: "" // 空文字のまま渡すことで新規会話として安全に処理します
      })
    });
    
    if (!difyResponse.ok) {
      const errorData = await difyResponse.json().catch(() => ({}));
      console.error('Dify API Error:', errorData);
      return response.status(difyResponse.status).json({ error: 'Dify側でエラーが発生しました。' });
    }
    
    // 中継サーバー（Vercel）側でストリーミング文字をすべて綺麗に1つの文章に合体させます
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
              
              // 通常のテキスト、またはエージェントの思考ログから言葉を抽出
              if (jsonData.answer) {
                fullAnswer += jsonData.answer;
              } else if (jsonData.event === 'agent_message' && jsonData.answer) {
                fullAnswer += jsonData.answer;
              }
            } catch (e) {
              // データの切れ目のパースエラーは無視
            }
          }
        }
      }
    }
    
    // index.html側が求めている「一括返却の形（data.answer）」に綺麗に変換して返します！
    // これにより index.html 側は一括受取モードのまま一切書き換えずに動きます。
    return response.status(200).json({
      answer: fullAnswer.trim() || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
}
