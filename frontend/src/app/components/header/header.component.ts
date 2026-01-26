import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, Upload, Image, Users, User, Sun, Moon, ChevronDown } from 'lucide-angular';
import { ImageUploadModalComponent } from '../image-upload-modal/image-upload-modal.component';
import { ImportDataModalComponent } from '../import-data-modal/import-data-modal.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ImageUploadModalComponent, ImportDataModalComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly Upload = Upload;
  readonly Image = Image;
  readonly Users = Users;
  readonly UserIcon = User;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly ChevronDown = ChevronDown;

  showImageModal = false;
  showImportModal = false;
  isUserMenuOpen = false;
  theme: 'light' | 'dark' = 'dark';
  message: { text: string; type: 'loading' | 'success' | 'error' } | null = null;

  constructor(private auth: AuthService, private router: Router) {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      this.theme = storedTheme;
    }
    this.applyTheme();
  }

  get canImport(): boolean {
    return this.auth.hasRole(['admin', 'importer']);
  }

  get canManageUsers(): boolean {
    return this.auth.hasRole('admin');
  }

  get currentUser() {
    return this.auth.user;
  }

  get themeIcon() {
    return this.theme === 'dark' ? this.Sun : this.Moon;
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', this.theme);
    this.applyTheme();
  }

  applyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.theme);
  }

  toggleUserMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.isUserMenuOpen = false;
    }
  }

  goToUsers(): void {
    this.closeUserMenu();
    this.router.navigate(['/users']);
  }

  logout(): void {
    this.closeUserMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openImageUploadModal(): void {
    this.showImageModal = true;
    this.closeUserMenu();
  }

  closeImageUploadModal(): void {
    this.showImageModal = false;
  }

  openImportModal(): void {
    this.showImportModal = true;
    this.closeUserMenu();
  }

  closeImportModal(): void {
    this.showImportModal = false;
  }

  onImageUploaded(): void {
    this.message = { text: 'Imagen subida exitosamente', type: 'success' };
    setTimeout(() => this.message = null, 5000);
  }

  onImportSuccess(stats: { newParts: number; updatedParts: number; newCompatibilities: number }): void {
    this.message = {
      text: `Importacion exitosa: ${stats.newParts} partes nuevas, ${stats.updatedParts} actualizadas, ${stats.newCompatibilities} compatibilidades`,
      type: 'success'
    };
    setTimeout(() => this.message = null, 5000);
  }
}
