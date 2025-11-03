import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChurchMapComponent } from './church-map.component';

describe('ChurchMapComponent', () => {
  let component: ChurchMapComponent;
  let fixture: ComponentFixture<ChurchMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChurchMapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChurchMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
