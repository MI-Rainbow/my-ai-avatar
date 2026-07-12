// Difyのチャットボット専用：400エラーを回避する完全版中継プログラム
export default async function handler(request, response) {
  // CORSエラーを防ぐためのお守り設定
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
    
    // Vercelに設定した環境変数を取得
    const systemToken = process.env.DIFY_API_KEY;
    if (!systemToken) {
      return response.status(500).json({ error: 'Vercel側に DIFY_API_KEY が設定されていません。' });
    }
    
    // チャットボットに最適な「blocking」モードで通信します
    const difyResponse = await fetch('https://dify.ai', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'blocking', // チャットボットは一括返却（blocking）が最も安定します
        user: 'vercel-user',
        conversation_id: "" // 【超重要】これがないと400エラーになります！
      })
    });
    
    const data = await difyResponse.json();
    
    if (!difyResponse.ok) {
      console.error('Dify API Error:', data);
      return response.status(difyResponse.status).json({ error: data.message || 'Difyエラー' });
    }
    
    // Difyから返ってきた正常な回答（data.answer）をそのままindex.htmlへ返却します
    return response.status(200).json({
      answer: data.answer || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
  }
}
