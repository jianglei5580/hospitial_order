/**
 * 腾讯云短信配置
 *
 * 使用前需要：
 * 1. 在腾讯云控制台开通短信服务：https://console.cloud.tencent.com/smsv2
 * 2. 创建短信签名（如"XX医院"）并通过审核
 * 3. 创建短信模板（验证码类型），模板内容如：
 *    "您的注册验证码为{1}，{2}分钟内有效，请勿泄露给他人。"
 *    审核通过后获得模板ID
 * 4. 在 API密钥管理 获取 SecretId 和 SecretKey：
 *    https://console.cloud.tencent.com/cam/capi
 * 5. 将以下配置项填入
 *
 * npm install tencentcloud-sdk-nodejs --save
 */
module.exports = {
  enabled: false,

  secretId: '',
  secretKey: '',
  smsSdkAppId: '',
  signName: '',
  templateId: '',

  codeLength: 6,
  expireMinutes: 5,
  cooldownSeconds: 60,

  /**
   * 测试白名单：这些手机号不走真实短信通道，验证码固定为 testCode。
   * 正式上线时清空 testPhones 数组即可。
   */
  testPhones: ['15820448082'],
  testCode: '123456',
};
