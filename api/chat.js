// ストリーミング中継に対応した、最速レスポンス用の api/chat.js
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
      return response.status(500).json({ error: 'DIFY_API_KEY が設定されていません。' });
    }
    
    // response_mode を「streaming」にして、Difyからリアルタイムに言葉を返してもらいます
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
      return response.status(difyResponse.status).json({ error: 'Dify側でエラーが発生しました。' });
    }
    
    // ブラウザに対しても「これからリアルタイムにデータを流し込みます（Stream）」と伝えます
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    
    const reader = difyResponse.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        // Difyから届いた生のデータを、そのままブラウザにリアルタイムで転送します
        response.write(chunk);
      }
    }
    
    response.end();
    
  } catch (error) {
    console.error(error);
    if (!response.writableEnded) {
      response.status(500).json({ error: 'サーバー内部エラー' });
    }
  }
}
