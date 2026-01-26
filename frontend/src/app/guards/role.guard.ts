import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data?.['roles'] || []) as UserRole[];

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (roles.length > 0 && !auth.hasRole(roles)) {
    router.navigate(['/catalog']);
    return false;
  }

  return true;
};
