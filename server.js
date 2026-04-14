import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 测试接口
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// ==============================
// 给 App 用的最新状态接口
// ==============================
app.get('/status/latest', async (req, res) => {
  try {
    const data = {
      Temperature: 26.3,
      Humidity: 58.2,
      Luminance: 354,
      soilVoltage: 0.32,
      eco2: 400,
      tvoc: 0,
      pump: 'OFF',
      lightCtrl: 'OFF',
      fanCtrl: 'OFF',
      buzzer: 'OFF',
      tempAlarm: 'OFF',
      soilAlarm: 'OFF',
      lightMode: 'AUTO',
      fanMode: 'AUTO',
      pumpMode: 'AUTO'
    };

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'failed to get latest status' });
  }
});

// ==============================
// AI 对话接口
// ==============================
app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ reply: '请输入问题' });
    }

    let parsedContext = {};

    if (context) {
      if (typeof context === 'string') {
        try {
          parsedContext = JSON.parse(context);
        } catch {
          parsedContext = {};
        }
      } else {
        parsedContext = context;
      }
    }

    const fullPrompt = `
你是智慧农业助手。
要求：回答简短、一句话、适合手机看。
不要解释原理，只给结论。

用户问题：${message}
环境数据：
温度:${parsedContext.temperature ?? '--'}
湿度:${parsedContext.humidity ?? '--'}
光照:${parsedContext.luminance ?? '--'}
土壤:${parsedContext.soilVoltage ?? '--'}
eCO2:${parsedContext.eco2 ?? '--'}
TVOC:${parsedContext.tvoc ?? '--'}
水泵:${parsedContext.pump ?? '--'}
补光:${parsedContext.lightCtrl ?? '--'}
风机:${parsedContext.fanCtrl ?? '--'}
蜂鸣器:${parsedContext.buzzer ?? '--'}
温度报警:${parsedContext.tempAlarm ?? '--'}
土壤报警:${parsedContext.soilAlarm ?? '--'}
补光模式:${parsedContext.lightMode ?? '--'}
风机模式:${parsedContext.fanMode ?? '--'}
水泵模式:${parsedContext.pumpMode ?? '--'}

请直接给建议：
`;

    const completion = await openai.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: fullPrompt }]
    });

    res.json({
      reply: completion.choices[0]?.message?.content || '暂时没有拿到有效回复'
    });
  } catch (err) {
    res.json({ reply: 'AI 服务暂时不可用' });
  }
});

app.listen(port, () => {
  console.log(`服务已启动: ${port}`);
});
