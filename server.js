import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 初始化千问（保持你原来的配置不变）
const openai = new OpenAI({
  apiKey: 'sk-aba6b3ce7cd64566b6add2868c234f6',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 测试接口（保留）
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// 【核心】/chat 接口（完全按你定的格式实现）
app.post('/chat', async (req, res) => {
  try {
    // 1. 按约定格式读取请求体：message + context
    const { message, context } = req.body || {};

    // 校验：必须有用户问题
    if (!message) {
      return res.status(400).json({ reply: '请输入问题' });
    }

    // 2. 把 context 里的实时数据，拼接成给AI的prompt
    let contextText = '';
    if (context) {
      contextText = `
当前设备实时环境数据：
- 温度：${context.temperature ?? '--'} ℃
- 湿度：${context.humidity ?? '--'} %
- 光照：${context.luminance ?? '--'} lux
- 土壤电压：${context.soilVoltage ?? '--'} V
- CO2：${context.eco2 ?? '--'} ppm
- TVOC：${context.tvoc ?? '--'}

设备状态：
- 水泵：${context.pump ?? '--'}
- 补光灯：${context.lightCtrl ?? '--'}
- 风机：${context.fanCtrl ?? '--'}
- 蜂鸣器：${context.buzzer ?? '--'}

报警状态：
- 温度报警：${context.tempAlarm ?? '--'}
- 土壤报警：${context.soilAlarm ?? '--'}

运行模式：
- 灯光模式：${context.lightMode ?? '--'}
- 风机模式：${context.fanMode ?? '--'}
- 水泵模式：${context.pumpMode ?? '--'}
`;
    }

    // 3. 组装最终prompt，发给千问
    const fullPrompt = `
你是一个专业的智慧农业设备助手，只能用中文回答，语言简洁明了。

用户问题：${message}

${contextText}

请根据以上数据，给出专业、实用的建议。
`;

    // 调用千问接口
    const completion = await openai.chat.completions.create({
      model: 'qwen-turbo', // 千问的模型，保持和你原来一致
      messages: [
        { role: 'user', content: fullPrompt }
      ]
    });

    // 4. 按约定格式返回：{ reply: "..." }
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
