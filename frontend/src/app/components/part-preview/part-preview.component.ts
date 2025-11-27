import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Part } from '../../models/part.model';
import { LucideAngularModule, Box, X, ZoomIn } from 'lucide-angular';

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

  selectedImage: string = '';
  isZoomed: boolean = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.part?.imageUrl) {
      this.selectedImage = this.part.imageUrl;
    }
  }

  selectThumbnail(imageUrl: string): void {
    this.selectedImage = imageUrl;
  }

  toggleZoom(): void {
    this.isZoomed = !this.isZoomed;
  }
}
