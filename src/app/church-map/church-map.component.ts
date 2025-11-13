import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { HttpClient } from '@angular/common/http';
import JSZip from 'jszip';

@Component({
  selector: 'app-church-map',
  imports: [CommonModule],
  templateUrl: './church-map.component.html',
  styleUrl: './church-map.component.css'
})
export class ChurchMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @Output() statsUpdated = new EventEmitter<{ total: number; denominations: { [key: number]: number } }>();
  
  private map: L.Map | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private allMarkers: L.Marker[] = [];
  private markerClusterGroup: L.MarkerClusterGroup | undefined;
  
  selectedDenominations: Set<number> = new Set([1, 2, 3, 4, 5, 6]); // Exclude 7 (Orthodox) and 8 (Catholic)
  denomCounts: { [key: number]: number } = {};
  legendVisible: boolean = true;

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

  private async loadChurchData(): Promise<void> {
    if (!this.map) return;

    const CACHE_KEY = 'theoviz_kml_cache';
    
    try {
      // Check localStorage first
      const cachedKml = localStorage.getItem(CACHE_KEY);
      
      let kmlContent = '';
      
      if (cachedKml) {
        console.log('Using cached KML data from localStorage');
        kmlContent = cachedKml;
      } else {
        console.log('No cache found, fetching KMZ from server...');
        
        // Fetch the KMZ data (compressed KML)
        const kmzUrl = 'https://www.google.com/maps/d/kml?mid=1PNd_sJagci84PyKmGC6M5VJtaLMEWxg';
        const response = await fetch(kmzUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        console.log('KMZ Data fetched, size:', arrayBuffer.byteLength, 'bytes');
        
        // Decompress the KMZ file using JSZip
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // KMZ files typically contain a doc.kml file
        const kmlFile = zip.file('doc.kml');
        
        if (kmlFile) {
          kmlContent = await kmlFile.async('text');
          console.log('KML content extracted from KMZ');
        } else {
          // If doc.kml doesn't exist, find the first .kml file
          const kmlFiles = Object.keys(zip.files).filter(name => name.endsWith('.kml'));
          if (kmlFiles.length > 0) {
            const firstKml = zip.file(kmlFiles[0]);
            if (firstKml) {
              kmlContent = await firstKml.async('text');
              console.log('KML content extracted from:', kmlFiles[0]);
            }
          }
        }
        
        if (kmlContent) {
          // Save to localStorage for future use
          localStorage.setItem(CACHE_KEY, kmlContent);
          console.log('KML cached to localStorage, length:', kmlContent.length);
          
        } else {
          console.warn('No KML file found in KMZ');
        }
      }
      
      if (kmlContent) {
        console.log('Successfully loaded KML, parsing...');
        this.parseAndDisplayKML(kmlContent);
      } else {
        console.warn('No KML content available, using sample data');
        this.addSampleChurches();
      }
      
    } catch (error) {
      console.error('Error fetching/processing KMZ data:', error);
      // Fallback to sample data if fetch fails
      this.addSampleChurches();
    }
  }

  private parseAndDisplayKML(kmlContent: string): void {
    if (!this.map) return;

    try {
      // Parse the KML XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');
      
      // Get all Placemark elements
      const placemarks = xmlDoc.getElementsByTagName('Placemark');
      console.log(`Found ${placemarks.length} placemarks in KML`);
      
      const churches: Array<{
        name: string;
        lat: number;
        lng: number;
        description?: string;
        iconNumber?: number;
      }> = [];
      
      // Extract data from each placemark
      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        
        // Get name
        const nameElement = placemark.getElementsByTagName('name')[0];
        const name = nameElement?.textContent || 'Unnamed Location';
        
        // Get description (optional)
        const descElement = placemark.getElementsByTagName('description')[0];
        const description = descElement?.textContent || '';
        
        // Get styleUrl to determine icon
        const styleElement = placemark.getElementsByTagName('styleUrl')[0];
        const styleUrl = styleElement?.textContent || '';
        
        // Extract icon number from styleUrl (e.g., "#icon-ci-2" -> 2)
        let iconNumber: number | undefined;
        const match = styleUrl.match(/#icon-ci-(\d+)/);
        if (match) {
          iconNumber = parseInt(match[1]);
        }
        
        // Log ALL placemarks to verify mapping
        console.log('Placemark:', { name, styleUrl, iconNumber });
        
        // Get coordinates
        const coordsElement = placemark.getElementsByTagName('coordinates')[0];
        if (coordsElement && coordsElement.textContent) {
          // KML coordinates are in format: longitude,latitude,altitude
          const coords = coordsElement.textContent.trim().split(',');
          if (coords.length >= 2) {
            const lng = parseFloat(coords[0]);
            const lat = parseFloat(coords[1]);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              churches.push({ name, lat, lng, description, iconNumber });
            }
          }
        }
      }
      
      console.log(`Parsed ${churches.length} valid church locations`);
      
      if (churches.length > 0) {
        // Calculate denomination counts
        const denomCounts: { [key: number]: number } = {};
        churches.forEach(church => {
          if (church.iconNumber !== undefined) {
            denomCounts[church.iconNumber] = (denomCounts[church.iconNumber] || 0) + 1;
          }
        });
        
        this.denomCounts = denomCounts;
        
        // Emit stats to parent component
        this.statsUpdated.emit({
          total: churches.length,
          denominations: denomCounts
        });
        
        // Store churches and display them
        this.displayChurches(churches);
        
        // Center map on all churches
        const bounds = L.latLngBounds(churches.map(c => [c.lat, c.lng]));
        this.map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        console.warn('No valid churches found, using sample data');
        this.addSampleChurches();
      }
      
    } catch (error) {
      console.error('Error parsing KML:', error);
      this.addSampleChurches();
    }
  }

  toggleDenomination(denomNumber: number): void {
    if (this.selectedDenominations.has(denomNumber)) {
      this.selectedDenominations.delete(denomNumber);
    } else {
      this.selectedDenominations.add(denomNumber);
    }
    this.filterMarkers();
  }

  toggleLegend(): void {
    this.legendVisible = !this.legendVisible;
  }

  private filterMarkers(): void {
    if (!this.map || !this.markerClusterGroup) return;

    // Clear the cluster group
    this.markerClusterGroup.clearLayers();

    // Add back only the selected markers
    this.allMarkers.forEach(marker => {
      const iconNumber = (marker as any)._iconNumber;
      if (!iconNumber || this.selectedDenominations.has(iconNumber)) {
        this.markerClusterGroup!.addLayer(marker);
      }
    });
  }

  private displayChurches(churches: Array<{ name: string; lat: number; lng: number; description?: string; iconNumber?: number }>): void {
    if (!this.map) return;

    // Create a marker cluster group
    this.markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 80,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count > 10) size = 'medium';
        if (count > 50) size = 'large';
        
        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}">${count}</div>`,
          className: 'marker-cluster',
          iconSize: L.point(40, 40)
        });
      }
    });

    // Store all markers
    this.allMarkers = [];

    // Add markers to array
    churches.forEach(church => {
      // Determine which icon to use
      let markerIcon;
      
      if (church.iconNumber !== undefined && church.iconNumber >= 1 && church.iconNumber <= 8) {
        // Use custom icon from public folder
        markerIcon = L.icon({
          iconUrl: `./icon-${church.iconNumber}.png`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
      } else {
        // Fallback to default church icon
        markerIcon = L.divIcon({
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
      }
      
      const marker = L.marker([church.lat, church.lng], { icon: markerIcon });
      
      // Store the icon number on the marker for filtering
      (marker as any)._iconNumber = church.iconNumber;

      // Create popup content
      const popupContent = `
        <div class="church-popup">
          <h3 class="font-semibold text-slate-800 mb-2">${church.name}</h3>
          ${church.description ? `<p class="text-sm text-slate-600 leading-relaxed mb-2">${church.description}</p>` : ''}
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

      this.allMarkers.push(marker);
      this.markerClusterGroup!.addLayer(marker);
    });

    // Add the cluster group to the map
    this.map.addLayer(this.markerClusterGroup);
  }

  private addSampleChurches(): void {
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

  private downloadKML(kmlContent: string): void {
    // Create a blob from the KML content
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'churches.kml';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log('KML file download triggered');
  }
}
