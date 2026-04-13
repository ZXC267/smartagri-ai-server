import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 🔥 直接在这里写死 API Key，不用管环境变量了 🔥
const openai = new OpenAI({
  apiKey: 'sk-aba6b3ce7cd64566b6add2868c2c34f6', // <--- 在这里填入你的 Key
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 测试路由
app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

// 聊天接口
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const completion = await openai.chat.completions.create({
      model: 'qwen-flash',
      messages: [{ role: "user", content: message }]
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
