// DifyのCORSブロックを100%回避する、Vercel専用の中継プログラム（API）
export default async function handler(request, response) {
    // どのサイト（スマホ）からアクセスされても通信を許可する設定
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 接続テスト用のお守り処理
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { text, token } = request.body;

        // Difyの会話窓口（本物のAPI住所）へデータを安全に転送します
        const difyResponse = await fetch('https://dify.ai', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
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
        
        // Difyから返ってきたAIの生の返答を、そのままあなたのスマホへ返します
        return response.status(200).json(data);

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: '中継サーバーでエラーが発生しました。' });
    }
}
