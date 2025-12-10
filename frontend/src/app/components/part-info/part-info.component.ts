import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Info, Factory, Settings, Package } from 'lucide-angular';
import { Part } from '../../models/part.model';

@Component({
  selector: 'app-part-info',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './part-info.component.html',
  styleUrl: './part-info.component.scss'
})
export class PartInfoComponent {
  readonly Info = Info;
  readonly Factory = Factory;
  readonly Settings = Settings;
  readonly Package = Package;

  @Input() part?: Part;
  @Output() checkAvailability = new EventEmitter<string>();

  onCheckAvailability(): void {
    if (this.part?.partNumber) {
      this.checkAvailability.emit(this.part.partNumber);
    }
  }
}
