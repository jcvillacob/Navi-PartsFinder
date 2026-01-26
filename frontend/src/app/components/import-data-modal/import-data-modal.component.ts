import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X, Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, Info } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';
import * as XLSX from 'xlsx';
import { Compatibility } from '../../models/compatibility.model';

@Component({
  selector: 'app-import-data-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './import-data-modal.component.html',
  styleUrl: './import-data-modal.component.scss'
})
export class ImportDataModalComponent {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() importSuccess = new EventEmitter<{ newParts: number; updatedParts: number; newCompatibilities: number }>();

  readonly X = X;
  readonly Upload = Upload;
  readonly FileSpreadsheet = FileSpreadsheet;
  readonly Download = Download;
  readonly CheckCircle = CheckCircle;
  readonly AlertCircle = AlertCircle;
  readonly Info = Info;

  selectedFile: File | null = null;
  isProcessing: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  isDragOver: boolean = false;

  readonly expectedColumns = [
    { name: 'Número de Parte', description: 'Código único de la parte principal', example: 'NAV81N6-26601', required: true },
    { name: 'Descripción', description: 'Descripción de la parte', example: 'Filtro de aceite motor', required: false },
    { name: 'Parte Compatible', description: 'Código de la parte equivalente', example: 'MANN-W920', required: true },
    { name: 'Equipo', description: 'Tipo de equipo o vehículo', example: 'Tractocamión T680', required: false },
    { name: 'Marca Original', description: 'Marca del fabricante original', example: 'Kenworth', required: false },
    { name: 'Marca Repuesto', description: 'Marca del repuesto equivalente', example: 'Navitrans', required: false }
  ];

  constructor(private partsService: PartsService) {}

  downloadTemplate(): void {
    const templateData = [
      this.expectedColumns.map(col => col.name),
      this.expectedColumns.map(col => col.example)
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Ajustar ancho de columnas
    ws['!cols'] = this.expectedColumns.map(() => ({ wch: 25 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');

    XLSX.writeFile(wb, 'plantilla_importacion.xlsx');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.handleFile(file);
    }
    event.target.value = '';
  }

  handleFile(file: File): void {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      this.errorMessage = 'Formato no válido. Solo se aceptan archivos Excel (.xlsx, .xls)';
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;
    this.errorMessage = '';
  }

  removeFile(): void {
    this.selectedFile = null;
    this.errorMessage = '';
  }

  processFile(): void {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.errorMessage = '';
    this.successMessage = '';

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const bstr: string = e.target.result;
        const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });

        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const result = this.validateAndProcessData(data);

        if (result.error) {
          this.isProcessing = false;
          this.errorMessage = result.error;
          return;
        }

        this.partsService.updateCompatibilities(result.compatibilities!).subscribe({
          next: (response) => {
            this.isProcessing = false;
            this.successMessage = `Importación exitosa: ${response.stats.newParts} partes nuevas, ${response.stats.updatedParts} actualizadas, ${response.stats.newCompatibilities} compatibilidades nuevas`;
            this.importSuccess.emit(response.stats);
            setTimeout(() => {
              this.closeModal();
            }, 3000);
          },
          error: (error) => {
            this.isProcessing = false;
            this.errorMessage = `Error al importar: ${error.message || 'Error desconocido'}`;
          }
        });
      } catch (error) {
        this.isProcessing = false;
        this.errorMessage = 'Error al leer el archivo. Asegúrate de que sea un archivo Excel válido.';
      }
    };

    reader.onerror = () => {
      this.isProcessing = false;
      this.errorMessage = 'Error al leer el archivo.';
    };

    reader.readAsBinaryString(this.selectedFile);
  }

  validateAndProcessData(data: any[][]): { error?: string; compatibilities?: Compatibility[] } {
    const expectedColumnNames = this.expectedColumns.map(col => col.name);

    if (data.length === 0) {
      return { error: 'El archivo está vacío. Debe contener al menos la fila de encabezados y una fila de datos.' };
    }

    const headers = data[0];

    if (!headers || headers.length === 0) {
      return { error: 'El archivo no tiene encabezados. La primera fila debe contener los nombres de las columnas.' };
    }

    const normalizedHeaders = headers.map((h: any) => String(h).trim());
    const missingColumns = expectedColumnNames.filter(col => !normalizedHeaders.includes(col));
    const extraColumns = normalizedHeaders.filter((col: string) => col && !expectedColumnNames.includes(col));

    if (missingColumns.length > 0) {
      return {
        error: `Faltan columnas requeridas:\n• ${missingColumns.join('\n• ')}\n\nDescarga la plantilla para ver el formato correcto.`
      };
    }

    if (extraColumns.length > 0) {
      return {
        error: `Columnas no reconocidas:\n• ${extraColumns.join('\n• ')}\n\nSolo se permiten las 6 columnas de la plantilla.`
      };
    }

    const columnIndices: { [key: string]: number } = {};
    expectedColumnNames.forEach(col => {
      columnIndices[col] = normalizedHeaders.indexOf(col);
    });

    const compatibilities: Compatibility[] = [];
    const errors: string[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      const hasData = row && row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (!hasData) continue;

      const partNumber = row[columnIndices['Número de Parte']] ? String(row[columnIndices['Número de Parte']]).trim() : '';
      const compatiblePart = row[columnIndices['Parte Compatible']] ? String(row[columnIndices['Parte Compatible']]).trim() : '';

      if (!partNumber && !compatiblePart) continue;

      if (!partNumber) {
        errors.push(`Fila ${i + 1}: Falta "Número de Parte"`);
        continue;
      }

      if (!compatiblePart) {
        errors.push(`Fila ${i + 1}: Falta "Parte Compatible"`);
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

    if (errors.length > 0 && compatibilities.length === 0) {
      return { error: `No se encontraron registros válidos:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... y ${errors.length - 5} errores más` : ''}` };
    }

    if (compatibilities.length === 0) {
      return { error: 'No se encontraron registros válidos en el archivo. Verifica que contenga datos además de los encabezados.' };
    }

    return { compatibilities };
  }

  closeModal(): void {
    this.isOpen = false;
    this.resetForm();
    this.close.emit();
  }

  resetForm(): void {
    this.selectedFile = null;
    this.errorMessage = '';
    this.successMessage = '';
    this.isProcessing = false;
    this.isDragOver = false;
  }
}
