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
    
    // VercelのSettingsで設定した環境変数「DIFY_API_KEY」を安全に呼び出します
    const systemToken = process.env.DIFY_API_KEY;
    if (!systemToken) {
      return response.status(500).json({ error: 'Vercel側に DIFY_API_KEY が設定されていません。' });
    }
    
    // 【修正完了】送信先を正しいDifyのチャットAPIエンドポイントに変更しました
    const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${systemToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {},
        query: text,
        response_mode: 'blocking',
        user: 'vercel-user'
      })
    });
    
    const data = await difyResponse.json();
    
    // Difyからエラーが返ってきた場合の処理
    if (!difyResponse.ok) {
      console.error('Dify API Error:', data);
      return response.status(difyResponse.status).json({ error: data.message || 'Dify側でエラーが発生しました。' });
    }
    
    // index.htmlが「data.answer」で受け取れるように形を整えて返却します
    return response.status(200).json({
      answer: data.answer || 'お返事が見つかりませんでした。'
    });
    
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: '中継サーバー内部でエラーが発生しました。' });
  }
}
