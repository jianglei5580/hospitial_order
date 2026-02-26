const smsConfig = require('./sms-config');

const codeStore = new Map();

function generateCode() {
  const len = smsConfig.codeLength || 6;
  let code = '';
  for (let i = 0; i < len; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function canSend(phone) {
  const record = codeStore.get(phone);
  if (!record) return { ok: true };
  const elapsed = (Date.now() - record.sentAt) / 1000;
  if (elapsed < smsConfig.cooldownSeconds) {
    return { ok: false, wait: Math.ceil(smsConfig.cooldownSeconds - elapsed) };
  }
  return { ok: true };
}

function isTestPhone(phone) {
  return (smsConfig.testPhones || []).includes(phone);
}

async function sendCode(phone) {
  const check = canSend(phone);
  if (!check.ok) return { code: 1, msg: `请${check.wait}秒后再试` };

  const expireMs = (smsConfig.expireMinutes || 5) * 60 * 1000;

  if (isTestPhone(phone)) {
    const fixedCode = smsConfig.testCode || '123456';
    codeStore.set(phone, { code: fixedCode, sentAt: Date.now(), expiresAt: Date.now() + expireMs });
    console.log(`[SMS-测试白名单] 手机号: ${phone}, 固定验证码: ${fixedCode}`);
    return { code: 0, msg: '验证码已发送' };
  }

  const verifyCode = generateCode();

  codeStore.set(phone, {
    code: verifyCode,
    sentAt: Date.now(),
    expiresAt: Date.now() + expireMs,
  });

  if (smsConfig.enabled) {
    try {
      const tencentcloud = require('tencentcloud-sdk-nodejs');
      const SmsClient = tencentcloud.sms.v20210111.Client;
      const client = new SmsClient({
        credential: { secretId: smsConfig.secretId, secretKey: smsConfig.secretKey },
        region: 'ap-guangzhou',
        profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
      });
      await client.SendSms({
        SmsSdkAppId: smsConfig.smsSdkAppId,
        SignName: smsConfig.signName,
        TemplateId: smsConfig.templateId,
        PhoneNumberSet: ['+86' + phone],
        TemplateParamSet: [verifyCode, String(smsConfig.expireMinutes || 5)],
      });
      console.log(`[SMS] 验证码已发送至 ${phone}`);
    } catch (e) {
      console.error('[SMS] 发送失败:', e.message);
      codeStore.delete(phone);
      return { code: 1, msg: '短信发送失败，请稍后重试' };
    }
  } else {
    console.log(`[SMS-模拟] 手机号: ${phone}, 验证码: ${verifyCode}, 有效期: ${smsConfig.expireMinutes}分钟`);
  }

  return { code: 0, msg: '验证码已发送' };
}

function verifyCode(phone, inputCode) {
  const record = codeStore.get(phone);
  if (!record) return { ok: false, msg: '请先获取验证码' };
  if (Date.now() > record.expiresAt) {
    codeStore.delete(phone);
    return { ok: false, msg: '验证码已过期，请重新获取' };
  }
  if (record.code !== inputCode) return { ok: false, msg: '验证码错误' };
  codeStore.delete(phone);
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of codeStore) {
    if (now > record.expiresAt + 60000) codeStore.delete(phone);
  }
}, 60000);

module.exports = { sendCode, verifyCode, canSend };
