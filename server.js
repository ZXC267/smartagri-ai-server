import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 🔥 直接在这里写死 API Key，不用管环境变量了
const openai = new OpenAI({
  apiKey: 'sk-aba6b3ce7cd64566b6add2868c2c34f6', // <--- 这里填入你的 Key
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 测试路由
app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

// 👇 这里是你要的【支持 message + context】的新版 /chat 接口
app.post('/chat', async (req, res) => {
  try {
    // 1. 同时读取 message 和 context
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ reply: '缺少 message 参数' });
    }

    // 2. 把 context 拼成文字
    let contextText = '';
    if (context) {
      contextText = `
当前环境数据：
温度：${context.temperature}℃
湿度：${context.humidity}%
光照：${context.luminance} Lux
土壤电压：${context.soilVoltage} V
eCO2：${context.eco2} ppm
TVOC：${context.tvoc} ppb
水泵：${context.pump}
补光灯：${context.lightCtrl}
风机：${context.fanCtrl}
蜂鸣器：${context.buzzer}
温度报警：${context.tempAlarm}
土壤报警：${context.soilAlarm}
补光模式：${context.lightMode}
风机模式：${context.fanMode}
水泵模式：${context.pumpMode}
`.trim();
    }

    // 3. 组合最终提示词
    const finalPrompt = `
你是专业的智慧农业助手，请结合当前环境数据回答用户问题。
回答要求简洁、专业、可执行。

${contextText}

用户问题：
${message}
`.trim();

    // 4. 调用通义千问
    const completion = await openai.chat.completions.create({
      model: 'qwen-flash',
      messages: [{ role: 'user', content: finalPrompt }]
    });

    // 5. 返回格式不变：{ reply: "..." }
    res.json({
      reply: completion.choices[0].message.content || '分析失败'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ reply: '服务异常，请稍后再试' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
