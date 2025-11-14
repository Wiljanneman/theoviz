import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DenominationQuizComponent } from './denomination-quiz/denomination-quiz.component';
import { DenominationWheelComponent } from './denomination-wheel/denomination-wheel.component';
import { TreeEditorComponent } from './tree-editor/tree-editor.component';
import { CardsOfEcumenyComponent } from './cards-of-ecumeny/cards-of-ecumeny.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'denomination-quiz', component: DenominationQuizComponent },
  { path: 'denomination-wheel', component: DenominationWheelComponent },
  { path: 'tree-editor', component: TreeEditorComponent },
  { path: 'cards-of-ecumeny', component: CardsOfEcumenyComponent },
  { path: '**', redirectTo: '/' }
];
