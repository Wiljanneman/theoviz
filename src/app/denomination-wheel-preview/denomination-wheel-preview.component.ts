import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

interface HierarchyNode {
  name: string;
  color?: string;
  children?: HierarchyNode[];
  value?: number;
}

@Component({
  selector: 'app-denomination-wheel-preview',
  standalone: true,
  imports: [],
  template: '<div #wheelContainer class="w-full h-full"></div>',
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class DenominationWheelPreviewComponent implements OnInit, AfterViewInit {
  @ViewChild('wheelContainer', { static: true }) wheelContainer!: ElementRef;

  private svg: any;
  private width = 400;
  private height = 300;

  // Simplified hierarchical data - same structure as main component but condensed
  private hierarchyData: HierarchyNode = {
    name: 'Christianity',
    children: [
      {
        name: 'Core',
        children: [
          { 
            name: 'Protestant', 
            color: '#60A5FA',
            children: [
              { 
                name: 'SOLA',
                color: '#93C5FD',
                children: [
                  { name: 'Lutheran', color: '#3B82F6', value: 1 },
                  { name: 'Reformed', color: '#EF4444', value: 1 },
                  { name: 'Anglican', color: '#EC4899', value: 1 },
                  { name: 'Baptist', color: '#92400E', value: 1 },
                  { name: 'Methodist', color: '#10B981', value: 1 },
                  { name: 'Pentecostal', color: '#A855F7', value: 1 }
                ]
              }
            ]
          },
          { 
            name: 'Catholic', 
            color: '#FBBF24',
            children: [
              { name: 'Papacy', color: '#FCD34D', value: 1 }
            ]
          },
          { 
            name: 'E. Orthodox', 
            color: '#FB923C',
            children: [
              { name: 'Theosis', color: '#FDBA74', value: 1 }
            ]
          },
          { 
            name: 'O. Orthodox', 
            color: '#84CC16',
            children: [
              { name: 'Miaphysite', color: '#BEF264', value: 1 }
            ]
          }
        ]
      }
    ]
  };

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.createWheel();
  }

  private createWheel(): void {
    const container = this.wheelContainer.nativeElement;
    
    d3.select(container).select('svg').remove();

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = 120;
    
    const g = this.svg.append('g')
      .attr('transform', `translate(${centerX},${centerY})`);

    // Create hierarchy
    const root = d3.hierarchy(this.hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create partition layout
    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, radius]);

    partition(root);

    // Arc generator
    const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // Create the arcs
    g.selectAll('path')
      .data(root.descendants().filter(d => d.depth >= 1))
      .enter()
      .append('path')
      .attr('fill', (d: any) => {
        if (d.depth === 1) return '#1e293b';
        return d.data.color || d.parent?.data.color || '#1e293b';
      })
      .attr('opacity', (d: any) => {
        if (d.depth === 1) return 1;
        if (d.depth === 2) return 0.95;
        if (d.depth === 3) return 0.9;
        if (d.depth === 4) return 0.9;
        return 1;
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))')
      .attr('d', arc as any);

    // Center circle
    const firstChild = root.children![0] as d3.HierarchyRectangularNode<HierarchyNode>;
    g.append('circle')
      .attr('r', firstChild.y0)
      .attr('fill', 'transparent')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.5)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))');

    // Golden cross in center
    const crossSize = 12;
    const crossWidth = 2.5;
    
    g.append('rect')
      .attr('x', -crossWidth / 2)
      .attr('y', -crossSize / 2)
      .attr('width', crossWidth)
      .attr('height', crossSize)
      .attr('fill', '#FBBF24')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 0.5)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))');

    g.append('rect')
      .attr('x', -crossSize / 2)
      .attr('y', -crossWidth / 2 - 2.5)
      .attr('width', crossSize)
      .attr('height', crossWidth)
      .attr('fill', '#FBBF24')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 0.5)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))');
  }
}
