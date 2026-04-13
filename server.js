console.log("程序启动了！");
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

function buildPrompt(question, context) {
  return `
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
`.trim()
}

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'SmartAgri AI server is running.'
  })
})

app.post('/ai/analyze', async (req, res) => {
  try {
    const { question, context } = req.body || {}

    if (!question || !context) {
      return res.status(400).json({
        ok: false,
        error: 'Missing question or context'
      })
    }

    const apiKey = process.env.DASHSCOPE_API_KEY
    const modelName = process.env.MODEL_NAME || 'qwen-flash'

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'Missing DASHSCOPE_API_KEY'
      })
    }

    const prompt = buildPrompt(question, context)

    const response = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业、简洁、可靠的智慧农业助手。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data
      })
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      '暂时无法生成分析结果，请稍后重试。'

    return res.json({
      ok: true,
      answer
    })
  } catch (error) {
    console.error('AI analyze error:', error)
    return res.status(500).json({
      ok: false,
      error: 'Internal server error'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})