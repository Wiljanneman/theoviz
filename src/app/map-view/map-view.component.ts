import maplibregl from 'maplibre-gl';
import { CommonModule } from '@angular/common';
import { Component, Input, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { filterByDate } from '@openhistoricalmap/maplibre-gl-dates';

export interface MapLayer {
  name: string;
  url: string;
  attribution?: string;
}

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  description?: string;
  type?: 'persecution' | 'author' | 'audience' | 'trial';
  icon?: string;
}

export interface MapArrow {
  from: [number, number]; // [lat, lng]
  to: [number, number];   // [lat, lng]
  label?: string;
  color?: string;
}

export interface MapData {
  center: [number, number];
  zoom: number;
  layers: MapLayer[];
  markers: MapMarker[];
  arrows?: MapArrow[];
}

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.css'],
  imports: [CommonModule]
})
export class MapViewComponent implements AfterViewInit, OnChanges {
  @Input() mapData!: MapData;
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  private map: maplibregl.Map | null = null;
  private markers: Array<{ marker: maplibregl.Marker; type: string; element: HTMLElement }> = [];
  private arrowLayersAdded: boolean = false;
  activeFilter: string = 'all';
  expandedFilter: string | null = null;

  private getDefaultIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      persecution: 'fas fa-skull-crossbones',
      author: 'fas fa-pen-fancy',
      audience: 'fas fa-users',
      trial: 'fas fa-fire',
      'notable-event': 'fas fa-fire'
    };
    return iconMap[type] || 'fas fa-map-pin';
  }

  toggleExpand(filterType: string, event: Event): void {
    event.stopPropagation();
    this.expandedFilter = this.expandedFilter === filterType ? null : filterType;
  }

  filterMarkers(filterType: string): void {
    this.activeFilter = filterType;
    
    this.markers.forEach(({ element, type }) => {
      if (filterType === 'all' || type === filterType) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    });

    // Show/hide arrows based on filter
    if (this.map && this.arrowLayersAdded) {
      const arrowVisibility = (filterType === 'all' || filterType === 'audience') ? 'visible' : 'none';
      this.map.setLayoutProperty('diaspora-arrows-line', 'visibility', arrowVisibility);
      this.map.setLayoutProperty('diaspora-arrows-arrows', 'visibility', arrowVisibility);
    }
  }

  ngAfterViewInit() {
    this.renderMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mapData'] && this.map) {
      this.renderMap();
    }
  }

  renderMap() {
    if (this.map) {
      this.map.remove();
    }

    const center = this.mapData?.center || [10, 45];
    const zoom = this.mapData?.zoom || 4;

    this.map = new maplibregl.Map({
      container: 'map',
      style: 'https://www.openhistoricalmap.org/map-styles/woodblock/woodblock.json',
      attributionControl: {
        customAttribution: '<a href="https://www.openhistoricalmap.org/">OpenHistoricalMap</a>',
      },
      center: [center[1], center[0]], // Longitude, Latitude
      zoom: zoom
    });

    this.map!.once('styledata', (e: any) => {
      filterByDate(this.map, '050-01-01'); // Set to ~50 AD for James's time period

      // Clear existing markers
      this.markers.forEach(m => m.marker.remove());
      this.markers = [];
      
      // Add markers if provided
      if (this.mapData?.markers) {
        this.mapData.markers.forEach(marker => {
          const markerType = marker.type || 'church';
          const iconClass = marker.icon || this.getDefaultIcon(markerType);
          
          // Create custom marker element
          const el = document.createElement('div');
          el.className = `custom-marker marker-${markerType}`;
          el.innerHTML = `<i class="${iconClass}"></i>`;
          el.setAttribute('data-type', markerType);
          
          const mapMarker = new maplibregl.Marker({ element: el })
            .setLngLat([marker.lng, marker.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, closeButton: true }).setHTML(
                `<div class="popup-header">
                  <i class="${iconClass}"></i>
                  <span>${marker.label || ''}</span>
                </div>
                <div class="popup-body">
                  ${marker.description || ''}
                </div>`
              )
            )
            .addTo(this.map!);
          
          this.markers.push({ marker: mapMarker, type: markerType, element: el });
        });
      }

      // Add arrows if provided
      if (this.mapData?.arrows) {
        this.map!.addSource('diaspora-arrows', {
          'type': 'geojson',
          'data': {
            'type': 'FeatureCollection',
            'features': this.mapData.arrows.map((arrow, index) => ({
              'type': 'Feature',
              'properties': {
                'label': arrow.label || '',
                'color': arrow.color || '#8b5cf6'
              },
              'geometry': {
                'type': 'LineString',
                'coordinates': [
                  [arrow.from[1], arrow.from[0]], // [lng, lat]
                  [arrow.to[1], arrow.to[0]]
                ]
              }
            }))
          }
        });

        this.map!.addLayer({
          'id': 'diaspora-arrows-line',
          'type': 'line',
          'source': 'diaspora-arrows',
          'layout': {
            'line-join': 'round',
            'line-cap': 'round',
            'visibility': 'none' // Hidden by default
          },
          'paint': {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2]
          }
        });

        // Add arrowheads
        this.map!.addLayer({
          'id': 'diaspora-arrows-arrows',
          'type': 'symbol',
          'source': 'diaspora-arrows',
          'layout': {
            'symbol-placement': 'line',
            'symbol-spacing': 1,
            'icon-image': 'triangle-11', // built-in mapbox icon
            'icon-size': 0.5,
            'icon-rotate': 90,
            'visibility': 'none' // Hidden by default
          },
          'paint': {
            'icon-color': ['get', 'color'],
            'icon-opacity': 0.6
          }
        });

        this.arrowLayersAdded = true;
      }
    });
  }
}

