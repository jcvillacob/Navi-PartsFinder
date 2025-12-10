import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { HeaderComponent } from '../../components/header/header.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { PartInfoComponent } from '../../components/part-info/part-info.component';
import { CompatibilityTableComponent } from '../../components/compatibility-table/compatibility-table.component';
import { PartPreviewComponent } from '../../components/part-preview/part-preview.component';
import { DetailModalComponent } from '../../components/detail-modal/detail-modal.component';
import { PartsService, InventoryDetail } from '../../services/parts.service';
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
    PartPreviewComponent,
    DetailModalComponent
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss'
})
export class CatalogComponent implements OnInit {
  currentPart?: Part;
  compatibilities: Compatibility[] = [];
  isLoading: boolean = false;

  // Modal de disponibilidad
  isModalOpen: boolean = false;
  isModalLoading: boolean = false;
  inventoryDetail?: InventoryDetail;

  constructor(private partsService: PartsService) {}

  ngOnInit(): void {
    // No cargar datos iniciales, esperar a que el usuario busque
  }

  onSearch(searchTerm: string): void {
    console.log('Buscando:', searchTerm);
    this.loadPartData(searchTerm);
  }

  onCheckAvailability(partNumber: string): void {
    this.isModalOpen = true;
    this.isModalLoading = true;
    this.inventoryDetail = undefined;

    this.partsService.getInventoryDetail(partNumber).subscribe({
      next: (detail) => {
        this.inventoryDetail = detail;
        this.isModalLoading = false;
      },
      error: (error) => {
        console.error('Error consultando inventario:', error);
        this.inventoryDetail = {
          partNumber,
          totalQuantity: 0,
          available: false,
          locations: [],
          error: 'Error al consultar inventario'
        };
        this.isModalLoading = false;
      }
    });
  }

  onCloseModal(): void {
    this.isModalOpen = false;
    this.inventoryDetail = undefined;
  }

  private loadPartData(partNumber: string): void {
    this.isLoading = true;
    this.currentPart = undefined;
    this.compatibilities = [];

    // Ejecutar ambas consultas en paralelo y esperar a que terminen
    forkJoin({
      part: this.partsService.getPartByNumber(partNumber),
      compatibilities: this.partsService.getCompatibilities(partNumber)
    }).subscribe({
      next: ({ part, compatibilities }) => {
        this.currentPart = part;
        this.compatibilities = compatibilities;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error cargando datos:', error);
        this.isLoading = false;
      }
    });
  }
}
