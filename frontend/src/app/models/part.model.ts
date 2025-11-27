export interface Part {
  partNumber: string;      // Número de parte principal
  description: string;     // Descripción del repuesto
  brand: string;          // Marca del repuesto (ej: Navitrans)
  category: string;       // Categoría (ej: Tren de Rodaje)
  weight?: string;        // Peso (opcional)
  stock?: number;         // Stock disponible (opcional)
  imageUrl?: string;      // URL de imagen principal (opcional)
  thumbnails?: string[];  // Miniaturas adicionales (opcional)
}
