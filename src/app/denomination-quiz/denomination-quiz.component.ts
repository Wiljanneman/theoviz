import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

interface TreeNode {
  id: string;
  question?: string;
  answer?: string;
  denomination?: string;
  color?: string;
  children?: TreeNode[];
  x?: number;
  y?: number;
  parent?: TreeNode;
}

@Component({
  selector: 'app-denomination-quiz',
  imports: [],
  templateUrl: './denomination-quiz.component.html',
  styleUrl: './denomination-quiz.component.css'
})
export class DenominationQuizComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('treeContainer', { static: true }) treeContainer!: ElementRef;

  private width = 0;
  private height = 0;
  private svg: any;
  private g: any;
  private currentLevel = 0;
  private resizeListener: (() => void) | null = null;
  private nodePositions = new Map<number, number>(); // Store Y positions by level

  private treeData: TreeNode = {
    id: 'root',
    question: 'Find Your Denomination',
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
                question: 'Must ALL the Churches still be ruled by a hierarchy of Bishops?',
                children: [
                  {
                    id: 'hierarchy-yes',
                    answer: 'Yes',
                    denomination: 'Anglican/Episcopal',
                    color: '#FFC0CB'
                  },
                  {
                    id: 'hierarchy-no',
                    answer: 'No',
                    question: 'Does Jesus have two natures, or one nature that\'s a union of two?',
                    children: [
                      {
                        id: 'nature-one',
                        answer: 'One',
                        denomination: 'Oriental Orthodox',
                        color: '#ADFF2F'
                      },
                      {
                        id: 'nature-two',
                        answer: 'Two',
                        question: 'Does the Spirit proceed from the Father and the Son, or just the Father?',
                        children: [
                          {
                            id: 'spirit-father',
                            answer: 'Just Father',
                            denomination: 'Eastern Orthodox',
                            color: '#FF8C00'
                          },
                          {
                            id: 'spirit-both',
                            answer: 'Father and Son',
                            question: 'Are Christ\'s body and blood physically present in Communion?',
                            children: [
                              {
                                id: 'communion-yes',
                                answer: 'Yes',
                                denomination: 'Lutheran',
                                color: '#4169E1'
                              },
                              {
                                id: 'communion-no',
                                answer: 'No, just spiritually',
                                denomination: 'Presbyterian',
                                color: '#DC143C'
                              }
                            ]
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
                question: 'Is "Spirit Baptism" the same as being born again, or something later?',
                children: [
                  {
                    id: 'spirit-same',
                    answer: 'Same',
                    question: 'Is salvation based on a free-will choice?',
                    children: [
                      {
                        id: 'freewill-no',
                        answer: 'No',
                        denomination: 'Non-Denominational',
                        color: '#000000'
                      },
                      {
                        id: 'freewill-yes',
                        answer: 'Yes',
                        denomination: 'Methodist',
                        color: '#228B22'
                      }
                    ]
                  },
                  {
                    id: 'spirit-later',
                    answer: 'Later',
                    question: 'Should Church be more free or more formal?',
                    children: [
                      {
                        id: 'church-free',
                        answer: 'Free',
                        denomination: 'Pentecostal',
                        color: '#8A2BE2'
                      },
                      {
                        id: 'church-formal',
                        answer: 'Formal',
                        denomination: 'Baptist',
                        color: '#8B4513'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  private visibleNodes = new Set<string>(['root', 'bible-authority']); // Start with root and first question visible

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.setDimensions();
    this.createTree();
    
    // Add resize listener
    this.resizeListener = () => {
      this.setDimensions();
      this.updateTree();
    };
    window.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  private setDimensions(): void {
    const container = this.treeContainer.nativeElement;
    this.width = container.clientWidth;
    this.height = container.clientHeight;
  }

  private makeChildrenVisible(nodeId: string): void {
    const node = this.findNodeById(this.treeData, nodeId);
    if (node && node.children) {
      node.children.forEach(child => {
        this.visibleNodes.add(child.id);
      });
      this.updateTree();
    }
  }

  private makeSpecificChildVisible(childId: string): void {
    // Add the specific clicked child to visible nodes
    this.visibleNodes.add(childId);
    
    // Find the clicked node to check if it has children (answers to show)
    const clickedNode = this.findNodeById(this.treeData, childId);
    
    // If this node has children, make them visible too (the answer options)
    if (clickedNode && clickedNode.children && !clickedNode.denomination) {
      clickedNode.children.forEach(child => {
        this.visibleNodes.add(child.id);
      });
    }
    
    this.currentLevel++;
    this.updateTreeWithPan();
  }

  private startQuiz(): void {
    // Show the first question's answers
    this.visibleNodes.add('bible-no');
    this.visibleNodes.add('bible-yes');
    this.currentLevel = 1;
    this.updateTreeWithPan();
  }

  private updateTreeWithPan(): void {
    // First, update the tree structure with new visible nodes
    this.updateTreeStructure();
    
    // Calculate how much to pan based on current level
    // Pan so the current question is centered in the viewport
    const yOffset = this.currentLevel * 200; // 200px spacing per level
    
    this.g.transition()
      .duration(750)
      .attr('transform', `translate(${this.width / 2}, ${100 - yOffset})`);
  }

  private findNodeById(node: TreeNode, id: string): TreeNode | null {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  private updateTree(): void {
    this.createTree();
    // Keep the current position when just updating without level change
    const yOffset = this.currentLevel * 200; // 200px spacing per level
    this.g.attr('transform', `translate(${this.width / 2}, ${100 - yOffset})`);
  }

  private updateTreeStructure(): void {
    // Calculate dynamic height based on full tree depth
    const maxDepth = this.getMaxTreeDepth(this.treeData);
    const dynamicHeight = Math.max(this.height - 100, maxDepth * 200); // 200px per level
    
    // Update tree layout with dynamic sizing
    const tree = d3.tree<TreeNode>()
      .size([this.width - 100, dynamicHeight])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2)); // Adjust separation

    // Create hierarchy with FULL tree data (not filtered)
    const root = d3.hierarchy(this.treeData);
    tree(root);

    // Store Y positions by level for accurate panning
    this.nodePositions.clear();
    root.descendants().forEach(d => {
      const level = d.depth;
      if (!this.nodePositions.has(level)) {
        this.nodePositions.set(level, d.y || 0);
      }
    });

    // Update existing elements instead of recreating
    this.updateLinks(root);
    this.updateNodes(root);
  }

  private getMaxDepth(): number {
    let maxDepth = 0;
    const traverse = (node: TreeNode, depth: number) => {
      if (this.visibleNodes.has(node.id)) {
        maxDepth = Math.max(maxDepth, depth);
        if (node.children) {
          node.children.forEach(child => traverse(child, depth + 1));
        }
      }
    };
    traverse(this.treeData, 0);
    return maxDepth + 1;
  }

  private getMaxTreeDepth(node: TreeNode, depth: number = 0): number {
    if (!node.children || node.children.length === 0) {
      return depth;
    }
    return Math.max(...node.children.map(child => this.getMaxTreeDepth(child, depth + 1)));
  }

  private updateLinks(root: any): void {
    const selfRef = this;
    
    // Update links with enter/update/exit pattern
    const linkSelection = this.g.selectAll('.link')
      .data(root.links(), (d: any) => `${d.source.data.id}-${d.target.data.id}`);

    // Remove old links
    linkSelection.exit().remove();

    // Add new links
    linkSelection.enter()
      .append('path')
      .attr('class', 'link')
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .style('fill', 'none')
      .style('opacity', 0.2)
      .style('filter', 'blur(2px)')
      .merge(linkSelection)
      .transition()
      .duration(500)
      .style('opacity', (d: any) => selfRef.visibleNodes.has(d.target.data.id) ? 0.8 : 0.2)
      .style('filter', (d: any) => selfRef.visibleNodes.has(d.target.data.id) ? 'none' : 'blur(2px)')
      .attr('d', (d: any) => {
        return `M${d.source.x},${d.source.y}
                L${d.target.x},${d.target.y}`;
      });
  }

  private updateNodes(root: any): void {
    const selfRef = this;
    
    // Update nodes with enter/update/exit pattern
    const nodeSelection = this.g.selectAll('.node')
      .data(root.descendants(), (d: any) => d.data.id);

    // Remove old nodes
    nodeSelection.exit().remove();

    // Add new nodes
    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .style('opacity', 0.3)
      .style('filter', 'blur(3px)');

    // Merge enter and update selections
    const nodeMerge = nodeEnter.merge(nodeSelection);

    // Animate to new positions and visibility
    nodeMerge.transition()
      .duration(500)
      .style('opacity', (d: any) => selfRef.visibleNodes.has(d.data.id) ? 1 : 0.3)
      .style('filter', (d: any) => selfRef.visibleNodes.has(d.data.id) ? 'none' : 'blur(3px)')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Add all the node content (rectangles, circles, text, buttons)
    this.addNodeContent(nodeEnter);
  }

  private addNodeContent(nodeEnter: any): void {
    const selfRef = this;

    // Add rectangles for questions (non-denomination nodes)
    nodeEnter.filter((d: any) => d.data.question && !d.data.denomination)
      .append('rect')
      .attr('x', -120)
      .attr('y', -30)
      .attr('width', 240)
      .attr('height', 60)
      .attr('rx', 12)
      .style('fill', 'rgba(30, 41, 59, 0.95)')
      .style('stroke', '#a855f7')
      .style('stroke-width', 2)
      .style('cursor', 'default')
      .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))');

    // Add circles for denomination results
    nodeEnter.filter((d: any) => d.data.denomination)
      .append('circle')
      .attr('r', 35)
      .style('fill', (d: any) => d.data.color || '#ffffff')
      .style('stroke', 'none')
      .style('cursor', 'default')
      .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))')
      .on('mouseover', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', 40)
          .style('filter', 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.25))');
      })
      .on('mouseout', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', 35)
          .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))');
      });

    // Add text labels for questions
    nodeEnter.filter((d: any) => d.data.question && !d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 0)
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('fill', '#e2e8f0')
      .style('pointer-events', 'none')
      .style('font-family', 'Inter, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .each(function(this: SVGTextElement, d: any) {
        const text = d3.select(this);
        const words = d.data.question.split(' ');
        const lineHeight = 16;
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text.append('tspan').attr('x', 0).attr('dy', 0);

        words.forEach((word: string) => {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node()!.getComputedTextLength() > 210) {
            line.pop();
            tspan.text(line.join(' '));
            line = [word];
            lineNumber++;
            tspan = text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineHeight)
              .text(word);
          }
        });
        
        // Center the text block vertically
        const totalLines = text.selectAll('tspan').size();
        const offset = -(totalLines - 1) * lineHeight / 2;
        text.selectAll('tspan').each(function(this: any, d: any, i: number) {
          d3.select(this).attr('dy', i === 0 ? offset : lineHeight);
        });
      });

    // Add text labels for denominations
    nodeEnter.filter((d: any) => d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .style('text-shadow', '0px 1px 2px rgba(0, 0, 0, 0.3)')
      .text((d: any) => d.data.denomination);

    // Add start button for root node
    nodeEnter.filter((d: any) => d.data.id === 'root')
      .append('g')
      .attr('class', 'start-button')
      .style('cursor', 'pointer')
      .on('click', () => {
        selfRef.startQuiz();
      })
      .each(function(this: SVGGElement) {
        const buttonGroup = d3.select(this);
        
        buttonGroup.append('rect')
          .attr('x', -75)
          .attr('y', 55)
          .attr('width', 150)
          .attr('height', 40)
          .attr('rx', 20)
          .style('fill', '#d946ef')
          .style('stroke', 'none')
          .style('opacity', 1)
          .style('filter', 'drop-shadow(0px 4px 12px rgba(217, 70, 239, 0.5))')
          .on('mouseover', function() {
            d3.select(this)
              .transition()
              .duration(150)
              .style('fill', '#c026d3')
              .style('filter', 'drop-shadow(0px 6px 16px rgba(217, 70, 239, 0.6))');
          })
          .on('mouseout', function() {
            d3.select(this)
              .transition()
              .duration(150)
              .style('fill', '#d946ef')
              .style('filter', 'drop-shadow(0px 4px 12px rgba(217, 70, 239, 0.5))');
          });

        buttonGroup.append('text')
          .attr('x', 0)
          .attr('y', 79)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .style('font-weight', '600')
          .style('fill', '#ffffff')
          .style('pointer-events', 'none')
          .style('font-family', 'Inter, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
          .text('Get Started');
      });

    // Add answer buttons
    nodeEnter.filter((d: any) => {
      const originalNode = selfRef.findNodeById(selfRef.treeData, d.data.id);
      return originalNode && originalNode.children && !d.data.denomination;
    })
      .each(function(this: SVGGElement, d: any) {
        const nodeGroup = d3.select(this);
        const originalNode = selfRef.findNodeById(selfRef.treeData, d.data.id);
        const children = originalNode?.children || [];
        
        children.forEach((child: TreeNode, index: number) => {
          if (child.answer) {
            const buttonGroup = nodeGroup.append('g')
              .attr('class', 'answer-button')
              .style('cursor', 'pointer')
              .on('click', (event: any) => {
                event.stopPropagation();
                selfRef.makeSpecificChildVisible(child.id);
              });

            const yOffset = 60;
            const xOffset = (index === 0) ? -50 : 50;

            buttonGroup.append('rect')
              .attr('x', xOffset - 35)
              .attr('y', yOffset - 16)
              .attr('width', 70)
              .attr('height', 32)
              .attr('rx', 16)
              .style('fill', child.answer === 'Yes' ? '#4caf50' : '#ff9800')
              .style('stroke', 'none')
              .style('opacity', 1)
              .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
              .on('mouseover', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.24))')
                  .attr('y', yOffset - 18);
              })
              .on('mouseout', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
                  .attr('y', yOffset - 16);
              });

            buttonGroup.append('text')
              .attr('x', xOffset)
              .attr('y', yOffset + 4)
              .attr('text-anchor', 'middle')
              .style('font-size', '13px')
              .style('font-weight', '500')
              .style('fill', '#ffffff')
              .style('pointer-events', 'none')
              .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
              .text(child.answer || '');
          }
        });
      });
  }

  private createTree(): void {
    // Clear any existing content
    d3.select(this.treeContainer.nativeElement).selectAll('*').remove();

    // Ensure we have valid dimensions
    if (this.width <= 0 || this.height <= 0) {
      this.setDimensions();
    }

    // Create SVG that fills the container
    this.svg = d3.select(this.treeContainer.nativeElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('background', 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${this.width / 2}, 100)`);

    // Create tree layout with dynamic sizing - RENDER ENTIRE TREE
    const maxDepth = this.getMaxTreeDepth(this.treeData); // Get full tree depth
    const dynamicHeight = Math.max(this.height - 100, maxDepth * 200); // 200px per level
    
    const tree = d3.tree<TreeNode>()
      .size([this.width - 100, dynamicHeight])
      .separation((a, b) => (a.parent === b.parent ? 1.5 : 2)); // Adjust separation

    // Create hierarchy with FULL tree data (not filtered)
    const root = d3.hierarchy(this.treeData);
    tree(root);

    // Store Y positions by level for accurate panning
    this.nodePositions.clear();
    root.descendants().forEach(d => {
      const level = d.depth;
      if (!this.nodePositions.has(level)) {
        this.nodePositions.set(level, d.y || 0);
      }
    });

    // Create links
    this.g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d: any) => {
        return `M${d.source.x},${d.source.y}
                L${d.target.x},${d.target.y}`;
      })
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .style('fill', 'none')
      .style('opacity', (d: any) => this.visibleNodes.has(d.target.data.id) ? 0.8 : 0.2)
      .style('filter', (d: any) => this.visibleNodes.has(d.target.data.id) ? 'none' : 'blur(2px)');

    // Create nodes
    const node = this.g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('opacity', (d: any) => this.visibleNodes.has(d.data.id) ? 1 : 0.3)
      .style('filter', (d: any) => this.visibleNodes.has(d.data.id) ? 'none' : 'blur(3px)');

    // Add rectangles for questions (non-denomination nodes)
    node.filter((d: any) => d.data.question && !d.data.denomination)
      .append('rect')
      .attr('x', -120)
      .attr('y', -30)
      .attr('width', 240)
      .attr('height', 60)
      .attr('rx', 12)
      .style('fill', 'rgba(30, 41, 59, 0.95)')
      .style('stroke', '#a855f7')
      .style('stroke-width', 2)
      .style('cursor', 'default')
      .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))');

    // Add circles for denomination results
    node.filter((d: any) => d.data.denomination)
      .append('circle')
      .attr('r', 35)
      .style('fill', (d: any) => d.data.color || '#ffffff')
      .style('stroke', 'none')
      .style('cursor', 'default')
      .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))')
      .on('mouseover', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', 40)
          .style('filter', 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.25))');
      })
      .on('mouseout', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', 35)
          .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))');
      });

    // Add text labels for questions in rectangles
    node.filter((d: any) => d.data.question && !d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 0)
      .style('font-size', '13px')
      .style('font-weight', '500')
      .style('fill', '#e2e8f0')
      .style('pointer-events', 'none')
      .style('font-family', 'Inter, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .each(function(this: SVGTextElement, d: any) {
        const text = d3.select(this);
        const words = d.data.question.split(' ');
        const lineHeight = 16;
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text.append('tspan').attr('x', 0).attr('dy', 0);

        words.forEach((word: string) => {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node()!.getComputedTextLength() > 210) {
            line.pop();
            tspan.text(line.join(' '));
            line = [word];
            lineNumber++;
            tspan = text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineHeight)
              .text(word);
          }
        });
        
        // Center the text block vertically
        const totalLines = text.selectAll('tspan').size();
        const offset = -(totalLines - 1) * lineHeight / 2;
        text.selectAll('tspan').each(function(this: any, d: any, i: number) {
          d3.select(this).attr('dy', i === 0 ? offset : lineHeight);
        });
      });

    // Add text labels for denominations in circles
    node.filter((d: any) => d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .style('text-shadow', '0px 1px 2px rgba(0, 0, 0, 0.3)')
      .text((d: any) => d.data.denomination);

    // Add "Click to get started" button for root node
    const component = this;
    node.filter((d: any) => d.data.id === 'root')
      .append('g')
      .attr('class', 'start-button')
      .style('cursor', 'pointer')
      .on('click', () => {
        component.startQuiz();
      })
      .each(function(this: SVGGElement) {
        const buttonGroup = d3.select(this);
        
        // Add button rectangle
        buttonGroup.append('rect')
          .attr('x', -75)
          .attr('y', 55)
          .attr('width', 150)
          .attr('height', 40)
          .attr('rx', 20)
          .style('fill', '#1976d2')
          .style('stroke', 'none')
          .style('opacity', 1)
          .style('filter', 'drop-shadow(0px 4px 8px rgba(25, 118, 210, 0.3))')
          .on('mouseover', function() {
            d3.select(this)
              .transition()
              .duration(150)
              .style('fill', '#1565c0')
              .style('filter', 'drop-shadow(0px 6px 12px rgba(25, 118, 210, 0.4))');
          })
          .on('mouseout', function() {
            d3.select(this)
              .transition()
              .duration(150)
              .style('fill', '#1976d2')
              .style('filter', 'drop-shadow(0px 4px 8px rgba(25, 118, 210, 0.3))');
          });

        // Add button text
        buttonGroup.append('text')
          .attr('x', 0)
          .attr('y', 79)
          .attr('text-anchor', 'middle')
          .style('font-size', '14px')
          .style('font-weight', '500')
          .style('fill', '#ffffff')
          .style('pointer-events', 'none')
          .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
          .text('Get Started');
      });

    // Create answer choice buttons for each question node that has children in the original data
    const selfRef = this;
    node.filter((d: any) => {
      // Find the original node data to check for children
      const originalNode = this.findNodeById(this.treeData, d.data.id);
      return originalNode && originalNode.children && !d.data.denomination;
    })
      .each(function(this: SVGGElement, d: any) {
        const nodeGroup = d3.select(this);
        // Get children from original data, not filtered data
        const originalNode = selfRef.findNodeById(selfRef.treeData, d.data.id);
        const children = originalNode?.children || [];
        
        children.forEach((child: TreeNode, index: number) => {
          if (child.answer) {
            const buttonGroup = nodeGroup.append('g')
              .attr('class', 'answer-button')
              .style('cursor', 'pointer')
              .on('click', (event: any) => {
                event.stopPropagation();
                // Only make the specific clicked child visible, not all children
                selfRef.makeSpecificChildVisible(child.id);
              });

            // Position buttons horizontally side-by-side below the question
            const yOffset = 60; // Fixed Y position for all buttons
            const xOffset = (index === 0) ? -50 : 50; // Left and right positioning

            // Add button rectangle
            const buttonRect = buttonGroup.append('rect')
              .attr('x', xOffset - 35)
              .attr('y', yOffset - 16)
              .attr('width', 70)
              .attr('height', 32)
              .attr('rx', 16)
              .style('fill', child.answer === 'Yes' ? '#4caf50' : '#ff9800')
              .style('stroke', 'none')
              .style('opacity', 1)
              .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))');

            // Add hover effects
            buttonRect
              .on('mouseover', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.24))')
                  .attr('y', yOffset - 18);
              })
              .on('mouseout', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
                  .attr('y', yOffset - 16);
              });

            // Add button text
            buttonGroup.append('text')
              .attr('x', xOffset)
              .attr('y', yOffset + 4)
              .attr('text-anchor', 'middle')
              .style('font-size', '13px')
              .style('font-weight', '500')
              .style('fill', '#ffffff')
              .style('pointer-events', 'none')
              .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
              .text(child.answer || '');
          }
        });
      });

    // Add answer labels on links
    this.g.selectAll('.answer-label')
      .data(root.links().filter((d: any) => d.target.data.answer))
      .enter()
      .append('text')
      .attr('class', 'answer-label')
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .style('background', 'rgba(0,0,0,0.7)')
      .style('padding', '2px')
      .style('border-radius', '3px')
      .text((d: any) => d.target.data.answer);

    // Zoom functionality disabled to lock user at current zoom level
  }

  private filterVisibleNodes(node: TreeNode): TreeNode {
    const filtered: TreeNode = { ...node };
    
    if (node.children) {
      filtered.children = node.children
        .filter(child => this.visibleNodes.has(child.id))
        .map(child => this.filterVisibleNodes(child));
    }
    
    return filtered;
  }
}
