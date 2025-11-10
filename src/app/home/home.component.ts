import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChurchMapComponent } from '../church-map/church-map.component';
import { TreePreviewComponent } from '../tree-preview/tree-preview.component';
import { DenominationWheelPreviewComponent } from '../denomination-wheel-preview/denomination-wheel-preview.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ChurchMapComponent, TreePreviewComponent, DenominationWheelPreviewComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  totalChurches = 0;
  denomCounts: { [key: number]: number } = {};

  onStatsUpdated(stats: { total: number; denominations: { [key: number]: number } }): void {
    this.totalChurches = stats.total;
    this.denomCounts = stats.denominations;
    console.log('Stats updated:', stats);
  }

  getDenomCount(iconNumber: number): number {
    return this.denomCounts[iconNumber] || 0;
  }
}
