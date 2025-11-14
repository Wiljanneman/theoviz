import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardType = 'character' | 'location' | 'policy';
export type DropZone = 'hand' | 'approved' | 'rejected' | 'not-related' | null;

export interface Card {
  id: number;
  title: string;
  type: CardType;
  description: string;
  zone: DropZone;
  imageUrl?: string;
}

export interface Scenario {
  title: string;
  description: string;
  council: string;
  date: string;
}

@Component({
  selector: 'app-cards-of-ecumeny',
  imports: [CommonModule],
  templateUrl: './cards-of-ecumeny.component.html',
  styleUrl: './cards-of-ecumeny.component.css'
})
export class CardsOfEcumenyComponent {
  scenario: Scenario = {
    title: 'The Council of Nicaea',
    council: 'First Ecumenical Council',
    date: '325 AD',
    description: 'Emperor Constantine has called together bishops from across the Christian world to address the Arian controversy. Arius teaches that Jesus Christ was created by God the Father and is therefore subordinate to Him. The council must decide on matters of faith, establish church unity, and determine the date of Easter celebration.'
  };

  cards: Card[] = [
    { id: 1, title: 'Arius', type: 'character', description: 'Alexandrian presbyter teaching that Christ was created', zone: 'hand' },
    { id: 2, title: 'Athanasius', type: 'character', description: 'Deacon defending the divinity of Christ', zone: 'hand' },
    { id: 3, title: 'Constantine', type: 'character', description: 'Roman Emperor who convened the council', zone: 'hand' },
    { id: 4, title: 'Nicaea', type: 'location', description: 'City in Asia Minor where the council convened', zone: 'hand' },
    { id: 5, title: 'The Nicene Creed', type: 'policy', description: 'Statement of faith declaring Christ as homoousios (same substance) with the Father', zone: 'hand' },
    { id: 6, title: 'Arianism Condemned', type: 'policy', description: 'Formal rejection of Arius\' teachings', zone: 'hand' },
    { id: 7, title: 'Easter Date Calculation', type: 'policy', description: 'Agreement on how to determine Easter\'s date', zone: 'hand' },
    { id: 8, title: 'Jerusalem', type: 'location', description: 'Holy city, not the location of this council', zone: 'hand' },
    { id: 9, title: 'Pope Sylvester I', type: 'character', description: 'Bishop of Rome, represented but not present', zone: 'hand' },
    { id: 10, title: 'Canon Law on Clergy', type: 'policy', description: 'Rules governing clergy behavior and organization', zone: 'hand' }
  ];

  draggedCard: Card | null = null;
  dragOverZone: DropZone = null;

  get handCards(): Card[] {
    return this.cards.filter(c => c.zone === 'hand');
  }

  get approvedCards(): Card[] {
    return this.cards.filter(c => c.zone === 'approved');
  }

  get rejectedCards(): Card[] {
    return this.cards.filter(c => c.zone === 'rejected');
  }

  get notRelatedCards(): Card[] {
    return this.cards.filter(c => c.zone === 'not-related');
  }

  onDragStart(event: DragEvent, card: Card): void {
    this.draggedCard = card;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target as any);
    }
  }

  onDragEnd(event: DragEvent): void {
    this.draggedCard = null;
    this.dragOverZone = null;
  }

  onDragOver(event: DragEvent, zone: DropZone): void {
    event.preventDefault();
    this.dragOverZone = zone;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragLeave(event: DragEvent): void {
    this.dragOverZone = null;
  }

  onDrop(event: DragEvent, zone: DropZone): void {
    event.preventDefault();
    if (this.draggedCard && zone) {
      this.draggedCard.zone = zone;
    }
    this.dragOverZone = null;
  }

  getCardTypeIcon(type: CardType): string {
    switch (type) {
      case 'character': return '👤';
      case 'location': return '📍';
      case 'policy': return '📜';
      default: return '';
    }
  }

  getCardTypeColor(type: CardType): string {
    switch (type) {
      case 'character': return 'border-blue-400';
      case 'location': return 'border-green-400';
      case 'policy': return 'border-purple-400';
      default: return 'border-gray-400';
    }
  }

  /**
   * Returns a rotation string for fanned card layout, e.g. '-15deg', '0deg', '15deg'.
   */
  getCardRotation(index: number, total: number): string {
    const spread = 30; // total degrees spread
    const start = -spread / 2;
    const step = total > 1 ? spread / (total - 1) : 0;
    return `${start + index * step}deg`;
  }
}
