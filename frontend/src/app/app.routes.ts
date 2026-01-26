import { Routes } from '@angular/router';
import { CatalogComponent } from './pages/catalog/catalog.component';
import { LoginComponent } from './pages/login/login.component';
import { UsersComponent } from './pages/users/users.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'catalog',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'catalog',
    component: CatalogComponent,
    canActivate: [authGuard]
  },
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] }
  },
  {
    path: '**',
    redirectTo: 'catalog'
  }
];
