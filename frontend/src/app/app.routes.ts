import { Routes } from '@angular/router';
import { CatalogComponent } from './pages/catalog/catalog.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'catalog',
    pathMatch: 'full'
  },
  {
    path: 'catalog',
    component: CatalogComponent
  },
  {
    path: '**',
    redirectTo: 'catalog'
  }
];
