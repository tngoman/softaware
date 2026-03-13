import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import ProtectedRoute from './ProtectedRoute';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isStrictAdmin } = usePermissions();

  return (
    <ProtectedRoute>
      {isStrictAdmin() ? <>{children}</> : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
};

export default AdminRoute;
