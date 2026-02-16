import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface Suggestion {
  value: string;
  type: 'part' | 'compatible' | 'equipment';
  label: string;
}

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent implements OnDestroy {
  readonly Search = Search;

  searchTerm: string = '';
  suggestions: Suggestion[] = [];
  showSuggestions: boolean = false;
  selectedIndex: number = -1;

  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  @Output() search = new EventEmitter<string>();

  constructor(private partsService: PartsService) {
    // Configurar debounce para las sugerencias con switchMap para cancelar peticiones anteriores
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.partsService.getSuggestions(term).pipe(
          catchError(err => {
            console.error('Error loading suggestions:', err);
            return of([]);
          })
        ))
      ).subscribe(data => {
        this.suggestions = data;
        this.showSuggestions = this.suggestions.length > 0;
        this.selectedIndex = -1;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onInputChange(): void {
    const term = this.searchTerm.trim();

    if (term.length >= 3) {
      this.searchSubject.next(term);
    } else {
      this.suggestions = [];
      this.showSuggestions = false;
      this.selectedIndex = -1;
    }
  }

  onSearch(): void {
    this.search.emit(this.searchTerm);
    this.hideSuggestions();
  }

  selectSuggestion(suggestion: Suggestion): void {
    this.searchTerm = suggestion.value;
    this.onSearch();
  }

  hideSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      this.selectedIndex = -1;
    }, 200);
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
        this.selectSuggestion(this.suggestions[this.selectedIndex]);
      } else {
        this.onSearch();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.selectedIndex < this.suggestions.length - 1) {
        this.selectedIndex++;
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
      }
    } else if (event.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  getSuggestionTypeLabel(type: string): string {
    switch(type) {
      case 'part': return 'Parte';
      case 'compatible': return 'Compatible';
      case 'equipment': return 'Equipo';
      default: return '';
    }
  }

  getSuggestionTypeClass(type: string): string {
    switch(type) {
      case 'part': return 'suggestion-badge suggestion-badge--part';
      case 'compatible': return 'suggestion-badge suggestion-badge--compatible';
      case 'equipment': return 'suggestion-badge suggestion-badge--equipment';
      default: return 'suggestion-badge suggestion-badge--default';
    }
  }
}
