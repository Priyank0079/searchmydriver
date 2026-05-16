import { Outlet } from 'react-router-dom';

const MobileLayout = () => {
  return (
    <div className="w-full max-w-lg min-h-dvh bg-bg flex flex-col relative">
      <Outlet />
    </div>
  );
};

export default MobileLayout;
