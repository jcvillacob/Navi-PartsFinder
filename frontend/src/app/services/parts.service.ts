import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { Part } from '../models/part.model';
import { Compatibility } from '../models/compatibility.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PartsService {
  // URL directa al backend
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Obtener información de una parte por su número
   */
  getPartByNumber(partNumber: string): Observable<Part> {
    return this.http
      .get<Part>(`${this.apiUrl}/parts/${encodeURIComponent(partNumber)}`)
      .pipe(
        map((part) => ({
          ...part,
        })),
      );
  }

  /**
   * Obtener lista de compatibilidades para una parte (con búsqueda)
   */
  getCompatibilities(searchTerm: string): Observable<Compatibility[]> {
    const url = `${this.apiUrl}/search?q=${encodeURIComponent(searchTerm)}`;
    return this.http.get<Compatibility[]>(url);
  }

  /**
   * Actualizar la lista de compatibilidades (importación Excel)
   */
  updateCompatibilities(data: Compatibility[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/compatibilities/import`, data);
  }

  /**
   * Buscar partes (para futuro uso)
   */
  searchParts(searchTerm: string): Observable<Part[]> {
    // TODO: Implementar búsqueda real si se necesita
    return of([]);
  }

  /**
   * Obtener sugerencias para el autocompletado
   */
  getSuggestions(searchTerm: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/suggestions?q=${encodeURIComponent(searchTerm)}`);
  }

  /**
   * Subir imagen para una parte
   */
  uploadPartImage(partNumber: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post(
      `${this.apiUrl}/parts/${encodeURIComponent(partNumber)}/image`,
      formData
    );
  }

  /**
   * Obtener imagen privada de una parte (requiere token)
   */
  getPartImage(partNumber: string, variant: 'thumb' | 'medium' = 'medium'): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/parts/${encodeURIComponent(partNumber)}/image?variant=${variant}`,
      { responseType: 'blob' }
    );
  }

  /**
   * Obtener detalle de inventario por sede para una pieza
   */
  getInventoryDetail(partNumber: string): Observable<InventoryDetail> {
    return this.http.get<InventoryDetail>(`${this.apiUrl}/inventory/${partNumber}`);
  }

  /**
   * Exportar datos de negocio en Excel (solo admin)
   */
  exportAdminData(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.apiUrl}/admin/data/export`, {
      observe: 'response',
      responseType: 'blob'
    });
  }

  /**
   * Reiniciar datos de negocio (sin usuarios, solo admin)
   */
  resetAdminData(): Observable<AdminResetResponse> {
    return this.http.post<AdminResetResponse>(`${this.apiUrl}/admin/data/reset`, {});
  }
}

export interface InventoryLocation {
  partNumber: string;
  zona: string;
  sede: string;
  almacen: string;
  cantidad: number;
  costoUnitario: number;
}

export interface InventoryDetail {
  partNumber: string;
  totalQuantity: number;
  available: boolean;
  locations: InventoryLocation[];
  error?: string;
}

export interface AdminResetResponse {
  ok: boolean;
  message: string;
  warning?: string | null;
  deleted: {
    parts: number;
    compatibilities: number;
    images: number;
    inventory: number;
    activity_logs: number;
    deletedObjects: number;
  };
}
