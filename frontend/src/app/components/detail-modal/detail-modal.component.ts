import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, CheckCircle2, XCircle, MapPin, Package, Loader2 } from 'lucide-angular';
import { InventoryDetail, InventoryLocation } from '../../services/parts.service';

@Component({
  selector: 'app-detail-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './detail-modal.component.html',
  styles: []
})
export class DetailModalComponent {
  @Input() inventoryDetail?: InventoryDetail;
  @Input() isLoading: boolean = false;
  @Input() isOpen: boolean = false;

  @Output() close = new EventEmitter<void>();

  readonly X = X;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly MapPin = MapPin;
  readonly Package = Package;
  readonly Loader2 = Loader2;

  onClose(): void {
    this.close.emit();
  }

  get isAvailable(): boolean {
    return this.inventoryDetail?.available ?? false;
  }

  get totalQuantity(): number {
    return this.inventoryDetail?.totalQuantity ?? 0;
  }

  get locations(): InventoryLocation[] {
    return this.inventoryDetail?.locations ?? [];
  }

  get partNumber(): string {
    return this.inventoryDetail?.partNumber ?? '';
  }
}
