import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MapData } from '../map-view/map-view.component';
import { ClusterData } from '../cluster-view/cluster-view.component';

import { MapViewComponent } from '../map-view/map-view.component';
import { ClusterViewComponent } from '../cluster-view/cluster-view.component';
import { BibleReadingComponent, ReadingData } from '../bible-reading/bible-reading.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-interactive-study',
  templateUrl: './interactive-study.component.html',
  styleUrls: ['./interactive-study.component.css'],
  imports: [MapViewComponent, ClusterViewComponent, BibleReadingComponent, CommonModule]
})
export class InteractiveStudyComponent implements OnInit {
  steps: any[] = [];
  currentStepIndex = 0;
  mapData: MapData | null = null;
  clusterData: ClusterData | null = null;
  readingData: ReadingData | null = null;
  verseReference: string = '';
  isMobileMenuOpen = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any[]>('./stepper-content.json').subscribe(data => {
      this.steps = data;
      this.setStep(0);
    });
  }

  setStep(index: number) {
    this.currentStepIndex = index;
    const step = this.steps[index];
    
    // Close mobile menu when step is selected
    this.isMobileMenuOpen = false;
    
    // Reset data
    this.mapData = null;
    this.clusterData = null;
    this.readingData = null;
    this.verseReference = '';
    
    if (step) {
      if (step.type === 'bible-reading' && step.readingData) {
        this.readingData = step.readingData;
        this.verseReference = step.verseReference || '';
      } else if (step.type === 'map' && step.mapData) {
        this.mapData = step.mapData;
      } else if (step.type === 'cluster' && step.clusterData) {
        this.clusterData = step.clusterData;
      }
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
}
