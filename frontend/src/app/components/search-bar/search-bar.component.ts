import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { PartsService } from '../../services/parts.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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

  searchTerm: string = 'NAV81N6-26601';
  suggestions: Suggestion[] = [];
  showSuggestions: boolean = false;
  selectedIndex: number = -1;

  private searchSubject = new Subject<string>();
  private subscriptions = new Subscription();

  @Output() search = new EventEmitter<string>();

  constructor(private partsService: PartsService) {
    // Configurar debounce para las sugerencias
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(term => this.loadSuggestions(term))
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

  private loadSuggestions(term: string): void {
    this.partsService.getSuggestions(term).subscribe({
      next: (data) => {
        this.suggestions = data;
        this.showSuggestions = this.suggestions.length > 0;
        this.selectedIndex = -1;
      },
      error: (err) => {
        console.error('Error loading suggestions:', err);
        this.suggestions = [];
        this.showSuggestions = false;
      }
    });
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
      case 'part': return 'bg-indigo-500/20 text-indigo-300';
      case 'compatible': return 'bg-green-500/20 text-green-300';
      case 'equipment': return 'bg-amber-500/20 text-amber-300';
      default: return 'bg-slate-500/20 text-slate-300';
    }
  }
}
