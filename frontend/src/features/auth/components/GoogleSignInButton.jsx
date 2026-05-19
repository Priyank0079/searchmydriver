import { GoogleLogin } from '@react-oauth/google';

const GoogleSignInButton = ({
  onSuccess,
  onError,
  text = 'continue_with',
  disabled = false,
}) => (
  <div
    className={`w-full flex justify-center [&>div]:w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
  >
    <GoogleLogin
      onSuccess={onSuccess}
      onError={onError}
      theme="outline"
      size="large"
      width="320"
      text={text}
      shape="pill"
    />
  </div>
);

export default GoogleSignInButton;
