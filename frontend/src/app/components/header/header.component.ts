import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Factory, Upload, Image } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';
import * as XLSX from 'xlsx';
import { Compatibility } from '../../models/compatibility.model';
import { ImageUploadModalComponent } from '../image-upload-modal/image-upload-modal.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ImageUploadModalComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  readonly Factory = Factory;
  readonly Upload = Upload;
  readonly Image = Image;

  isLoading = false;
  showImageModal = false;
  message: { text: string; type: 'loading' | 'success' | 'error' } | null = null;

  constructor(private partsService: PartsService) {}

  openImageUploadModal(): void {
    this.showImageModal = true;
  }

  closeImageUploadModal(): void {
    this.showImageModal = false;
  }

  onImageUploaded(): void {
    this.message = { text: 'Imagen subida exitosamente', type: 'success' };
    setTimeout(() => this.message = null, 5000);
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.isLoading = true;
      this.message = { text: 'Cargando archivo...', type: 'loading' };

      const reader: FileReader = new FileReader();
      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Validación estricta de columnas
        const expectedColumns = [
          'Número de Parte',
          'Descripción',
          'Parte Compatible',
          'Equipo',
          'Marca Original',
          'Marca Repuesto'
        ];

        if (data.length === 0) {
          this.isLoading = false;
          this.message = {
            text: '✗ El archivo está vacío. Por favor, sube un archivo con datos válidos.',
            type: 'error'
          };
          setTimeout(() => this.message = null, 8000);
          event.target.value = '';
          return;
        }

        const headers = data[0];

        // Verificar que existan headers
        if (!headers || headers.length === 0) {
          this.isLoading = false;
          this.message = {
            text: '✗ El archivo no tiene encabezados. Asegúrate de que la primera fila contenga los nombres de las columnas.',
            type: 'error'
          };
          setTimeout(() => this.message = null, 8000);
          event.target.value = '';
          return;
        }

        // Validar que las columnas coincidan exactamente
        const normalizedHeaders = headers.map((h: any) => String(h).trim());
        const missingColumns = expectedColumns.filter(col => !normalizedHeaders.includes(col));
        const extraColumns = normalizedHeaders.filter((col: string) => col && !expectedColumns.includes(col));

        if (missingColumns.length > 0 || extraColumns.length > 0) {
          this.isLoading = false;
          let errorMsg = '✗ Estructura de archivo incorrecta.\n\n';

          if (missingColumns.length > 0) {
            errorMsg += `Columnas faltantes: ${missingColumns.join(', ')}.\n`;
          }

          if (extraColumns.length > 0) {
            errorMsg += `Columnas no reconocidas: ${extraColumns.join(', ')}.\n`;
          }

          errorMsg += `\nColumnas esperadas: ${expectedColumns.join(', ')}.`;

          this.message = {
            text: errorMsg,
            type: 'error'
          };
          setTimeout(() => this.message = null, 10000);
          event.target.value = '';
          return;
        }

        // Crear mapeo de índices de columnas
        const columnIndices: { [key: string]: number } = {};
        expectedColumns.forEach(col => {
          columnIndices[col] = normalizedHeaders.indexOf(col);
        });

        const compatibilities: Compatibility[] = [];
        let emptyRows = 0;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];

          // Verificar que la fila tenga datos
          const hasData = row && row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');

          if (!hasData) {
            emptyRows++;
            continue;
          }

          // Validar que las columnas críticas tengan datos
          const partNumber = row[columnIndices['Número de Parte']] ? String(row[columnIndices['Número de Parte']]).trim() : '';
          const compatiblePart = row[columnIndices['Parte Compatible']] ? String(row[columnIndices['Parte Compatible']]).trim() : '';

          if (!partNumber || !compatiblePart) {
            console.warn(`Fila ${i + 1}: Faltan datos críticos (Número de Parte o Parte Compatible)`);
            continue;
          }

          const comp: Compatibility = {
            partNumber: partNumber,
            description: row[columnIndices['Descripción']] ? String(row[columnIndices['Descripción']]).trim() : '',
            compatiblePart: compatiblePart,
            equipment: row[columnIndices['Equipo']] ? String(row[columnIndices['Equipo']]).trim() : '',
            brand: row[columnIndices['Marca Original']] ? String(row[columnIndices['Marca Original']]).trim() : '',
            spareBrand: row[columnIndices['Marca Repuesto']] ? String(row[columnIndices['Marca Repuesto']]).trim() : 'Navitrans'
          };
          compatibilities.push(comp);
        }

        if (compatibilities.length === 0) {
          this.isLoading = false;
          this.message = {
            text: `✗ No se encontraron registros válidos. Se detectaron ${emptyRows} filas vacías. Verifica que el archivo contenga datos válidos.`,
            type: 'error'
          };
          setTimeout(() => this.message = null, 8000);
          event.target.value = '';
          return;
        }

        this.partsService.updateCompatibilities(compatibilities).subscribe({
          next: (response) => {
            this.isLoading = false;
            const stats = response.stats;
            this.message = {
              text: `✓ Importación exitosa: ${stats.newParts} partes nuevas, ${stats.updatedParts} actualizadas, ${stats.newCompatibilities} compatibilidades nuevas`,
              type: 'success'
            };
            setTimeout(() => this.message = null, 5000);
            console.log('Imported ' + compatibilities.length + ' items', response);
          },
          error: (error) => {
            this.isLoading = false;
            this.message = { text: `✗ Error al importar: ${error.message}`, type: 'error' };
            setTimeout(() => this.message = null, 5000);
            console.error('Import error:', error);
          }
        });
      };
      reader.readAsBinaryString(file);

      // Reset file input
      event.target.value = '';
    }
  }
}
