import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, Upload, Image, Check, Info } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';

@Component({
  selector: 'app-image-upload-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './image-upload-modal.component.html',
  styleUrl: './image-upload-modal.component.scss'
})
export class ImageUploadModalComponent {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() imageUploaded = new EventEmitter<void>();

  readonly X = X;
  readonly Upload = Upload;
  readonly Image = Image;
  readonly Check = Check;
  readonly Info = Info;

  partNumber: string = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isUploading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private partsService: PartsService) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Por favor selecciona un archivo de imagen válido';
        return;
      }

      this.selectedFile = file;
      this.errorMessage = '';
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        this.selectedFile = file;
        this.errorMessage = '';
        
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imagePreview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        this.errorMessage = 'Por favor selecciona un archivo de imagen válido';
      }
    }
  }

  uploadImage(): void {
    if (!this.partNumber.trim()) {
      this.errorMessage = 'Debes ingresar un número de parte';
      return;
    }

    if (!this.selectedFile) {
      this.errorMessage = 'Debes seleccionar una imagen';
      return;
    }

    this.isUploading = true;
    this.errorMessage = '';

    this.partsService.uploadPartImage(this.partNumber, this.selectedFile).subscribe({
      next: () => {
        this.isUploading = false;
        this.successMessage = 'Imagen subida exitosamente';
        this.imageUploaded.emit();
        setTimeout(() => {
          this.closeModal();
        }, 1500);
      },
      error: (err) => {
        this.isUploading = false;
        this.errorMessage = err.error?.error || 'Error al subir la imagen';
        console.error('Upload error:', err);
      }
    });
  }

  closeModal(): void {
    this.isOpen = false;
    this.resetForm();
    this.close.emit();
  }

  resetForm(): void {
    this.partNumber = '';
    this.selectedFile = null;
    this.imagePreview = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.isUploading = false;
  }
}
