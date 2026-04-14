import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import axios from 'axios';
import crypto from 'crypto';

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

// 生成华为云 API 签名
function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function buildSignature(ak, sk, method, url, headers, body = '') {
  const timestamp = headers['X-Sdk-Date'];
  const contentType = headers['Content-Type'] || '';
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
  
  const canonicalHeaders = `content-type:${contentType}\nhost:${headers.host}\nx-project-id:${headers['X-Project-Id']}\nx-sdk-date:${timestamp}\n`;
  const signedHeaders = 'content-type;host;x-project-id;x-sdk-date';
  
  const canonicalRequest = `${method}\n${url}\n\n${canonicalHeaders}\n${signedHeaders}\n${contentSha256}`;
  
  const date = timestamp.substring(0, 8);
  const credentialScope = `${date}/iotda/cn-east-3/sdk_request`;
  const stringToSign = `SDK-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  
  const dateKey = hmacSha256(`SDK-HMAC-SHA256${sk}`, date);
  const regionKey = hmacSha256(dateKey, 'iotda');
  const serviceKey = hmacSha256(regionKey, 'cn-east-3');
  const signingKey = hmacSha256(serviceKey, 'sdk_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  return `SDK-HMAC-SHA256 Access=${ak}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// 获取设备状态
app.get('/status/latest', async (req, res) => {
  try {
    const ak = process.env.HW_AK;
    const sk = process.env.HW_SK;
    const projectId = process.env.HW_PROJECT_ID;
    const deviceId = process.env.HW_DEVICE_ID;
    const endpoint = process.env.HW_IOTDA_ENDPOINT;

    if (!ak || !sk || !projectId || !deviceId || !endpoint) {
      throw new Error('缺少环境变量');
    }

    // 提取 host（去掉 https://）
    const host = endpoint.replace('https://', '');
    
    // API 路径（查询设备影子）
    const path = `/v5/iot/${projectId}/devices/${deviceId}/shadow`;
    const method = 'GET';
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    
    const headers = {
      'Content-Type': 'application/json',
      'X-Sdk-Date': timestamp,
      'X-Project-Id': projectId,
      'host': host
    };
    
    const signature = buildSignature(ak, sk, method, path, headers);
    headers['Authorization'] = signature;
    
    const response = await axios.get(`${endpoint}${path}`, { headers });
    
    // 解析设备数据
    const shadowList = response.data?.shadow || [];
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
    
    const deviceData = {
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
    
    res.json(deviceData);
  } catch (error) {
    console.error('获取设备状态失败:', error?.response?.data || error?.message);
    res.status(500).json({ error: '获取设备状态失败' });
  }
});

// 健康检查
app.get('/', (req, res) => {
  res.send('✅ 智慧农业AI服务运行正常');
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
简单解释原理，给出结论。

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

控制模式：
- 补光模式: ${parsedContext.lightMode ?? '--'}
- 风机模式: ${parsedContext.fanMode ?? '--'}
- 水泵模式: ${parsedContext.pumpMode ?? '--'}

请根据以上数据，给出简短、实用的建议：
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
