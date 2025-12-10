import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { Part } from '../models/part.model';
import { Compatibility } from '../models/compatibility.model';

@Injectable({
  providedIn: 'root',
})
export class PartsService {
  private apiUrl = 'http://localhost:3000/api';
  private baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  /**
   * Obtener información de una parte por su número
   */
  getPartByNumber(partNumber: string): Observable<Part> {
    return this.http.get<Part>(`${this.apiUrl}/parts/${partNumber}`).pipe(
      map(part => ({
        ...part,
        imageUrl: part.imageUrl ? `${this.baseUrl}${part.imageUrl}` : undefined
      }))
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
    return this.http.post(`${this.apiUrl}/parts/${partNumber}/image`, formData);
  }

  /**
   * Obtener detalle de inventario por sede para una pieza
   */
  getInventoryDetail(partNumber: string): Observable<InventoryDetail> {
    return this.http.get<InventoryDetail>(`${this.apiUrl}/inventory/${partNumber}`);
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
