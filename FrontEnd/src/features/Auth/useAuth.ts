import { useDomain } from '../../context/DomainContext';
import * as authService from '../../services/authService';

// Real backend calls (login/register) via services/authService -- the mock-only
// "any submission succeeds" behavior is gone; wrong credentials now throw AuthError.
export const useAuth = () => {
  const { updateUser } = useDomain();

  const login = async (identifier: string, password: string) => {
    const user = await authService.login(identifier, password);
    updateUser({ name: `${user.firstName} ${user.lastName}`, email: user.email });
  };

  const register = async (firstName: string, lastName: string, identifier: string, password: string) => {
    const user = await authService.register(firstName, lastName, identifier, password);
    updateUser({ name: `${user.firstName} ${user.lastName}`, email: user.email });
  };

  return { login, register };
};
