import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, Factory, Upload, Image, Users } from 'lucide-angular';
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
  readonly Factory = Factory;
  readonly Upload = Upload;
  readonly Image = Image;
  readonly Users = Users;

  showImageModal = false;
  showImportModal = false;
  message: { text: string; type: 'loading' | 'success' | 'error' } | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  get canImport(): boolean {
    return this.auth.hasRole(['admin', 'importer']);
  }

  get canManageUsers(): boolean {
    return this.auth.hasRole('admin');
  }

  get currentUser() {
    return this.auth.user;
  }

  goToUsers(): void {
    this.router.navigate(['/users']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  openImageUploadModal(): void {
    this.showImageModal = true;
  }

  closeImageUploadModal(): void {
    this.showImageModal = false;
  }

  openImportModal(): void {
    this.showImportModal = true;
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
      text: `Importación exitosa: ${stats.newParts} partes nuevas, ${stats.updatedParts} actualizadas, ${stats.newCompatibilities} compatibilidades`,
      type: 'success'
    };
    setTimeout(() => this.message = null, 5000);
  }
}
