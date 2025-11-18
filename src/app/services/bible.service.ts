import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface BibleVerse {
  reference: string;
  verses: Array<{
    book_id: string;
    book_name: string;
    chapter: number;
    verse: number;
    text: string;
  }>;
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

export interface VerseRange {
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter?: number;
  endVerse?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BibleService {
  private readonly API_BASE_URL = 'https://bible-api.com';
  private cache = new Map<string, BibleVerse>();
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch verses by reference (e.g., "james 1:2-4", "james 1:5-8")
   */
  getVerses(reference: string): Observable<BibleVerse | null> {
    const cacheKey = reference.toLowerCase().trim();
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey)!);
    }

    this.loadingSubject.next(true);
    
    // Format reference for API (replace spaces with %20)
    const formattedReference = encodeURIComponent(reference);
    
    return this.http.get<BibleVerse>(`${this.API_BASE_URL}/${formattedReference}`).pipe(
      tap(result => {
        // Cache the result
        this.cache.set(cacheKey, result);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        console.error(`Error fetching Bible verse: ${reference}`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  /**
   * Get multiple verse ranges at once
   */
  getMultipleVerses(references: string[]): Observable<{ [key: string]: BibleVerse | null }> {
    const results: { [key: string]: BibleVerse | null } = {};
    
    // Create observables for each reference
    const requests = references.map(ref => 
      this.getVerses(ref).pipe(
        map(verse => ({ reference: ref, verse }))
      )
    );

    // Combine all requests
    return new Observable(observer => {
      let completed = 0;
      
      requests.forEach(request => {
        request.subscribe(result => {
          results[result.reference] = result.verse;
          completed++;
          
          if (completed === references.length) {
            observer.next(results);
            observer.complete();
          }
        });
      });
    });
  }

  /**
   * Parse a verse reference string into components
   */
  parseVerseReference(reference: string): VerseRange | null {
    // Handle formats like "v. 2-4", "James 1:2-4", "1:5-8"
    const cleanRef = reference.replace(/^v\.?\s*/, '').trim();
    
    // Match patterns like "1:2-4" or "James 1:2-4"
    const match = cleanRef.match(/(?:(\w+)\s+)?(\d+):(\d+)(?:-(\d+))?/);
    
    if (match) {
      const [, book, chapter, startVerse, endVerse] = match;
      return {
        book: book || 'james', // Default to James
        startChapter: parseInt(chapter),
        startVerse: parseInt(startVerse),
        endVerse: endVerse ? parseInt(endVerse) : undefined
      };
    }
    
    return null;
  }

  /**
   * Format a verse range for API call
   */
  formatForAPI(verseRange: VerseRange): string {
    const { book, startChapter, startVerse, endVerse } = verseRange;
    
    if (endVerse) {
      return `${book} ${startChapter}:${startVerse}-${endVerse}`;
    } else {
      return `${book} ${startChapter}:${startVerse}`;
    }
  }

  /**
   * Get formatted verse text with verse numbers
   */
  getFormattedVerseText(bibleVerse: BibleVerse): string {
    if (!bibleVerse || !bibleVerse.verses) {
      return '';
    }

    return bibleVerse.verses.map(verse => 
      `<sup>${verse.verse}</sup>${verse.text}`
    ).join(' ');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Pre-load common verses for James 1:2-18
   */
  preloadJamesVerses(): void {
    const jamesReferences = [
      'james 1:2-4',
      'james 1:5-8', 
      'james 1:9-11',
      'james 1:12-15',
      'james 1:16-18'
    ];

    this.getMultipleVerses(jamesReferences).subscribe(results => {
      console.log('Pre-loaded James verses:', Object.keys(results).length);
    });
  }
}