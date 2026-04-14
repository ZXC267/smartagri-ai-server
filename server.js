import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

import * as core from '@huaweicloud/huaweicloud-sdk-core';
import * as iotda from '@huaweicloud/huaweicloud-sdk-iotda/v5/public-api';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

function createIotdaClient() {
  const ak = process.env.HW_AK;
  const sk = process.env.HW_SK;
  const region = process.env.HW_REGION;

  if (!ak || !sk || !region) {
    throw new Error('missing HW_AK / HW_SK / HW_REGION');
  }

  const credentials = new core.BasicCredentials()
    .withAk(ak)
    .withSk(sk);

  const endpoint = `https://iotda.${region}.myhuaweicloud.com`;

  return iotda.IoTDAClient.newBuilder()
    .withCredential(credentials)
    .withEndpoint(endpoint)
    .build();
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
    const projectId = process.env.HW_PROJECT_ID;
    const deviceId = process.env.HW_DEVICE_ID;

    if (!projectId || !deviceId) {
      throw new Error('missing HW_PROJECT_ID / HW_DEVICE_ID');
    }

    const client = createIotdaClient();

    const request = new iotda.ShowDeviceShadowRequest();
    request.projectId = projectId;
    request.deviceId = deviceId;

    const response = await client.showDeviceShadow(request);
    const data = normalizeShadowToAppData(response);

    res.json(data);
  } catch (error) {
    console.error(
      'status latest error:',
      error?.response?.data || error?.message || error
    );
    res.status(500).json({ error: 'failed to get latest status from huawei iotda' });
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
要求：回答简短、通俗易懂。
简单解释原理，给出结论。

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
