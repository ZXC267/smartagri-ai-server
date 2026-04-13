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

// ======================
// 智慧农业环境分析接口（你要的正式接口）
// ======================
app.post('/ai/analyze', async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || !context) {
      return res.status(400).json({
        ok: false,
        error: 'Missing question or context'
      });
    }

    // 拼接农业专业提示词
    const prompt = `
你是一个智慧农业助手。请基于以下环境数据，给出简洁、专业、可执行的建议。

要求：
1. 先判断当前环境是否正常
2. 如果有异常，指出异常项
3. 给出1到3条操作建议
4. 语言适合移动端展示，不要太长
5. 不要编造不存在的数据

当前环境数据：
温度：${context.temperature}℃
湿度：${context.humidity}%
光照：${context.light} Lux
土壤电压：${context.soilVoltage} V
CO₂浓度：${context.co2} ppm
当前模式：${context.autoMode ? '自动模式' : '手动模式'}
系统状态：${context.systemStatus}
温度报警：${context.tempAlarm ? '是' : '否'}
土壤报警：${context.soilAlarm ? '是' : '否'}
高温阈值：${context.tempHigh}℃
低温阈值：${context.tempLow}℃
土壤干旱阈值：${context.soilDry}V

用户问题：
${question}
`.trim();

    const completion = await openai.chat.completions.create({
      model: 'qwen-flash',
      messages: [
        { role: 'system', content: '你是专业、简洁、可靠的智慧农业助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5
    });

    const answer = completion.choices[0].message.content || '无法生成分析';

    return res.json({
      ok: true,
      answer: answer
    });

  } catch (error) {
    console.error('分析接口错误：', error);
    return res.status(500).json({
      ok: false,
      error: '服务器内部错误'
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
