import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import * as core from '@huaweicloud/huaweicloud-sdk-core';
import * as iotda from '@huaweicloud/huaweicloud-sdk-iotda/v5/public-api.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// 通义千问客户端
const openai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
});

// 创建华为云 IoTDA 客户端
function createIotdaClient() {
  const ak = (process.env.HW_AK || '').trim();
  const sk = (process.env.HW_SK || '').trim();
  const endpoint = (process.env.HW_IOTDA_ENDPOINT || '').trim();
  const projectId = (process.env.HW_PROJECT_ID || '').trim();

  console.log('🔧 初始化 IoTDA 客户端...');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   ProjectId: ${projectId}`);
  console.log(`   AK: ${ak.substring(0, 10)}...`);

  if (!ak || !sk || !endpoint || !projectId) {
    throw new Error('缺少环境变量: HW_AK / HW_SK / HW_IOTDA_ENDPOINT / HW_PROJECT_ID');
  }

  const credentials = new core.BasicCredentials()
    .withAk(ak)
    .withSk(sk)
    .withProjectId(projectId);

  return iotda.IoTDAClient.newBuilder()
    .withCredential(credentials)
    .withEndpoint(endpoint)
    .build();
}

// 解析设备数据
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

// 健康检查
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
});

// 获取设备最新状态
app.get('/status/latest', async (req, res) => {
  try {
    const deviceId = (process.env.HW_DEVICE_ID || '').trim();

    if (!deviceId) {
      throw new Error('缺少环境变量: HW_DEVICE_ID');
    }

    const client = createIotdaClient();

    const request = new iotda.ShowDeviceShadowRequest();
    request.deviceId = deviceId;

    console.log(`📡 查询设备影子: ${deviceId}`);
    const response = await client.showDeviceShadow(request);
    console.log('✅ 获取设备数据成功');

    const data = normalizeShadowToAppData(response);
    res.json(data);
  } catch (error) {
    console.error('❌ 获取设备状态失败:', error?.message || error);
    if (error?.response?.data) {
      console.error('   详情:', error.response.data);
    }
    res.status(500).json({ 
      error: '获取设备状态失败',
      detail: error?.message 
    });
  }
});

// AI 对话接口
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

// 启动服务
app.listen(port, () => {
  console.log(`✅ 服务已启动: ${port}`);
});
