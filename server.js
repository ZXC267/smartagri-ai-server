import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: 'sk-aba6b3ce7cd64566b6add2868c2c34f6',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 测试接口
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// ==============================
// 最终版 /chat 接口
// 支持 message + context
// 强制中文 + 简洁输出 + 无context自动兜底
// ==============================
app.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};

    if (!message) {
      return res.status(400).json({ reply: '请输入问题' });
    }

    // 拼接环境数据（有就拼，没有就空）
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
温度报警：${context.tempAlarm}
土壤报警：${context.soilAlarm}
`.trim();
    }

    // 🔥 核心：强制中文 + 简洁 + 手机友好
    const finalPrompt = `
你是专业智慧农业助手。
规则：
1. 只用简体中文回答。
2. 回答控制在 3-5 行，简洁、适合手机半屏显示。
3. 优先根据环境数据给出结论 + 建议。
4. 无数据时正常回答，不编造。

环境数据：
${contextText || '无实时数据'}

用户问题：${message}
`.trim();

    // 调用AI
    const completion = await openai.chat.completions.create({
      model: "qwen-flash",
      messages: [{ role: "user", content: finalPrompt }],
      temperature: 0.4
    });

    // 返回格式不变
    res.json({
      reply: completion.choices[0].message.content || "分析失败"
    });

  } catch (err) {
    res.status(500).json({ reply: "服务异常，请稍后再试" });
  }
});

app.listen(port, () => {
  console.log(`🚀 服务已启动: ${port}`);
});
