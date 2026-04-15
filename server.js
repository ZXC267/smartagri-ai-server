import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

async function getIamToken() {
  const username = (process.env.HW_IAM_USERNAME || '').trim();
  const password = (process.env.HW_IAM_PASSWORD || '').trim();
  const domain = (process.env.HW_IAM_DOMAIN || '').trim();
  const region = (process.env.HW_REGION || '').trim();

  if (!username || !password || !domain || !region) {
    throw new Error('缺少环境变量: HW_IAM_USERNAME / HW_IAM_PASSWORD / HW_IAM_DOMAIN / HW_REGION');
  }

  const iamUrl = 'https://iam.myhuaweicloud.com/v3/auth/tokens';

  const body = {
    auth: {
      identity: {
        methods: ['password'],
        password: {
          user: {
            name: username,
            password: password,
            domain: {
              name: domain
            }
          }
        }
      },
      scope: {
        project: {
          name: region
        }
      }
    }
  };

  const response = await axios.post(iamUrl, body, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const token = response.headers['x-subject-token'];

  if (!token) {
    throw new Error('未获取到 IAM Token');
  }

  return token;
}

function normalizeShadowToAppData(shadowData) {
  const shadowList = shadowData?.shadow || [];
  let reported = {};

  for (const item of shadowList) {
    if (item?.reported?.properties) {
      reported = item.reported.properties;
      break;
    }
    if (item?.reported) {
      reported = item.reported;
      break;
    }
  }

  return {
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
}

app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

app.get('/status/latest', async (req, res) => {
  try {
    const projectId = (process.env.HW_PROJECT_ID || '').trim();
    const deviceId = (process.env.HW_DEVICE_ID || '').trim();
    const instanceId = (process.env.HW_INSTANCE_ID || '').trim();
    const endpoint = (process.env.HW_IOTDA_ENDPOINT || '').trim();

    if (!projectId || !deviceId || !instanceId || !endpoint) {
      throw new Error('缺少环境变量: HW_PROJECT_ID / HW_DEVICE_ID / HW_INSTANCE_ID / HW_IOTDA_ENDPOINT');
    }

    const token = await getIamToken();

    const url = `${endpoint}/v5/iot/${projectId}/devices/${deviceId}/shadow`;

    const response = await axios.get(url, {
      headers: {
        'X-Auth-Token': token,
        'Instance-Id': instanceId,
        'Content-Type': 'application/json'
      }
    });

    const data = normalizeShadowToAppData(response.data);
    res.json(data);
  } catch (error) {
    console.error('❌ 获取设备状态失败:', error?.response?.data || error?.message || error);
    res.status(500).json({
      error: '获取设备状态失败',
      detail: error?.response?.data || error?.message || 'unknown error'
    });
  }
});

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
要求：回答简短、通俗易懂，适合手机展示。

用户问题：${message}

当前环境数据：
- 温度: ${parsedContext.temperature ?? '--'} ℃
- 湿度: ${parsedContext.humidity ?? '--'} %
- 光照: ${parsedContext.luminance ?? '--'} Lux
- 土壤电压: ${parsedContext.soilVoltage ?? '--'} V
- eCO₂: ${parsedContext.eco2 ?? '--'} ppm
- TVOC: ${parsedContext.tvoc ?? '--'} ppb

设备状态：
- 水泵: ${parsedContext.pump ?? '--'}
- 补光灯: ${parsedContext.lightCtrl ?? '--'}
- 风机: ${parsedContext.fanCtrl ?? '--'}
- 蜂鸣器: ${parsedContext.buzzer ?? '--'}

报警状态：
- 温度报警: ${parsedContext.tempAlarm ?? '--'}
- 土壤报警: ${parsedContext.soilAlarm ?? '--'}

请根据以上数据给出简短、实用的建议：
`;

    const completion = await openai.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: fullPrompt }]
    });

    res.json({
      reply: completion.choices[0]?.message?.content || '暂时没有拿到有效回复'
    });
  } catch (err) {
    console.error('AI 对话错误:', err?.message || err);
    res.json({ reply: 'AI 服务暂时不可用，请稍后再试' });
  }
});

app.listen(port, () => {
  console.log(`✅ 服务已启动: ${port}`);
});
