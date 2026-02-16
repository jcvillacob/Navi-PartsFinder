import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Upload,
  Image,
  Users,
  User,
  Sun,
  Moon,
  ChevronDown,
  Download,
  Database,
} from 'lucide-angular';
import { ImageUploadModalComponent } from '../image-upload-modal/image-upload-modal.component';
import { ImportDataModalComponent } from '../import-data-modal/import-data-modal.component';
import { AuthService } from '../../services/auth.service';
import { PartsService } from '../../services/parts.service';

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
  readonly Download = Download;
  readonly Database = Database;

  showImageModal = false;
  showImportModal = false;
  isUserMenuOpen = false;
  theme: 'light' | 'dark' = 'dark';
  message: { text: string; type: 'loading' | 'success' | 'error' } | null = null;
  isExportingData = false;
  isResettingData = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private partsService: PartsService
  ) {
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

  exportData(): void {
    if (this.isExportingData) {
      return;
    }

    this.closeUserMenu();
    this.isExportingData = true;
    this.message = { text: 'Generando archivo Excel...', type: 'loading' };

    this.partsService.exportAdminData().subscribe({
      next: (response) => {
        const body = response.body;
        if (!body) {
          this.message = { text: 'No se recibió contenido para exportar', type: 'error' };
          this.isExportingData = false;
          return;
        }

        const disposition = response.headers.get('content-disposition');
        const filename = this.extractFilename(disposition) || `navi-parts-data-${Date.now()}.xlsx`;

        const fileUrl = URL.createObjectURL(body);
        const anchor = document.createElement('a');
        anchor.href = fileUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(fileUrl);

        this.message = { text: 'Exportacion completada', type: 'success' };
        this.isExportingData = false;
        setTimeout(() => (this.message = null), 5000);
      },
      error: (error) => {
        this.isExportingData = false;
        this.message = {
          text: error?.error?.error || 'No fue posible exportar los datos',
          type: 'error'
        };
        setTimeout(() => (this.message = null), 6000);
      }
    });
  }

  resetData(): void {
    if (this.isResettingData) {
      return;
    }

    this.closeUserMenu();

    const confirmed = window.confirm(
      'Esta accion eliminara todas las partes, compatibilidades, imagenes, inventario y logs de actividad. Los usuarios no se eliminaran. ¿Deseas continuar?'
    );

    if (!confirmed) {
      return;
    }

    const confirmationWord = window.prompt(
      'Para confirmar, escribe REINICIAR y presiona Aceptar'
    );

    if (confirmationWord !== 'REINICIAR') {
      this.message = { text: 'Confirmacion invalida. Operacion cancelada.', type: 'error' };
      setTimeout(() => (this.message = null), 5000);
      return;
    }

    this.isResettingData = true;
    this.message = { text: 'Reiniciando datos...', type: 'loading' };

    this.partsService.resetAdminData().subscribe({
      next: (result) => {
        this.isResettingData = false;
        const warningSuffix = result.warning ? ` (${result.warning})` : '';
        this.message = {
          text: `Datos reiniciados. Partes: ${result.deleted.parts}, compatibilidades: ${result.deleted.compatibilities}, imagenes: ${result.deleted.images}, inventario: ${result.deleted.inventory}.${warningSuffix}`,
          type: 'success'
        };
        setTimeout(() => (this.message = null), 8000);
      },
      error: (error) => {
        this.isResettingData = false;
        this.message = {
          text: error?.error?.error || 'No fue posible reiniciar los datos',
          type: 'error'
        };
        setTimeout(() => (this.message = null), 6000);
      }
    });
  }

  private extractFilename(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    return match?.[1] || null;
  }
}
