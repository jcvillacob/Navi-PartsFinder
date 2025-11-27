import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject, tap } from 'rxjs';
import { Part } from '../models/part.model';
import { Compatibility } from '../models/compatibility.model';

@Injectable({
  providedIn: 'root'
})
export class PartsService {
  private apiUrl = 'http://localhost:3000/api';

  private compatibilitiesSubject = new BehaviorSubject<Compatibility[]>([]);
  public compatibilities$ = this.compatibilitiesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadCompatibilities();
  }

  private loadCompatibilities(searchTerm?: string) {
    const url = searchTerm 
      ? `${this.apiUrl}/compatibilities?q=${encodeURIComponent(searchTerm)}`
      : `${this.apiUrl}/compatibilities`;
      
    this.http.get<Compatibility[]>(url).subscribe({
      next: (data) => this.compatibilitiesSubject.next(data),
      error: (err) => console.error('Error loading compatibilities', err)
    });
  }

  /**
   * Obtener información de una parte por su número
   */
  getPartByNumber(partNumber: string): Observable<Part> {
    return this.http.get<Part>(`${this.apiUrl}/parts/${partNumber}`);
  }

  /**
   * Obtener lista de compatibilidades para una parte (con búsqueda)
   */
  getCompatibilities(searchTerm: string): Observable<Compatibility[]> {
    this.loadCompatibilities(searchTerm);
    return this.compatibilities$;
  }

  /**
   * Actualizar la lista de compatibilidades (importación Excel)
   */
  updateCompatibilities(data: Compatibility[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/compatibilities/import`, data).pipe(
      tap(() => this.loadCompatibilities())
    );
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
}
