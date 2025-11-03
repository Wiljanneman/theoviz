import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-church-map',
  imports: [],
  templateUrl: './church-map.component.html',
  styleUrl: './church-map.component.css'
})
export class ChurchMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  
  private map: L.Map | undefined;
  private resizeObserver: ResizeObserver | undefined;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadChurchData();
    this.setupResizeObserver();
    
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private initializeMap(): void {
    // Initialize the map centered on the coordinates from your Google Maps link
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [44.03226794579251, -92.75978994999998],
      zoom: 10,
      zoomControl: true,
      attributionControl: false
    });

    // Add reliable tile layer with dark styling via CSS
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);
  }

  private loadChurchData(): void {
    if (!this.map) return;

    // Sample church data - you can replace this with actual KML parsing
    const churches = [
      {
        name: "Grace Reformed Church",
        lat: 44.03226794579251,
        lng: -92.75978994999998,
        denomination: "Reformed",
        description: "A faithful congregation committed to biblical truth and reformed theology."
      },
      {
        name: "Bethany Baptist Church", 
        lat: 44.025,
        lng: -92.765,
        denomination: "Baptist",
        description: "Sound biblical preaching and traditional Baptist values."
      },
      {
        name: "Trinity Presbyterian",
        lat: 44.038,
        lng: -92.745,
        denomination: "Presbyterian",
        description: "Presbyterian Church in America congregation with solid doctrine."
      },
      {
        name: "Christ Lutheran Church",
        lat: 44.028,
        lng: -92.770,
        denomination: "Lutheran",
        description: "Missouri Synod Lutheran church holding to biblical inerrancy."
      },
      {
        name: "St. Paul's Anglican",
        lat: 44.035,
        lng: -92.760,
        denomination: "Anglican",
        description: "Traditional Anglican worship with orthodox theology."
      }
    ];

    // Custom icon for churches
    const churchIcon = L.divIcon({
      html: `
        <div class="church-marker">
          <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18,15H16V12H18M6,15H8V12H6M20,19H4V8L12,3L20,8V19Z" />
          </svg>
        </div>
      `,
      className: 'church-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Add markers for each church
    churches.forEach(church => {
      const marker = L.marker([church.lat, church.lng], { icon: churchIcon })
        .addTo(this.map!);

      // Create popup content
      const popupContent = `
        <div class="church-popup">
          <h3 class="font-semibold text-slate-800 mb-2">${church.name}</h3>
          <p class="text-sm text-violet-600 font-medium mb-2">${church.denomination}</p>
          <p class="text-sm text-slate-600 leading-relaxed">${church.description}</p>
          <div class="mt-3 flex gap-2">
            <button class="px-3 py-1 bg-fuchsia-500 text-white text-xs rounded-md hover:bg-fuchsia-600 transition-colors">
              Visit Website
            </button>
            <button class="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded-md hover:bg-slate-300 transition-colors">
              Get Directions
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'custom-popup'
      });
    });
  }

  private setupResizeObserver(): void {
    if (!this.map) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });

    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }
}
