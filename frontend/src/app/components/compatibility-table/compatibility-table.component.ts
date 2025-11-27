import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Box, ChevronRight } from 'lucide-angular';
import { Compatibility } from '../../models/compatibility.model';
import { DetailModalComponent } from '../detail-modal/detail-modal.component';

@Component({
  selector: 'app-compatibility-table',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DetailModalComponent],
  templateUrl: './compatibility-table.component.html',
  styleUrl: './compatibility-table.component.scss'
})
export class CompatibilityTableComponent {
  readonly Box = Box;
  readonly ChevronRight = ChevronRight;

  @Input() compatibilities: Compatibility[] = [];
  
  selectedCompatibility?: Compatibility;

  onViewDetail(compatibility: Compatibility): void {
    this.selectedCompatibility = compatibility;
  }

  onCloseModal(): void {
    this.selectedCompatibility = undefined;
  }
}
