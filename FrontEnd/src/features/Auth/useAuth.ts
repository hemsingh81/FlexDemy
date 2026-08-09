import { useDomain } from '../../context/DomainContext';
import { useToast } from '../../context/ToastContext';
import * as authService from '../../services/authService';
import { AuthUser } from '../../services/authService';

// Shared mapping from the backend auth user shape (login/register/GET me all return the same
// UserDto shape) onto the DomainContext.updateUser() partial -- used by login/register below
// and by App.tsx's session-restore bootstrap (GET /auth/me on mount) so a restored session
// populates DomainContext exactly the same way a fresh login does, without duplicating the
// mapping in two places.
export const authUserToProfileUpdates = (user: AuthUser) => ({
  name: `${user.firstName} ${user.lastName}`,
  email: user.email,
  role: user.role,
});

// Real backend calls (login/register) via services/authService -- the mock-only
// "any submission succeeds" behavior is gone; wrong credentials now throw AuthError.
// The backend's Role claim (Master/Support/Tutor/Student) flows straight onto the
// shared user profile so RBAC-aware UI can read it from useDomain().
export const useAuth = () => {
  const { updateUser } = useDomain();
  const { showToast } = useToast();

  // Failures already throw (AuthError) and are shown inline by the calling page (LoginPage.tsx /
  // SignUpPage.tsx's own `error` state) -- toasting them here too would report the same failure
  // twice in two different places, so only the success case is wired up.
  const login = async (identifier: string, password: string) => {
    const { user } = await authService.login(identifier, password);
    updateUser(authUserToProfileUpdates(user));
    showToast({ message: 'Signed in successfully.', variant: 'success' });
  };

  const register = async (firstName: string, lastName: string, identifier: string, password: string) => {
    const { user } = await authService.register(firstName, lastName, identifier, password);
    updateUser(authUserToProfileUpdates(user));
    showToast({ message: 'Account created.', variant: 'success' });
  };

  return { login, register };
};
