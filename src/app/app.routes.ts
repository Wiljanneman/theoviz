import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DenominationQuizComponent } from './denomination-quiz/denomination-quiz.component';
import { DenominationWheelComponent } from './denomination-wheel/denomination-wheel.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'denomination-quiz', component: DenominationQuizComponent },
  { path: 'denomination-wheel', component: DenominationWheelComponent },
  { path: '**', redirectTo: '/' }
];
