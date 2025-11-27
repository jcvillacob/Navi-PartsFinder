import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Factory, Upload } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';
import * as XLSX from 'xlsx';
import { Compatibility } from '../../models/compatibility.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly Factory = Factory;
  readonly Upload = Upload;

  constructor(private partsService: PartsService) {}

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      const reader: FileReader = new FileReader();
      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

        // Grab first sheet
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        // Save data
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Process data (skip header row)
        const compatibilities: Compatibility[] = [];
        
        // Assuming the structure matches the image:
        // Col 0: Part # (Ignored for now or used to validate)
        // Col 1: DESCRIPCIÓN (Ignored)
        // Col 2: PART Compatible #
        // Col 3: EQUIPO/MARCA
        // Col 4: MARCA
        // Col 5: MARCA RESPUESTO
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row.length > 2) {
             const comp: Compatibility = {
               compatiblePart: row[2] ? String(row[2]) : '',
               equipment: row[3] ? String(row[3]) : '',
               brand: row[4] ? String(row[4]) : '',
               spareBrand: row[5] ? String(row[5]) : ''
             };
             compatibilities.push(comp);
          }
        }

        if (compatibilities.length > 0) {
          this.partsService.updateCompatibilities(compatibilities);
          console.log('Imported ' + compatibilities.length + ' items');
        }
      };
      reader.readAsBinaryString(file);
    }
  }
}
