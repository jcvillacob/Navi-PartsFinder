import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { Part } from '../models/part.model';
import { Compatibility } from '../models/compatibility.model';

@Injectable({
  providedIn: 'root'
})
export class PartsService {

  // Datos mockeados de la parte
  private mockPartData: Part = {
    partNumber: 'NAV81N6-26601',
    description: 'CADENA (SIN ZAPATAS)',
    brand: 'Navitrans',
    category: 'Tren de Rodaje',
    weight: '250kg',
    stock: 12,
    imageUrl: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=1000&auto=format&fit=crop',
    thumbnails: [
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=150&auto=format&fit=crop',
      'https://plus.unsplash.com/premium_photo-1664303847960-586318f59035?q=80&w=150&auto=format&fit=crop'
    ]
  };

  // Datos mockeados de compatibilidades iniciales
  private initialCompatibilityList: Compatibility[] = [
    { compatiblePart: '860340638', equipment: 'XE225ULC', brand: 'XCMG', spareBrand: 'Navitrans' },
    { compatiblePart: '414101377', equipment: 'XE225ULC', brand: 'XCMG', spareBrand: 'Navitrans' },
    { compatiblePart: '20Y-30-00023', equipment: 'PC200-6, PC200-7, PC200-8', brand: 'KOMATSU', spareBrand: 'Navitrans' },
    { compatiblePart: 'K1011228', equipment: 'SOLARLC-IV, DX225LCA', brand: 'DOOSAN', spareBrand: 'Navitrans' },
    { compatiblePart: 'K1038366', equipment: 'SOLARLC-IV, DX225LCA', brand: 'DOOSAN', spareBrand: 'Navitrans' },
    { compatiblePart: '9250500', equipment: '920E, 922LC, 922D, 922F', brand: 'LIUGONG', spareBrand: 'Navitrans' },
    { compatiblePart: '81EM-20010', equipment: 'R220-9S, HX220S, HX210AL', brand: 'HYUNDAI', spareBrand: 'Navitrans' },
    { compatiblePart: '81N6-26600', equipment: 'R220-9S, HX220S, HX210AL', brand: 'HYUNDAI', spareBrand: 'Navitrans' }
  ];

  private compatibilitiesSubject = new BehaviorSubject<Compatibility[]>(this.initialCompatibilityList);
  public compatibilities$ = this.compatibilitiesSubject.asObservable();

  constructor() { }

  /**
   * Obtener información de una parte por su número
   * Por ahora retorna siempre los mismos datos mock
   */
  getPartByNumber(partNumber: string): Observable<Part> {
    // TODO: En el futuro esto haría una llamada HTTP real
    return of(this.mockPartData);
  }

  /**
   * Obtener lista de compatibilidades para una parte
   */
  getCompatibilities(partNumber: string): Observable<Compatibility[]> {
    return this.compatibilities$;
  }

  /**
   * Actualizar la lista de compatibilidades (ej. desde importación Excel)
   */
  updateCompatibilities(data: Compatibility[]) {
    this.compatibilitiesSubject.next(data);
  }

  /**
   * Buscar partes (para futuro uso)
   */
  searchParts(searchTerm: string): Observable<Part[]> {
    // TODO: Implementar búsqueda real
    return of([this.mockPartData]);
  }
}
