import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import * as d3 from 'd3';

interface HierarchyNode {
  name: string;
  color?: string;
  children?: HierarchyNode[];
  value?: number;
}

@Component({
  selector: 'app-denomination-wheel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './denomination-wheel.component.html',
  styleUrl: './denomination-wheel.component.css'
})
export class DenominationWheelComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('wheelContainer', { static: true }) wheelContainer!: ElementRef;

  private svg: any;
  private width = 800;
  private height = 800;
  private radius = 350;
  private resizeObserver: ResizeObserver | undefined;

  // Hierarchical data for sunburst - five circles with vibrant colors
  private hierarchyData: HierarchyNode = {
    name: 'Christianity',
    children: [
      {
        name: 'Core Beliefs',
        children: [
          { 
            name: 'Protestant', 
            color: '#60A5FA', // Brighter blue
            children: [
              { 
                name: 'SOLA FIDE / SOLA SCRIPTURA',
                color: '#93C5FD', // Light blue
                children: [
                  { 
                    name: 'Law/Gospel Distinction',
                    color: '#BFDBFE',
                    children: [{ name: 'Lutheran', color: '#3B82F6', value: 1 }]
                  },
                  { 
                    name: 'Predestination',
                    color: '#DBEAFE',
                    children: [
                      { name: 'Reformed', color: '#EF4444', value: 1 },
                      { 
                        name: 'Congregational Church Polity',
                        color: '#FEE2E2',
                        children: [{ name: 'Congregationalist', color: '#F59E0B', value: 1 }]
                      }
                    ]
                  },
                  { 
                    name: 'Episcopal Polity',
                    color: '#E0E7FF',
                    children: [{ name: 'Anglican', color: '#EC4899', value: 1 }]
                  },
                  { 
                    name: 'Credobaptism',
                    color: '#FEF3C7',
                    children: [{ name: 'Baptist', color: '#92400E', value: 1 }]
                  },
                  { 
                    name: 'Wesleyan Perfectionism',
                    color: '#D1FAE5',
                    children: [{ name: 'Methodist', color: '#10B981', value: 1 }]
                  },
                  { 
                    name: 'Spirit Baptism',
                    color: '#E9D5FF',
                    children: [{ name: 'Pentecostal', color: '#A855F7', value: 1 }]
                  }
                ]
              }
            ]
          },
          { 
            name: 'Catholic', 
            color: '#FBBF24', // Vibrant gold
            children: [
              { name: 'Papacy', color: '#FCD34D', value: 1 },
              { name: 'Purgatory', color: '#FDE68A', value: 1 },
              { name: 'Transubstantiation', color: '#FEF3C7', value: 1 },
              { name: 'Immaculate Conception', color: '#FFFBEB', value: 1 }
            ]
          },
          { 
            name: 'Eastern Orthodox', 
            color: '#FB923C', // Vibrant orange
            children: [
              { name: 'Theosis', color: '#FDBA74', value: 1 }
            ]
          },
          { 
            name: 'Oriental Orthodox', 
            color: '#84CC16', // Vibrant lime
            children: [
              { name: 'Miaphysite Christology', color: '#BEF264', value: 1 }
            ]
          }
        ]
      }
    ]
  };

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.createSunburst();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.createSunburst();
    });
    this.resizeObserver.observe(this.wheelContainer.nativeElement);
  }

  private createSunburst(): void {
    const container = this.wheelContainer.nativeElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const size = Math.min(containerWidth, containerHeight) * 0.9; // 90% of container to add padding
    this.width = size;
    this.height = size;
    this.radius = Math.min(this.width, this.height) / 2;

    // Clear existing SVG
    d3.select(container).select('svg').remove();

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = this.svg.append('g')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

    // No background circles - transparent so page background shows through

    // Create hierarchy
    const root = d3.hierarchy(this.hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create partition layout
    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, this.radius]);

    partition(root);

    // Arc generator
    const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(this.radius / 2)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // Create the arcs for all depths
    g.selectAll('path')
      .data(root.descendants().filter(d => d.depth >= 1))
      .enter()
      .append('path')
      .attr('fill', (d: any) => {
        if (d.depth === 1) return '#1e293b'; // Ring 1 - dark slate (core beliefs)
        if (d.depth === 2) return d.data.color || '#1e293b'; // Ring 2 - colored by tradition
        if (d.depth === 3) return d.data.color || d.parent.data.color || '#1e293b'; // Ring 3 - SOLA FIDE/SCRIPTURA
        if (d.depth === 4) return d.data.color || d.parent.parent.data.color || '#1e293b'; // Ring 4 - theological concepts
        if (d.depth === 5) {
          // Ring 5 - could be denominations OR another theological concept
          return d.data.color || d.parent.parent.parent.data.color || '#1e293b';
        }
        if (d.depth === 6) return d.data.color || '#1e293b'; // Ring 6 - Congregationalist
        return '#1e293b';
      })
      .attr('opacity', (d: any) => {
        if (d.depth === 1) return 1;
        if (d.depth === 2) return 0.95;
        if (d.depth === 3) return 0.9;
        if (d.depth === 4) return 0.85;
        if (d.depth === 5) return 0.9;
        if (d.depth === 6) return 0.95;
        return 1;
      })
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6))')
      .attr('d', arc as any);

    // Add SVG filter for matte effect
    const defs = this.svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'matte')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 1)
      .attr('result', 'blur');

    filter.append('feOffset')
      .attr('in', 'blur')
      .attr('dx', 0)
      .attr('dy', 1)
      .attr('result', 'offsetBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'offsetBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add labels for ring 1 (core beliefs)
    g.selectAll('text.first-ring')
      .data(root.descendants().filter(d => d.depth === 1))
      .enter()
      .append('text')
      .attr('class', 'first-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#e2e8f0')
      .attr('font-weight', 'bold')
      .text((d: any) => d.data.name);

    // Add labels for ring 2 (traditions)
    g.selectAll('text.second-ring')
      .data(root.descendants().filter(d => d.depth === 2))
      .enter()
      .append('text')
      .attr('class', 'second-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#0f172a')
      .style('text-shadow', '0 1px 3px rgba(255,255,255,0.2)')
      .text((d: any) => d.data.name);

    // Add labels for ring 3 (SOLA FIDE/SCRIPTURA or theological concepts for other traditions)
    g.selectAll('text.third-ring')
      .data(root.descendants().filter(d => d.depth === 3))
      .enter()
      .append('text')
      .attr('class', 'third-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', (d: any) => d.parent.data.name === 'Protestant' ? 'bold' : 'normal')
      .attr('fill', '#0f172a')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.2)')
      .text((d: any) => d.data.name);

    // Add labels for ring 4 (specific theological concepts)
    g.selectAll('text.fourth-ring')
      .data(root.descendants().filter(d => d.depth === 4))
      .enter()
      .append('text')
      .attr('class', 'fourth-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('fill', '#0f172a')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.2)')
      .text((d: any) => d.data.name);

    // Add labels for ring 5 (denominations or intermediate concepts)
    g.selectAll('text.fifth-ring')
      .data(root.descendants().filter(d => d.depth === 5))
      .enter()
      .append('text')
      .attr('class', 'fifth-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '7px')
      .attr('font-weight', (d: any) => d.data.color && d.children ? 'normal' : 'bold')
      .attr('fill', (d: any) => {
        // If it has a specific color and no children, it's a denomination - use white
        if (d.data.color && !d.children) return '#ffffff';
        // Otherwise it's a theological concept - use dark
        return '#0f172a';
      })
      .style('text-shadow', (d: any) => d.data.color && !d.children ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.2)')
      .text((d: any) => d.data.name);

    // Add labels for ring 6 (Congregationalist)
    g.selectAll('text.sixth-ring')
      .data(root.descendants().filter(d => d.depth === 6))
      .enter()
      .append('text')
      .attr('class', 'sixth-ring')
      .attr('transform', function(d: any) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', '7px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.3)')
      .text((d: any) => d.data.name);

    // Add center circle for the root - transparent with just a border
    const firstChild = root.children![0] as d3.HierarchyRectangularNode<HierarchyNode>;
    g.append('circle')
      .attr('r', firstChild.y0)
      .attr('fill', 'transparent')
      .attr('stroke', '#475569')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4))');

    // Add core beliefs text in center
    const coreBeliefs = ['Trinity', 'Nicene Creed', 'Divinity of Christ', 'Virgin Birth', 'Resurrection'];
    const centerRadius = firstChild.y0 * 0.7;
    
    coreBeliefs.forEach((belief, i) => {
      const angle = (i * 72 - 90) * Math.PI / 180; // 72 degrees apart (360/5)
      const x = Math.cos(angle) * centerRadius;
      const y = Math.sin(angle) * centerRadius;
      
      g.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', '#e2e8f0')
        .attr('font-weight', 'bold')
        .style('text-shadow', '0 2px 4px rgba(0,0,0,0.6)')
        .text(belief);
    });

    // Add cross in the center
    const crossSize = 25;
    const crossWidth = 5;

    g.append('rect')
      .attr('x', -crossWidth / 2)
      .attr('y', -crossSize / 2)
      .attr('width', crossWidth)
      .attr('height', crossSize)
      .attr('fill', '#FBBF24')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))');

    g.append('rect')
      .attr('x', -crossSize / 2)
      .attr('y', -crossWidth / 2 - 5)
      .attr('width', crossSize)
      .attr('height', crossWidth)
      .attr('fill', '#FBBF24')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))');
  }
}
