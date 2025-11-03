import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChurchMapComponent } from '../church-map/church-map.component';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ChurchMapComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
