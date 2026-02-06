import { Card, Form, Input, Button, notification, Typography, Statistic } from 'antd';
import { LockOutlined, MailOutlined, SafetyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useMerchAuthStore, { type MerchUser } from '@/store/useMerchAuthStore';
import merchAxios from '@/lib/merchAxios';

const { Text } = Typography;
const { Countdown } = Statistic;

type CredentialsFormValues = {
  email: string;
  password: string;
};

type OTPFormValues = {
  otp: string;
};

type AuthCardProps = {
  type?: 'login' | string;
};

type LoginStep = 'credentials' | 'otp';

const AuthCard = (_props: AuthCardProps) => {
  const [credentialsForm] = Form.useForm<CredentialsFormValues>();
  const [otpForm] = Form.useForm<OTPFormValues>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [otpExpiry, setOtpExpiry] = useState<number | null>(null);
  const navigate = useNavigate();
  const setAuth = useMerchAuthStore((s) => s.setAuth);

  // Reset OTP expiry when going back to credentials
  useEffect(() => {
    if (step === 'credentials') {
      setOtpExpiry(null);
    }
  }, [step]);

  // Step 1: Request OTP
  const onCredentialsSubmit = async (values: CredentialsFormValues) => {
    if (loading) return;
    setLoading(true);

    try {
      console.log('[AuthCard] Requesting OTP for:', values.email);
      const { data } = await merchAxios.post('/request-otp', {
        email: values.email,
        password: values.password,
      });

      console.log('[AuthCard] OTP request response:', data);

      // Store email and move to OTP step
      setEmail(values.email);
      setOtpExpiry(Date.now() + (data.expiresIn * 1000));
      setStep('otp');

      notification.success({
        message: 'OTP Sent',
        description: 'Verification code has been sent to admin. Please ask admin for the OTP.',
      });
    } catch (error: unknown) {
      console.error('[AuthCard] Request OTP error:', error);
      const resp = (error as any)?.response;
      const status = resp?.status;
      const serverMsg = resp?.data?.message;

      if (status === 401) {
        const msg = serverMsg || 'Invalid email or password';
        credentialsForm.setFields([
          { name: 'email', errors: [msg] },
          { name: 'password', errors: [msg] },
        ]);
      } else if (status === 403) {
        notification.error({
          message: 'Account Inactive',
          description: serverMsg || 'Please contact admin.',
        });
      } else {
        notification.error({
          message: 'Request Failed',
          description: serverMsg || 'Failed to send OTP. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const onOTPSubmit = async (values: OTPFormValues) => {
    if (loading) return;
    setLoading(true);

    try {
      console.log('[AuthCard] Verifying OTP for:', email);
      const { data } = await merchAxios.post('/verify-otp', {
        email: email,
        otp: values.otp,
      });

      console.log('[AuthCard] OTP verification response:', data);

      const u = data?.user;
      const accessToken = data?.accessToken;
      const refreshToken = data?.refreshToken;

      if (!u || !accessToken) throw new Error('Invalid server response');

      const merchUser: MerchUser = {
        id: u._id,
        email: u.email,
        isActive: !!u.active,
        permissions: {
          catalog: !!u.isCatalogAccess,
          lead: !!u.isLeadAccess,
          template: !!u.isTemplateAccess,
          email: !!u.isEmailAccess,
          followUp: !!u.isFollowUpAccess,
          customerEnquiry: !!u.isCustomerEnquiry,
          customerProfiling: !!u.isCustomerProfiling,
        },
      };

      if (!merchUser.isActive) {
        notification.error({
          message: 'Account Inactive',
          description: 'Please contact admin.',
        });
        return;
      }

      if (refreshToken) {
        localStorage.setItem('merchRefreshToken', refreshToken);
      }

      setAuth(accessToken, merchUser);
      notification.success({
        message: 'Login Successful',
        description: 'Redirecting to dashboard...',
      });
      navigate('/merchandiser/merchandiserDashboard', { replace: true });
    } catch (error: unknown) {
      console.error('[AuthCard] OTP verification error:', error);
      const resp = (error as any)?.response;
      const serverMsg = resp?.data?.message;

      otpForm.setFields([
        { name: 'otp', errors: [serverMsg || 'Invalid OTP'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    const password = credentialsForm.getFieldValue('password');
    if (!email || !password) {
      notification.error({
        message: 'Session Expired',
        description: 'Please go back and enter credentials again.',
      });
      handleBack();
      return;
    }

    setLoading(true);
    try {
      const { data } = await merchAxios.post('/request-otp', {
        email: email,
        password: password,
      });

      setOtpExpiry(Date.now() + (data.expiresIn * 1000));
      otpForm.resetFields();

      notification.success({
        message: 'OTP Resent',
        description: 'A new verification code has been sent to admin.',
      });
    } catch (error: unknown) {
      const resp = (error as any)?.response;
      const serverMsg = resp?.data?.message;
      notification.error({
        message: 'Resend Failed',
        description: serverMsg || 'Failed to resend OTP.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Go back to credentials
  const handleBack = () => {
    setStep('credentials');
    setEmail('');
    otpForm.resetFields();
  };

  // Handle OTP expiry
  const handleOTPExpiry = () => {
    notification.warning({
      message: 'OTP Expired',
      description: 'Please request a new OTP.',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        title={
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              Merchandiser Login
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {step === 'credentials'
                ? 'Access your merchandising dashboard'
                : 'Enter OTP to continue'}
            </p>
          </div>
        }
        className="w-full max-w-md border-0 shadow-lg rounded-xl overflow-hidden"
        styles={{
          header: { border: 'none', padding: '24px 24px 0' },
          body: { padding: '24px' }
        }}
      >
        <AnimatePresence mode="wait">
          {step === 'credentials' ? (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <Form
                form={credentialsForm}
                layout="vertical"
                onFinish={onCredentialsSubmit}
                className="space-y-4"
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: 'Please input your email' },
                    { type: 'email', message: 'Please enter a valid email' }
                  ]}
                >
                  <Input
                    prefix={<MailOutlined className="text-gray-400" />}
                    placeholder="Email Address"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[{ required: true, message: 'Please input your password' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-gray-400" />}
                    placeholder="Password"
                    size="large"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    block
                    className="bg-black hover:bg-gray-800 border-none font-medium h-12"
                  >
                    {loading ? 'Sending OTP...' : 'Get Verification Code'}
                  </Button>
                </Form.Item>
              </Form>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Back Button */}
              <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                className="mb-4 p-0 text-gray-500 hover:text-gray-700"
              >
                Back to login
              </Button>

              {/* Email Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <Text className="text-gray-600 text-sm">
                  Verification code sent for:
                </Text>
                <Text strong className="block text-gray-800">
                  {email}
                </Text>
              </div>

              {/* OTP Timer */}
              {otpExpiry && (
                <div className="text-center mb-4">
                  <Text className="text-gray-500 text-sm">OTP expires in: </Text>
                  <Countdown
                    value={otpExpiry}
                    format="mm:ss"
                    onFinish={handleOTPExpiry}
                    valueStyle={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#1890ff'
                    }}
                  />
                </div>
              )}

              <Form
                form={otpForm}
                layout="vertical"
                onFinish={onOTPSubmit}
                className="space-y-4"
              >
                <Form.Item
                  name="otp"
                  rules={[
                    { required: true, message: 'Please enter the OTP' },
                    { len: 6, message: 'OTP must be 6 digits' }
                  ]}
                >
                  <Input
                    prefix={<SafetyOutlined className="text-gray-400" />}
                    placeholder="Enter 6-digit OTP"
                    size="large"
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    block
                    className="bg-black hover:bg-gray-800 border-none font-medium h-12"
                  >
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </Button>
                </Form.Item>

                <div className="text-center">
                  <Text className="text-gray-500 text-sm">
                    Didn't receive the code?{' '}
                  </Text>
                  <Button
                    type="link"
                    onClick={handleResendOTP}
                    loading={loading}
                    className="p-0 text-blue-600 hover:text-blue-700"
                  >
                    Resend OTP
                  </Button>
                </div>
              </Form>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

export default AuthCard;