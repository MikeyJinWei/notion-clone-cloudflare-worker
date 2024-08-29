import { Hono } from 'hono';
import { cors } from 'hono/cors';
import OpenAI from 'openai';

type Bindings = {
	OPEN_AI_KEY: string; // 進行 OpenAI API 認證、操作
	AI: Ai; // 進行其他 AI 的操作，e.g. Cloudflare
};

const app = new Hono<{ Bindings: Bindings }>();
