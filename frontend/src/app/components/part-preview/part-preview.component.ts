import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Part } from '../../models/part.model';
import { LucideAngularModule, Box, X, ZoomIn, ImageOff, Upload } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';

@Component({
  selector: 'app-part-preview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './part-preview.component.html',
  styleUrl: './part-preview.component.scss'
})
export class PartPreviewComponent implements OnChanges, OnDestroy {
  @Input() part?: Part;
  readonly Box = Box;
  readonly X = X;
  readonly ZoomIn = ZoomIn;
  readonly ImageOff = ImageOff;
  readonly Upload = Upload;

  selectedImage: string = '';
  isZoomed: boolean = false;
  imageError: boolean = false;
  isLoadingImage: boolean = false;
  private objectUrl: string | null = null;

  constructor(private partsService: PartsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['part']) {
      // Resetear estado completo al cambiar de parte
      this.imageError = false;
      this.isZoomed = false;
      this.selectedImage = '';
      this.isLoadingImage = false;
      this.clearObjectUrl();

      if (this.part?.partNumber && this.part?.imageUrl) {
        this.loadPrivateImage(this.part.partNumber);
      }
    }
  }

  ngOnDestroy(): void {
    this.clearObjectUrl();
  }

  toggleZoom(): void {
    if (this.hasValidImage) {
      this.isZoomed = !this.isZoomed;
    }
  }

  onImageError(): void {
    this.imageError = true;
  }

  get hasValidImage(): boolean {
    return !!this.selectedImage && !this.imageError;
  }

  private loadPrivateImage(partNumber: string): void {
    this.isLoadingImage = true;
    this.partsService.getPartImage(partNumber, 'medium').subscribe({
      next: (blob) => {
        this.clearObjectUrl();
        this.objectUrl = URL.createObjectURL(blob);
        this.selectedImage = this.objectUrl;
        this.imageError = false;
        this.isLoadingImage = false;
      },
      error: () => {
        this.selectedImage = '';
        this.imageError = true;
        this.isLoadingImage = false;
      }
    });
  }

  private clearObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
