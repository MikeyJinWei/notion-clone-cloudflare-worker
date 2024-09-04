import { Hono } from 'hono';
import { cors } from 'hono/cors';
import OpenAI from 'openai';

type Bindings = {
	OPEN_AI_KEY: string; // 進行 OpenAI API 認證、操作
	AI: Ai; // 進行其他 AI 的操作，e.g. Cloudflare
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/', (ctx) => {
	// console.log('Hello, hono is working with cloudflare worker!');
	return ctx.text('Hello, hono is working with cloudflare worker!');
	// return new Response(null, { status: 204 });
});

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

// 待修正 start
// 處理翻譯請求
// POST req，路徑為 /translateDocument
app.post('/translateDocument', async (ctx) => {
	const { documentData, targetLang } = await ctx.req.json(); // 將 req body 從 JSON 解析成 JS object

	// 生成文檔的摘要
	const summaryResponse = await ctx.env.AI.run('@cf/facebook/bart-large-cnn', {
		input_text: documentData,
		max_length: 1000, // 指定摘要的最大長度
	});

	// 將摘要翻譯成其他語言
	const response = (await ctx.env.AI.run)('@cf/meta/m2m100-1.2b', {
		text: summaryResponse,
		source_lang: 'english',
		target_lang: targetLang,
	});

	// 以 JSON 返回翻譯結果
	return new Response(JSON.stringify(response));
});
// 待修正 end

export default app;
