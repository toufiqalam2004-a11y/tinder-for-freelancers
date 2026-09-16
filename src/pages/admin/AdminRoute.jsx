import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from './AdminContext';

export default function AdminRoute({ children }) {
  const { isAuthenticated, isVerifying } = useAdmin();

  if (isVerifying) {
    return (
      <div className="min-h-screen w-full bg-[#141212] flex items-center justify-center text-neutral-400 text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <span>Verifying administrator privileges...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
