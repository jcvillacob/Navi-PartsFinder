import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Box } from 'lucide-angular';
import { Compatibility } from '../../models/compatibility.model';

@Component({
  selector: 'app-compatibility-table',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './compatibility-table.component.html',
  styleUrl: './compatibility-table.component.scss'
})
export class CompatibilityTableComponent {
  readonly Box = Box;

  @Input() compatibilities: Compatibility[] = [];
}
