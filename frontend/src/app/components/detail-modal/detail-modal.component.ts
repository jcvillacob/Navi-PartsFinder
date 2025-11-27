import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, CheckCircle2, XCircle, MapPin, Package } from 'lucide-angular';
import { Compatibility } from '../../models/compatibility.model';

@Component({
  selector: 'app-detail-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './detail-modal.component.html',
  styles: []
})
export class DetailModalComponent {
  @Input() set compatibility(value: Compatibility | undefined) {
    this._compatibility = value;
    if (value) {
      this.calculateMockValues(value);
    }
  }
  get compatibility(): Compatibility | undefined {
    return this._compatibility;
  }

  @Output() close = new EventEmitter<void>();

  private _compatibility?: Compatibility;
  
  // Stable properties for view
  isAvailable: boolean = false;
  quantity: number = 0;
  location: string = 'Aguacatala';

  readonly X = X;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly MapPin = MapPin;
  readonly Package = Package;

  onClose(): void {
    this.close.emit();
  }

  private calculateMockValues(item: Compatibility): void {
    // Availability
    if (item.availability !== undefined) {
      this.isAvailable = item.availability;
    } else {
      // Mock: 70% chance of being available
      // Use a deterministic hash or just random but stored once
      this.isAvailable = Math.random() > 0.3;
    }

    // Quantity
    if (item.quantity !== undefined) {
      this.quantity = item.quantity;
    } else {
      this.quantity = Math.floor(Math.random() * 50) + 1;
    }

    // Location
    this.location = item.location || 'Aguacatala';
  }
}
