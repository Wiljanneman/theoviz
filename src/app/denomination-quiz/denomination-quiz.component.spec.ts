import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DenominationQuizComponent } from './denomination-quiz.component';

describe('DenominationQuizComponent', () => {
  let component: DenominationQuizComponent;
  let fixture: ComponentFixture<DenominationQuizComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DenominationQuizComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DenominationQuizComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
