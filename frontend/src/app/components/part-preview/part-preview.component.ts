import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Part } from '../../models/part.model';
import { LucideAngularModule, Box, X, ZoomIn, ImageOff, Upload } from 'lucide-angular';

@Component({
  selector: 'app-part-preview',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './part-preview.component.html',
  styleUrl: './part-preview.component.scss'
})
export class PartPreviewComponent implements OnChanges {
  @Input() part?: Part;
  readonly Box = Box;
  readonly X = X;
  readonly ZoomIn = ZoomIn;
  readonly ImageOff = ImageOff;
  readonly Upload = Upload;

  selectedImage: string = '';
  isZoomed: boolean = false;
  imageError: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['part']) {
      // Resetear estado completo al cambiar de parte
      this.imageError = false;
      this.isZoomed = false;

      if (this.part?.imageUrl) {
        this.selectedImage = this.part.imageUrl;
      } else {
        this.selectedImage = '';
      }
    }
  }

  selectThumbnail(imageUrl: string): void {
    this.selectedImage = imageUrl;
    this.imageError = false;
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
    return !!(this.selectedImage || this.part?.imageUrl) && !this.imageError;
  }
}
