import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 🔥 关键修复：强制使用正确的 API Key，不依赖环境变量
const openai = new OpenAI({
  apiKey: 'sk-aba6b3ce7cd64566b6add2868c234f6', // 写死你的真实密钥
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ reply: '请输入问题' });
    }

    // 解析字符串格式的 context
    let parsedContext = {};
    if (context) {
      if (typeof context === 'string') {
        try {
          parsedContext = JSON.parse(context);
        } catch (e) {
          console.error('❌ context JSON 解析失败:', e);
          parsedContext = {};
        }
      } else {
        parsedContext = context;
      }
    }

    // 构建环境数据文本
    let contextText = '';
    if (parsedContext) {
      contextText = `
当前设备实时环境数据：
- 温度：${parsedContext.temperature ?? '--'} ℃
- 湿度：${parsedContext.humidity ?? '--'} %
- 光照：${parsedContext.luminance ?? '--'} lux
- 土壤电压：${parsedContext.soilVoltage ?? '--'} V
- CO₂：${parsedContext.eco2 ?? '--'} ppm
- TVOC：${parsedContext.tvoc ?? '--'}

设备状态：
- 水泵：${parsedContext.pump ?? '--'}
- 补光灯：${parsedContext.lightCtrl ?? '--'}
- 风机：${parsedContext.fanCtrl ?? '--'}
- 蜂鸣器：${parsedContext.buzzer ?? '--'}

报警状态：
- 温度报警：${parsedContext.tempAlarm ?? '--'}
- 土壤报警：${parsedContext.soilAlarm ?? '--'}

运行模式：
- 灯光模式：${parsedContext.lightMode ?? '--'}
- 风机模式：${parsedContext.fanMode ?? '--'}
- 水泵模式：${parsedContext.pumpMode ?? '--'}
`;
    }

    const fullPrompt = `
你是一个专业的智慧农业设备助手，只能用中文回答，语言简洁明了。

用户问题：${message}

${contextText}

请根据以上数据，给出专业、实用的建议。
`;

    // 🔥 主要修复：增加详细错误捕获
    try {
      const completion = await openai.chat.completions.create({
        model: 'qwen-turbo',
        messages: [{ role: 'user', content: fullPrompt }]
      });

      return res.json({
        reply: completion.choices[0].message.content
      });
    } catch (aiError) {
      console.error('❌ 千问 AI 调用失败:', aiError.response?.data || aiError.message);
      return res.json({
        reply: 'AI 服务调用失败，请检查密钥或网络连接。" + (aiError.response?.data?.message || "")'
      });
    }

  } catch (error) {
    console.error('❌ 服务器内部错误:', error);
    return res.json({
      reply: '服务器内部错误，请稍后再试。'
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 服务已启动，端口：${port}`);
});
