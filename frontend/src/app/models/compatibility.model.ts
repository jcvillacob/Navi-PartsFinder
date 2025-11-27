export interface Compatibility {
  partNumber?: string;      // Número de la parte principal
  description?: string;     // Descripción de la parte
  compatiblePart: string;   // Número de parte compatible
  equipment: string;        // Equipos compatibles (puede ser lista separada por comas)
  brand: string;           // Marca del equipo original (XCMG, KOMATSU, etc)
  spareBrand: string;      // Marca del repuesto (Navitrans, etc)
  availability?: boolean;  // Disponibilidad
  quantity?: number;       // Cantidad disponible
  location?: string;       // Sede (Default: Aguacatala)
}
