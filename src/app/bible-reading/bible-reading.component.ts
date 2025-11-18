import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BibleService, BibleVerse } from '../services/bible.service';

export interface ReadingData {
  chapterTitle: string;
  introduction: string;
  focusVerses?: string;
  keyThemes?: string[];
  readingInstructions?: string;
}

@Component({
  selector: 'app-bible-reading',
  templateUrl: './bible-reading.component.html',
  styleUrls: ['./bible-reading.component.css'],
  imports: [CommonModule]
})
export class BibleReadingComponent implements OnInit {
  @Input() readingData!: ReadingData;
  @Input() verseReference!: string;
  
  bibleText: string = '';
  isLoading = false;
  loadError = false;

  constructor(private bibleService: BibleService) {}

  ngOnInit() {
    this.loadBibleText();
  }

  private loadBibleText(): void {
    if (!this.verseReference) {
      return;
    }

    this.isLoading = true;
    this.loadError = false;

    this.bibleService.getVerses(this.verseReference).subscribe({
      next: (bibleVerse) => {
        this.isLoading = false;
        if (bibleVerse) {
          this.bibleText = this.formatChapterText(bibleVerse);
        } else {
          this.loadError = true;
        }
      },
      error: (error) => {
        console.error('Failed to load Bible text:', error);
        this.isLoading = false;
        this.loadError = true;
      }
    });
  }

  private formatChapterText(bibleVerse: BibleVerse): string {
    if (!bibleVerse.verses) {
      return bibleVerse.text || '';
    }

    return bibleVerse.verses
      .map(verse => `<sup class="verse-number">${verse.verse}</sup>${verse.text}`)
      .join(' ');
  }

  retryLoad(): void {
    this.loadBibleText();
  }
}