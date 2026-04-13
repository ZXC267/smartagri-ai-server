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
  apiKey: process.env.OPENAI_API_KEY || 'sk-aba6b3ce7cd64566b6add2868c234f6',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// 【修改后的 /chat 接口】支持解析字符串格式的 context
app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ reply: '请输入问题' });
    }

    // 核心改动：如果 context 是字符串，先 parse 成对象
    let parsedContext = {};
    if (context) {
      if (typeof context === 'string') {
        try {
          parsedContext = JSON.parse(context);
        } catch (parseErr) {
          console.error('context JSON 解析失败:', parseErr);
          parsedContext = {}; // 解析失败时用空对象兜底，不影响服务运行
        }
      } else {
        parsedContext = context; // 已经是对象就直接用
      }
    }

    // 拼接 prompt 时用解析后的 parsedContext
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

    const completion = await openai.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: fullPrompt }]
    });

    return res.json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('AI接口错误:', error);
    return res.json({
      reply: '抱歉，暂时无法获取AI分析，请稍后再试。'
    });
  }
});

app.listen(port, () => {
  console.log(`服务已启动，端口：${port}`);
});
