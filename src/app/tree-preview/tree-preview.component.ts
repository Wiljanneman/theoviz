import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

interface TreeNode {
  id: string;
  question?: string;
  answer?: string;
  denomination?: string;
  color?: string;
  children?: TreeNode[];
}

@Component({
  selector: 'app-tree-preview',
  standalone: true,
  imports: [],
  template: '<div #treeContainer class="w-full h-full"></div>',
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class TreePreviewComponent implements OnInit, AfterViewInit {
  @ViewChild('treeContainer', { static: true }) treeContainer!: ElementRef;

  private svg: any;
  private width = 400;
  private height = 300;

  private treeData: TreeNode = {
    id: 'root',
    question: 'What denomination are you?',
    children: [
      {
        id: 'bible-authority',
        question: 'Does the Bible have MORE authority than the Church?',
        children: [
          {
            id: 'bible-no',
            answer: 'No',
            denomination: 'Catholic',
            color: '#FFD700'
          },
          {
            id: 'bible-yes',
            answer: 'Yes',
            question: 'Should infants be baptized?',
            children: [
              {
                id: 'infant-yes',
                answer: 'Yes',
                children: [
                  {
                    id: 'anglican',
                    denomination: 'Anglican',
                    color: '#FFC0CB'
                  },
                  {
                    id: 'orthodox-lutheran',
                    children: [
                      {
                        id: 'orthodox',
                        denomination: 'Orthodox',
                        color: '#FF8C00'
                      },
                      {
                        id: 'lutheran-presbyterian',
                        children: [
                          {
                            id: 'lutheran',
                            denomination: 'Lutheran',
                            color: '#4169E1'
                          },
                          {
                            id: 'presbyterian',
                            denomination: 'Presbyterian',
                            color: '#DC143C'
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                id: 'infant-no',
                answer: 'No',
                children: [
                  {
                    id: 'baptist',
                    denomination: 'Baptist',
                    color: '#32CD32'
                  },
                  {
                    id: 'pentecostal',
                    denomination: 'Pentecostal',
                    color: '#FF6347'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.createTree();
  }

  private createTree(): void {
    const container = this.treeContainer.nativeElement;
    
    // Clear any existing SVG
    d3.select(container).select('svg').remove();

    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = this.svg.append('g')
      .attr('transform', 'translate(0,20)');

    // Create tree layout
    const treeLayout = d3.tree<TreeNode>()
      .size([this.width - 40, this.height - 60]);

    // Convert data to hierarchy
    const root = d3.hierarchy(this.treeData);
    const treeNodes = treeLayout(root);

    // Draw links
    g.selectAll('.link')
      .data(treeNodes.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d: any) => {
        return `M${d.source.x},${d.source.y}
                C${d.source.x},${(d.source.y + d.target.y) / 2}
                 ${d.target.x},${(d.source.y + d.target.y) / 2}
                 ${d.target.x},${d.target.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#c084fc')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.4);

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Add circles for nodes
    nodes.append('circle')
      .attr('r', (d: any) => d.data.denomination ? 6 : 8)
      .attr('fill', (d: any) => {
        if (d.data.denomination && d.data.color) {
          return d.data.color;
        }
        return d.depth === 0 ? '#e879f9' : '#c084fc';
      })
      .attr('opacity', (d: any) => d.data.denomination ? 0.7 : 0.5)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5);
  }
}
