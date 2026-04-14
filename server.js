import express from 'express';
import cors from 'cors';
import axios from 'axios';
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



// ==============================
// 查询华为云 IoTDA 设备影子
// ==============================
async function getDeviceShadow() {
  const token = process.env.HW_IAM_TOKEN;

  const region = process.env.HW_REGION;
  const projectId = process.env.HW_PROJECT_ID;
  const deviceId = process.env.HW_DEVICE_ID;

  if (!token || !region || !projectId || !deviceId) {
    throw new Error('missing huawei iot env variables');
  }

  const shadowUrl = `https://iotda.${region}.myhuaweicloud.com/v5/iot/${projectId}/devices/${deviceId}/shadow`;

  const response = await axios.get(shadowUrl, {
    headers: {
      'X-Auth-Token': token
    }
  });

  return response.data;
}

// ==============================
// 从影子数据里提取 reported 属性
// ==============================
function extractReportedProperties(shadowData) {
  const shadowList = shadowData?.shadow;

  if (!Array.isArray(shadowList) || shadowList.length === 0) {
    return {};
  }

  for (const item of shadowList) {
    if (item?.reported?.properties) {
      return item.reported.properties;
    }
    if (item?.reported) {
      return item.reported;
    }
  }

  return {};
}

// ==============================
// 测试接口
// ==============================
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// ==============================
// 给 App 用的最新状态接口
// ==============================
app.get('/status/latest', async (req, res) => {
  try {
    const shadowData = await getDeviceShadow();
    const reported = extractReportedProperties(shadowData);

    const data = {
      Temperature: Number(reported.Temperature ?? 0),
      Humidity: Number(reported.Humidity ?? 0),
      Luminance: Number(reported.Luminance ?? 0),
      soilVoltage: Number(reported.soilVoltage ?? 0),
      eco2: Number(reported.eco2 ?? 0),
      tvoc: Number(reported.tvoc ?? 0),
      pump: String(reported.pump ?? 'OFF'),
      lightCtrl: String(reported.lightCtrl ?? 'OFF'),
      fanCtrl: String(reported.fanCtrl ?? 'OFF'),
      buzzer: String(reported.buzzer ?? 'OFF'),
      tempAlarm: String(reported.tempAlarm ?? 'OFF'),
      soilAlarm: String(reported.soilAlarm ?? 'OFF'),
      lightMode: String(reported.lightMode ?? 'AUTO'),
      fanMode: String(reported.fanMode ?? 'AUTO'),
      pumpMode: String(reported.pumpMode ?? 'AUTO')
    };

    res.json(data);
  } catch (error) {
    console.error(
      'status latest error:',
      error?.response?.data || error?.message || error
    );
    res.status(500).json({ error: 'failed to get latest status from huawei iotda' });
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
要求：回答简短、简单易懂。
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
    console.error('chat error:', err?.message || err);
    res.json({ reply: 'AI 服务暂时不可用' });
  }
});

app.listen(port, () => {
  console.log(`服务已启动: ${port}`);
});
