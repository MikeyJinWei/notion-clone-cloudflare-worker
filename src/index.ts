import { Hono } from 'hono';
import { cors } from 'hono/cors';
import OpenAI from 'openai';

type Bindings = {
	OPEN_AI_KEY: string; // 進行 OpenAI API 認證、操作
	AI: Ai; // 進行其他 AI 的操作，e.g. Cloudflare
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 資源分享配置
app.use(
	'/*', // 允許的 req 路徑
	// 使用 cors() middleware
	cors({
		origin: '*', // 允許來自 Next.js 前端的 req
		allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type'], // 允許客戶端在 req 包含的 header
		allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT'], // 允許的 HTTP req method
		exposeHeaders: ['Content-Length', 'X-Kuma-Revision'], // 指定哪些 res header 可以提供給客戶端
		maxAge: 600, // 客戶端緩存 preflight req預檢請求 的時間，時間內瀏覽器不需為相同的 req 再次發送 preflight req
		credentials: true, // 指定是否允許客戶端與請求一起發送憑證 (e.g. Cookies 或 HTTP 認證信息)
	})
);

app.get('/', (ctx) => {
	console.log('Microservice is running');

	const message = {
		status: 'Microservice is running',
	};

	ctx.status(200);

	return ctx.json(message);
});

// 翻譯
app.post('/translateDocument', async (ctx) => {
	try {
		const { documentData, targetLang } = await ctx.req.json(); // 將 req body 從 JSON 解析成 JS object

		// 生成文檔的摘要
		const summaryResponse = await ctx.env.AI.run('@cf/facebook/bart-large-cnn', {
			input_text: documentData,
			max_length: 1000, // 指定摘要的最大長度
		});

		// 將摘要翻譯成其他語言
		const response = await ctx.env.AI.run('@cf/meta/m2m100-1.2b', {
			text: summaryResponse.summary,
			source_lang: 'english',
			target_lang: targetLang,
		});

		ctx.status(200);
		// 以 Response obj 返回 JSON 翻譯結果
		return new Response(JSON.stringify(response));
	} catch (error: any) {
		console.error('Translation Error:', error);

		if (error instanceof SyntaxError) {
			ctx.status(400);
			return ctx.json({ error: 'Invalid request format.' });
		}

		ctx.status(500);
		return ctx.json({ error: 'An error occurred during translation.' });
	}
});

// 與 AI 討論當前文件
app.post('/chatToDocument', async (ctx) => {
	try {
		// 使用 API key 初始化 OpenAI 客户端
		const openai = new OpenAI({
			apiKey: ctx.env.OPEN_AI_KEY,
		});

		// 從 req 中解構文件文檔及用戶提出的問題
		const { documentData, question } = await ctx.req.json();

		const chatCompletion = await openai.chat.completions.create({
			messages: [
				// 指導模型扮演系統角色回答用戶的問題
				{
					role: 'system',
					content:
						"You are an assistant helping the user to chat to a document. I am providing a JSON file of the markdown for the document. Using this, answer the user's question in the clearest way possible. The document is about " +
						documentData,
				},
				// 扮演客戶端角色提及問題
				{
					role: 'user',
					content: 'My question is: ' + question,
				},
			],
			model: 'gpt-4o-mini',
			temperature: 0.5,
		});

		const response = chatCompletion.choices[0].message.content; // 存取 res 文本內容

		ctx.status(200);
		return ctx.json({ message: response }); // return JSON 格式的 res 給客戶端
	} catch (error: any) {
		console.error('Chat Error:', error);

		if (error instanceof SyntaxError) {
			ctx.status(400);
			return ctx.json({ error: 'Invalid request format.' });
		}

		ctx.status(500);
		return ctx.json({ error: 'An error occurred while processing the chat.' });
	}
});

export default app;
