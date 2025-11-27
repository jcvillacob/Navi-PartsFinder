import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Info, Factory, Settings } from 'lucide-angular';
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

  @Input() part?: Part;
}
