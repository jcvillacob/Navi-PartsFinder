export interface Compatibility {
  compatiblePart: string;   // Número de parte compatible
  equipment: string;        // Equipos compatibles (puede ser lista separada por comas)
  brand: string;           // Marca del equipo original (XCMG, KOMATSU, etc)
  spareBrand: string;      // Marca del repuesto (Navitrans, etc)
  availability?: boolean;  // Disponibilidad
  quantity?: number;       // Cantidad disponible
  location?: string;       // Sede (Default: Aguacatala)
}
