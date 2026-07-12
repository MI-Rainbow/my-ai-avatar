// Difyから一括でデータを受け取ってブラウザへ送る、安定版中継プログラム
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
    
    // response_mode を最安定の「blocking」に設定します
    const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'blocking', // ここを最安定の blocking に変更
        user: 'vercel-user',
        conversation_id: "" 
      })
    });
    
    const data = await difyResponse.json();
    
    if (!difyResponse.ok) {
      console.error('Dify API Error:', data);
      return response.status(difyResponse.status).json({ error: data.message || 'Difyエラー' });
    }
    
    // index.htmlが正常に受け取れる形（data.answer）にして返却
    return response.status(200).json({
      answer: data.answer || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
}
