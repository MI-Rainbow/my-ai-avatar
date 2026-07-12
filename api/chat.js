// Difyの環境変数の鍵を100%正しく利用する、Vercel用中継プログラム
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
    
    // Vercelの環境変数を呼び出し
    const systemToken = process.env.DIFY_API_KEY;
    if (!systemToken) {
      return response.status(500).json({ error: 'Vercel側に DIFY_API_KEY が設定されていません。' });
    }
    
    // エージェントアプリでもエラー（400）が出ないよう、最も互換性の高い「streaming」でDifyと通信します
    const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'streaming', // 400エラーを防ぐためstreamingに変更
        user: 'vercel-user'
      })
    });
    
    if (!difyResponse.ok) {
      const errorData = await difyResponse.json().catch(() => ({}));
      console.error('Dify API Error:', errorData);
      return response.status(difyResponse.status).json({ error: 'Dify側でエラーが発生しました。' });
    }
    
    // ストリーミングで届く文字列から、AIの回答テキスト（answer）だけを1つに結合して抽出します
    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAnswer = '';
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        // Difyから届く「data: {...}」の行を解析
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonData = JSON.parse(line.substring(5).trim());
              // 通常のチャット、またはエージェントの思考メッセージから文字を抽出します
              if (jsonData.answer) {
                fullAnswer += jsonData.answer;
              } else if (jsonData.event === 'agent_message' && jsonData.answer) {
                fullAnswer += jsonData.answer;
              }
            } catch (e) {
              // 不完全なJSON行はスキップ
            }
          }
        }
      }
    }
    
    // index.htmlが正常に受け取れる形（data.answer）にして返却
    return response.status(200).json({
      answer: fullAnswer.trim() || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: '中継サーバー内部でエラーが発生しました。' });
  }
}
