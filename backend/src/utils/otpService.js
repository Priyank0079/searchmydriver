/**
 * Mock OTP Service.
 * In a real-world scenario, you would integrate Twilio, Fast2SMS, AWS SNS, MSG91, etc. here.
 */

export const sendSmsOtp = async (phone, otp) => {
  const useRealSms = process.env.USE_REAL_SMS === 'true';

  if (!useRealSms) {
    console.log(`\n=========================================`);
    console.log(`[MOCK SMS] Sending OTP to +91${phone}`);
    console.log(`[MOCK SMS] Your SearchMyDriver verification code is: ${otp}`);
    console.log(`=========================================\n`);

    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, message: 'OTP sent successfully (mock)' };
  }

  try {
    const template = process.env.SMS_INDIA_HUB_TEMPLATE_TEXT || 'Your OTP code is ${otp}';
    // Format message text and ensure we clean up the placeholder template
    const message = template
      .replace(/\${otp}/g, otp)
      .replace(/\${Search My Driver}/g, 'Search My Driver');

    const apiUrl = process.env.SMS_INDIA_HUB_URL || 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
    const url = new URL(apiUrl);
    
    url.searchParams.append('APIKey', process.env.SMS_INDIA_HUB_API_KEY || '');
    url.searchParams.append('msisdn', `91${phone}`);
    url.searchParams.append('sid', process.env.SMS_INDIA_HUB_SENDER_ID || '');
    url.searchParams.append('msg', message);
    url.searchParams.append('fl', '0');
    url.searchParams.append('gwid', process.env.SMS_INDIA_HUB_GWID || '2');
    
    if (process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID) {
      url.searchParams.append('dlttempid', process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID.trim());
    }

    console.log(`[SMS] Sending real SMS to +91${phone} via SMS India Hub...`);
    const response = await fetch(url.toString(), { method: 'GET' });
    const responseText = await response.text();
    console.log(`[SMS India Hub Response]:`, responseText);

    return { success: true, message: 'OTP sent successfully', details: responseText };
  } catch (error) {
    console.error('[SMS Error] Failed to send SMS via SMS India Hub:', error);
    throw error;
  }
};

