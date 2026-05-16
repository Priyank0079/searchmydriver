import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <div className="flex-1 flex flex-col bg-white">
      <Outlet />
    </div>
  );
};

export default AuthLayout;
