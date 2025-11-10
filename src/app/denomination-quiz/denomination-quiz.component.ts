import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

interface TreeNode {
  id: string;
  question?: string;
  answer?: string;
  denomination?: string;
  color?: string;
  result?: string;
  icon?: string;
  children?: TreeNode[];
  x?: number;
  y?: number;
  parent?: TreeNode;
}

@Component({
  selector: 'app-denomination-quiz',
  imports: [CommonModule],
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
  private visitHistory: string[] = ['root', 'bible-authority']; // Track the path taken
  public mode: 'quiz' | 'free' = 'quiz'; // Current mode
  public currentResult: string | null = null; // Current result text to display
  public headerExpanded: boolean = true; // Drawer state for header
  
  // Responsive scaling factors
  private get isMobile(): boolean {
    // Account for DPI scaling - use actual rendered size
    return this.width < 960; // Increased from 768 to account for 125% scaling
  }
  
  private get isSmallMobile(): boolean {
    return this.width < 600; // Increased from 480 to account for 125% scaling
  }
  
  private get scaleFactor(): number {
    if (this.isSmallMobile) return 0.7; // Slightly increased
    if (this.isMobile) return 0.85; // Slightly increased
    return 1;
  }

  private treeData: TreeNode = {
    id: 'root',
    question: 'Loading...',
    children: []
  };

  private visibleNodes = new Set<string>(['root', 'bible-authority']); // Start with root and first question visible

  ngOnInit(): void {
    this.loadTreeData();
  }

  private async loadTreeData(): Promise<void> {
    try {
      const response = await fetch('/tree-data.json');
      this.treeData = await response.json();
      // Initialize visible nodes after data is loaded
      this.visibleNodes = new Set<string>(['root', this.treeData.children?.[0]?.id || 'bible-authority']);
      this.visitHistory = ['root', this.treeData.children?.[0]?.id || 'bible-authority'];
      
      // Create the tree after data is loaded
      this.createTree();
    } catch (error) {
      console.error('Failed to load tree data:', error);
    }
  }

  ngAfterViewInit(): void {
    this.setDimensions();
    // Don't call createTree here - it will be called after data loads
    
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
    
    // Debug log for DPI scaling issues
    console.log('Container dimensions:', this.width, 'x', this.height, 
                'Device pixel ratio:', window.devicePixelRatio);
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
    
    // Add to visit history if not already the last item
    if (this.visitHistory[this.visitHistory.length - 1] !== childId) {
      this.visitHistory.push(childId);
    }
    
    // Find the clicked node to check if it's a question or final denomination
    const clickedNode = this.findNodeById(this.treeData, childId);
    
    // Update the current result text
    if (clickedNode?.result) {
      this.currentResult = clickedNode.result;
    }
    
    // If this is a final denomination, just update without panning
    if (clickedNode && clickedNode.denomination) {
      this.updateTreeStructure();
      return;
    }
    
    // If this node is a question (has children), only make the question visible, NOT the answer buttons yet
    // The answer buttons will be visible because they're rendered with the question node
    if (clickedNode && clickedNode.children && !clickedNode.denomination) {
      // Only increment level and pan for question nodes
      this.currentLevel++;
      this.updateTreeWithPan();
    } else {
      // Just update without panning
      this.updateTreeStructure();
    }
  }

  public setMode(mode: 'quiz' | 'free'): void {
    this.mode = mode;
    
    if (mode === 'free') {
      // In free mode, show all nodes and enable panning/zooming
      this.showAllNodes();
      this.enableZoom();
    } else {
      // In quiz mode, reset to guided experience
      this.resetQuiz();
      this.disableZoom();
    }
  }

  public toggleHeader(): void {
    this.headerExpanded = !this.headerExpanded;
  }

  private showAllNodes(): void {
    // Make all nodes visible
    const addAllNodes = (node: TreeNode) => {
      this.visibleNodes.add(node.id);
      if (node.children) {
        node.children.forEach(child => addAllNodes(child));
      }
    };
    addAllNodes(this.treeData);
    this.updateTreeStructure();
  }

  private resetQuiz(): void {
    // Reset to initial state
    this.visibleNodes = new Set<string>(['root', 'bible-authority']);
    this.visitHistory = ['root', 'bible-authority'];
    this.currentLevel = 0;
    this.updateTree();
  }

  private enableZoom(): void {
    if (!this.svg) return;
    
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });
    
    this.svg.call(zoom);
  }

  private disableZoom(): void {
    if (!this.svg) return;
    this.svg.on('.zoom', null);
  }

  private startQuiz(): void {
    // This function is no longer needed since we auto-start
    // But keeping it in case it's referenced elsewhere
    this.currentLevel = 0;
    this.updateTree();
  }

  private updateTreeWithPan(): void {
    // First, update the tree structure with new visible nodes
    this.updateTreeStructure();
    
    // Calculate how much to pan based on current level with responsive spacing
    const scale = this.scaleFactor;
    const levelSpacing = 200 * scale;
    const yOffset = this.currentLevel * levelSpacing;
    const leftMargin = this.isMobile ? 50 : 100;
    const topMargin = this.isMobile ? 50 : 100;
    
    this.g.transition()
      .duration(750)
      .attr('transform', `translate(${leftMargin}, ${topMargin - yOffset})`);
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
    const scale = this.scaleFactor;
    const levelSpacing = 200 * scale;
    const yOffset = this.currentLevel * levelSpacing;
    const leftMargin = this.isMobile ? 50 : 100;
    const topMargin = this.isMobile ? 50 : 100;
    this.g.attr('transform', `translate(${leftMargin}, ${topMargin - yOffset})`);
  }

  private updateTreeStructure(): void {
    // Create tree layout and hierarchy using shared methods
    const tree = this.setupTreeLayout();
    const root = this.createHierarchy(tree);

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

  private setupTreeLayout(): any {
    const maxDepth = this.getMaxTreeDepth(this.treeData);
    const scale = this.scaleFactor;
    const levelSpacing = 200 * scale;
    const dynamicHeight = Math.max(this.height - 100, maxDepth * levelSpacing);
    
    return d3.tree<TreeNode>()
      .size([this.width * 2, dynamicHeight])
      .separation((a, b) => 0.5 );
  }

  private createHierarchy(tree: any): any {
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

    return root;
  }

  private updateLinks(root: any): void {
    this.renderLinks(root, true);
  }

  private renderLinks(root: any, isUpdate: boolean = false): void {
    const selfRef = this;
    
    if (isUpdate) {
      // Update pattern for existing SVG
      const linkSelection = this.g.selectAll('.link')
        .data(root.links(), (d: any) => `${d.source.data.id}-${d.target.data.id}`);

      linkSelection.exit().remove();

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
    } else {
      // Initial creation
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
        .style('opacity', (d: any) => selfRef.visibleNodes.has(d.target.data.id) ? 0.8 : 0.2)
        .style('filter', (d: any) => selfRef.visibleNodes.has(d.target.data.id) ? 'none' : 'blur(2px)');
    }
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
    const scale = this.scaleFactor;
    
    // Scaled dimensions
    const rectWidth = 240 * scale;
    const rectHeight = 60 * scale;
    const circleRadius = 35 * scale;
    const fontSize = 13 * scale;
    const buttonWidth = 100 * scale;
    const buttonHeight = 32 * scale;

    // Add rectangles for questions (non-denomination nodes)
    nodeEnter.filter((d: any) => d.data.question && !d.data.denomination)
      .append('rect')
      .attr('x', -rectWidth / 2)
      .attr('y', -rectHeight / 2)
      .attr('width', rectWidth)
      .attr('height', rectHeight)
      .attr('rx', 12 * scale)
      .style('fill', 'rgba(30, 41, 59, 0.95)')
      .style('stroke', '#a855f7')
      .style('stroke-width', 2 * scale)
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))')
      .on('click', (event: any, d: any) => {
        event.stopPropagation();
        if (d.data.result) {
          selfRef.currentResult = d.data.result;
        }
      })
      .on('mouseover', function(this: SVGRectElement) {
        d3.select(this).transition()
          .duration(150)
          .style('stroke-width', 3 * scale)
          .style('filter', 'drop-shadow(0px 6px 16px rgba(168, 85, 247, 0.5))');
      })
      .on('mouseout', function(this: SVGRectElement) {
        d3.select(this).transition()
          .duration(150)
          .style('stroke-width', 2 * scale)
          .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))');
      });

    // Add circles for denomination results
    nodeEnter.filter((d: any) => d.data.denomination)
      .append('circle')
      .attr('r', circleRadius)
      .style('fill', (d: any) => d.data.color || '#ffffff')
      .style('stroke', 'none')
      .style('cursor', 'pointer')
      .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))')
      .on('click', (event: any, d: any) => {
        event.stopPropagation();
        if (d.data.result) {
          selfRef.currentResult = d.data.result;
        }
      })
      .on('mouseover', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', circleRadius * 1.15)
          .style('filter', 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.25))');
      })
      .on('mouseout', function(this: SVGCircleElement) {
        d3.select(this).transition()
          .duration(150)
          .attr('r', circleRadius)
          .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))');
      });

    // Add text labels for questions
    nodeEnter.filter((d: any) => d.data.question && !d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 0)
      .style('font-size', `${fontSize}px`)
      .style('font-weight', '500')
      .style('fill', '#e2e8f0')
      .style('pointer-events', 'none')
      .style('font-family', 'Inter, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .each(function(this: SVGTextElement, d: any) {
        const text = d3.select(this);
        const words = d.data.question.split(' ');
        const lineHeight = 16 * scale;
        const maxWidth = (rectWidth * 0.9);
        let line: string[] = [];
        let lineNumber = 0;
        let tspan = text.append('tspan').attr('x', 0).attr('dy', 0);

        words.forEach((word: string) => {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node()!.getComputedTextLength() > maxWidth) {
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
      .attr('dy', 4 * scale)
      .style('font-size', `${12 * scale}px`)
      .style('font-weight', '600')
      .style('fill', '#ffffff')
      .style('pointer-events', 'none')
      .style('font-family', 'Roboto, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif')
      .style('text-shadow', '0px 1px 2px rgba(0, 0, 0, 0.3)')
      .text((d: any) => d.data.denomination);

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

            const yOffset = 60 * scale;
            const xOffset = (index === 0) ? -60 * scale : 60 * scale;

            buttonGroup.append('rect')
              .attr('x', xOffset - (buttonWidth / 2))
              .attr('y', yOffset - (buttonHeight / 2))
              .attr('width', buttonWidth)
              .attr('height', buttonHeight)
              .attr('rx', 16 * scale)
              .style('fill', child.answer === 'Yes' ? '#4caf50' : '#ff9800')
              .style('stroke', 'none')
              .style('opacity', 1)
              .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
              .on('mouseover', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.24))')
                  .attr('y', yOffset - (buttonHeight / 2) - 2);
              })
              .on('mouseout', function(this: SVGRectElement) {
                d3.select(this)
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
                  .attr('y', yOffset - (buttonHeight / 2));
              });

            buttonGroup.append('text')
              .attr('x', xOffset)
              .attr('y', yOffset + (4 * scale))
              .attr('text-anchor', 'middle')
              .style('font-size', `${13 * scale}px`)
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

    // Responsive margins
    const leftMargin = this.isMobile ? 50 : 100;
    const topMargin = this.isMobile ? 50 : 100;

    // Create SVG that fills the container
    this.svg = d3.select(this.treeContainer.nativeElement)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .style('background', 'linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%)');

    this.g = this.svg.append('g')
      .attr('transform', `translate(${leftMargin}, ${topMargin})`);

    // Create tree layout and hierarchy using shared methods
    const tree = this.setupTreeLayout();
    const root = this.createHierarchy(tree);

    // Create links using shared rendering method
    this.renderLinks(root, false);

    // Create nodes
    const node = this.g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('opacity', (d: any) => this.visibleNodes.has(d.data.id) ? 1 : 0.3)
      .style('filter', (d: any) => this.visibleNodes.has(d.data.id) ? 'none' : 'blur(3px)');

    // Add all node content using shared method
    this.addNodeContent(node);
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
