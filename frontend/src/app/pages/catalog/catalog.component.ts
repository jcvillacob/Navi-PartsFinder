import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { PartInfoComponent } from '../../components/part-info/part-info.component';
import { CompatibilityTableComponent } from '../../components/compatibility-table/compatibility-table.component';
import { PartPreviewComponent } from '../../components/part-preview/part-preview.component';
import { PartsService } from '../../services/parts.service';
import { Part } from '../../models/part.model';
import { Compatibility } from '../../models/compatibility.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SearchBarComponent,
    PartInfoComponent,
    CompatibilityTableComponent,
    PartPreviewComponent
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss'
})
export class CatalogComponent implements OnInit {
  currentPart?: Part;
  compatibilities: Compatibility[] = [];
  isLoading: boolean = false;

  constructor(private partsService: PartsService) {}

  ngOnInit(): void {
    // Cargar datos iniciales
    this.loadPartData('NAV81N6-26601');
  }

  onSearch(searchTerm: string): void {
    console.log('Buscando:', searchTerm);
    this.loadPartData(searchTerm);
  }

  private loadPartData(partNumber: string): void {
    this.isLoading = true;

    // Obtener información de la parte
    this.partsService.getPartByNumber(partNumber).subscribe({
      next: (part) => {
        this.currentPart = part;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando parte:', error);
        this.isLoading = false;
      }
    });

    // Obtener compatibilidades
    this.partsService.getCompatibilities(partNumber).subscribe({
      next: (compatibilities) => {
        this.compatibilities = compatibilities;
      },
      error: (error) => {
        console.error('Error cargando compatibilidades:', error);
      }
    });
  }
}
