import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, Renderer2, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as d3 from 'd3';
import { TooltipService } from '@babybeet/angular-tooltip';

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
  private zoom: any; // Store zoom behavior
  private currentLevel = 0;
  private resizeListener: (() => void) | null = null;
  private nodePositions = new Map<number, number>(); // Store Y positions by level
  private visitHistory: string[] = ['root', 'bible-authority']; // Track the path taken
  public mode: 'quiz' | 'free' = 'quiz'; // Current mode
  private _currentResult: string | null = null;
  public currentResultIcon: string | null = null; // Current result icon
  public currentResultDenomination: string | null = null; // Current denomination name
  public headerExpanded: boolean = true; // Drawer state for header
  private selectedNodeId: string | null = null; // Track which node is currently selected
  
  // Cached formatted result to avoid re-processing on every change detection
  public formattedResult: SafeHtml = '';
  
  // Getter/setter for currentResult to trigger formatting only when it changes
  public get currentResult(): string | null {
    return this._currentResult;
  }
  
  public set currentResult(value: string | null) {
    if (this._currentResult !== value) {
      this._currentResult = value;
      this.formattedResult = this.formatResult(value);
    }
  }
  
  // Tooltip management
  private hideTooltipTimeout: any = null;
  
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

  constructor(private renderer: Renderer2, private sanitizer: DomSanitizer, private tooltipService: TooltipService) {}

  ngOnInit(): void {
    this.loadTreeData();
  }

  @HostListener('document:mouseover', ['$event'])
  onMouseOver(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('tooltip-term')) {
      // Clear any pending hide timeout
      if (this.hideTooltipTimeout) {
        clearTimeout(this.hideTooltipTimeout);
        this.hideTooltipTimeout = null;
      }
      
      this.tooltipService.show(target, {
        content: target.getAttribute('data-tooltip') || '',
        theme: 'dark',
        className: 'custom-tooltip'
      });
    }
  }

  @HostListener('mouseout', ['$event'])
  onMouseOut(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('tooltip-term')) {
      // Small delay to prevent flickering when moving between adjacent tooltip terms
      this.hideTooltipTimeout = setTimeout(() => {
        this.tooltipService.hide();
      }, 50); // Reduced from 100ms to 50ms for snappier response
    }
  }

  // Glossary of theological terms
  private readonly tooltips: Record<string, string> = {
    'Filioque': 'Latin phrase meaning "and the Son", added to the Nicene Creed by the Western church, stating that the Holy Spirit proceeds from both the Father and the Son',
    'Sola Scriptura': 'Latin phrase meaning "Scripture alone", the Protestant doctrine that the Bible is the sole infallible authority for faith and practice',
    'Magisterium': 'The teaching authority of the Catholic Church, exercised by the Pope and bishops in communion with him',
    'miaphysitism': 'The Christological doctrine that Christ has one united nature (divine and human together), held by Oriental Orthodox churches',
    'dyophysitism': 'The Christological doctrine that Christ has two distinct natures (divine and human) united in one person, affirmed at Chalcedon',
    'theosis': 'The Orthodox doctrine of becoming partakers of the divine nature through union with Christ, also called deification',
    'apostolic succession': 'The unbroken line of bishops tracing back to the apostles, believed to preserve authentic church authority and sacramental validity',
    'ex cathedra': 'Latin phrase meaning "from the chair", referring to the Pope\'s most solemn and authoritative pronouncements',
    'papal infallibility': 'The Catholic doctrine that the Pope cannot err when officially defining doctrine on faith or morals',
    'icon veneration': 'The practice of showing reverence to sacred images, distinguished from worship which is due to God alone',
    'TULIP': 'Acronym for the five points of Calvinism: Total depravity, Unconditional election, Limited atonement, Irresistible grace, Perseverance of the saints',
    'covenant theology': 'Reformed theological framework viewing God\'s relationship with humanity through successive covenants',
    'regulative principle': 'The Reformed principle that worship should include only what God has commanded in Scripture',
    'prevenient grace': 'The Wesleyan/Arminian doctrine of God\'s grace that precedes and enables human response to the Gospel',
    'entire sanctification': 'The Wesleyan doctrine of complete cleansing from sin and full consecration to God, possible in this life',
    'baptismal regeneration': 'The doctrine that baptism effects spiritual rebirth and washing away of sin',
    'Real Presence': 'The doctrine that Christ is truly present in the Eucharist, understood differently by various traditions',
    'transubstantiation': 'The Catholic doctrine that the bread and wine become the actual body and blood of Christ while retaining the appearance of bread and wine',
    'consubstantiation': 'The Lutheran view that Christ\'s body and blood are present "in, with, and under" the bread and wine',
    'memorial view': 'The belief that the Lord\'s Supper is primarily a symbolic remembrance of Christ\'s sacrifice',
    'cessationism': 'The doctrine that miraculous spiritual gifts like prophecy and tongues ceased with the apostolic age',
    'continuationism': 'The belief that all spiritual gifts, including miraculous ones, continue to be active in the church today',
    'believer\'s baptism': 'The practice of baptizing only those who personally profess faith in Christ, typically associated with Baptist and Anabaptist traditions',
    'infant baptism': 'The practice of baptizing children of believers, based on covenant theology or sacramental regeneration',
    'episcopal polity': 'Church government by bishops in hierarchical succession',
    'presbyterian polity': 'Church government by elders (presbyters) in representative assemblies',
    'congregational polity': 'Church government where each local congregation is self-governing and autonomous'
  };

  private formatResult(result: string | null): SafeHtml {
    if (!result) return '';
    
    console.log('Formatting result:', result);
    let formatted = result;
    
    // Simple word replacement - check each word in the tooltips dictionary
    Object.entries(this.tooltips).forEach(([term, definition]) => {
      // Create a case-insensitive regex that matches the exact term (with word boundaries)
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      
      // Replace all occurrences of the term
      formatted = formatted.replace(regex, (match) => {
        console.log(`Found and replacing: ${match}`);
        return `<span class="tooltip-term" data-tooltip="${definition.replace(/"/g, '&quot;')}">${match}</span>`;
      });
    });
    
    console.log('Formatted HTML:', formatted);
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  private async loadTreeData(): Promise<void> {
    try {
      const response = await fetch('./tree-data.json');
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

  private makeSpecificChildVisible(childId: string, fromNodeId?: string): void {
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
      this.currentResultIcon = clickedNode.icon || null;
      this.currentResultDenomination = clickedNode.denomination || null;
    }
    
    // Animate the fuse effect if we have a source node
    if (fromNodeId) {
      this.animateFuseEffect(fromNodeId, childId);
    }
    
    // Update the tree structure
    this.updateTreeStructure();
    
    // Pan to center the clicked node in the viewport
    setTimeout(() => this.panToNode(childId), 100);
  }

  public setMode(mode: 'quiz' | 'free'): void {
    this.mode = mode;
    
    if (mode === 'free') {
      // In free mode, show all nodes
      this.showAllNodes();
    } else {
      // In quiz mode, reset to guided experience
      this.resetQuiz();
    }
  }

  public toggleHeader(): void {
    this.headerExpanded = !this.headerExpanded;
  }

  public reset(): void {
    this.resetQuiz();
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
    this.currentResult = null;
    this.currentResultIcon = null;
    this.currentResultDenomination = null;
    this.selectedNodeId = null;
    
    // Clear all fuse effects
    this.clearAllFuseEffects();
    
    this.updateTree();
    // Center the root node
    this.panToNode('root');
  }

  private clearAllFuseEffects(): void {
    if (this.g) {
      // Remove all fuse effect groups
      this.g.selectAll('.fuse-effect').remove();
      
      // Remove all fuse gradients
      if (this.svg) {
        this.svg.selectAll('defs linearGradient[id^="fuseGradient"]').remove();
      }
    }
  }

  private panToNode(nodeId: string): void {
    if (!this.svg || !this.g) return;
    
    // Find the node's position in the tree
    const tree = this.setupTreeLayout();
    const root = this.createHierarchy(tree);
    
    const targetNode = root.descendants().find((d: any) => d.data.id === nodeId);
    if (!targetNode) return;
    
    // Calculate the center of the viewport
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Calculate the transform needed to center this node
    const scale = 1; // You can adjust zoom level here
    const x = centerX - targetNode.x * scale;
    const y = centerY - targetNode.y * scale;
    
    // Apply the transform with animation
    const transform = d3.zoomIdentity.translate(x, y).scale(scale);
    
    this.svg.transition()
      .duration(750)
      .call(this.zoom.transform, transform);
  }

  private enablePanZoom(): void {
    if (!this.svg) return;
    
    this.zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });
    
    this.svg.call(this.zoom);
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
    
    // Update button interactivity based on current visibility
    this.updateButtonStates();
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
      .size([this.width * 1.1, dynamicHeight])
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
      .style('cursor', (d: any) => {
        // In quiz mode, only visible nodes are clickable
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return 'default';
        }
        return 'pointer';
      })
      .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))')
      .on('click', (event: any, d: any) => {
        event.stopPropagation();
        // In quiz mode, only allow clicking visible nodes
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        if (d.data.result) {
          selfRef.selectedNodeId = d.data.id;
          selfRef.currentResult = d.data.result;
          selfRef.currentResultIcon = d.data.icon || null;
          selfRef.currentResultDenomination = d.data.denomination || null;
          selfRef.updateSelectedState();
        }
      })
      .on('mouseover', function(this: SVGRectElement, event: any, d: any) {
        // In quiz mode, only visible nodes should have hover effect
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        d3.select(this).interrupt().transition()
          .duration(150)
          .style('stroke-width', 3 * scale)
          .style('filter', 'drop-shadow(0px 6px 16px rgba(168, 85, 247, 0.5))');
      })
      .on('mouseout', function(this: SVGRectElement, event: any, d: any) {
        // In quiz mode, only visible nodes should have hover effect
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        d3.select(this).interrupt().transition()
          .duration(150)
          .style('stroke-width', 2 * scale)
          .style('filter', 'drop-shadow(0px 4px 12px rgba(168, 85, 247, 0.3))');
      });

    // Add circles for denomination results
    const denomNodes = nodeEnter.filter((d: any) => d.data.denomination);
    
    denomNodes
      .append('circle')
      .attr('r', circleRadius)
      .style('fill', (d: any) => d.data.color || '#ffffff')
      .style('stroke', 'none')
      .style('cursor', (d: any) => {
        // In quiz mode, only visible nodes are clickable
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return 'default';
        }
        return 'pointer';
      })
      .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))')
      .on('click', (event: any, d: any) => {
        event.stopPropagation();
        // In quiz mode, only allow clicking visible nodes
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        if (d.data.result) {
          selfRef.selectedNodeId = d.data.id;
          selfRef.currentResult = d.data.result;
          selfRef.currentResultIcon = d.data.icon || null;
          selfRef.currentResultDenomination = d.data.denomination || null;
          selfRef.updateSelectedState();
        }
      })
      .on('mouseover', function(this: SVGCircleElement, event: any, d: any) {
        // In quiz mode, only visible nodes should have hover effect
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        d3.select(this).interrupt().transition()
          .duration(150)
          .attr('r', circleRadius * 1.15)
          .style('filter', 'drop-shadow(0px 8px 16px rgba(0, 0, 0, 0.25))');
      })
      .on('mouseout', function(this: SVGCircleElement, event: any, d: any) {
        // In quiz mode, only visible nodes should have hover effect
        if (selfRef.mode === 'quiz' && !selfRef.visibleNodes.has(d.data.id)) {
          return;
        }
        d3.select(this).interrupt().transition()
          .duration(150)
          .attr('r', circleRadius)
          .style('filter', 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.2))');
      });

    // Add icons for denomination results
    denomNodes
      .filter((d: any) => d.data.icon)
      .append('image')
      .attr('xlink:href', (d: any) => d.data.icon)
      .attr('x', -circleRadius * 1.1)
      .attr('y', -circleRadius * 1.1)
      .attr('width', circleRadius * 2.2)
      .attr('height', circleRadius * 2.2)
      .style('pointer-events', 'none')
      .attr('clip-path', `circle(${circleRadius}px at ${circleRadius * 1.1}px ${circleRadius * 1.1}px)`);

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

    // Add text labels for denominations (below the circle)
    nodeEnter.filter((d: any) => d.data.denomination)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', circleRadius + (20 * scale))
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
            const isParentVisible = selfRef.visibleNodes.has(d.data.id);
            const isClickable = selfRef.mode === 'free' || isParentVisible;
            
            const buttonGroup = nodeGroup.append('g')
              .attr('class', 'answer-button')
              .style('cursor', isClickable ? 'pointer' : 'default')
              .style('opacity', isClickable ? 1 : 0.4)
              .style('display', selfRef.mode === 'free' ? 'none' : 'block')
              .on('click', (event: any) => {
                event.stopPropagation();
                // Check visibility dynamically at click time, not at creation time
                const isCurrentlyVisible = selfRef.visibleNodes.has(d.data.id);
                if (selfRef.mode === 'quiz' && !isCurrentlyVisible) {
                  return;
                }
                selfRef.makeSpecificChildVisible(child.id, d.data.id);
              });

            const yOffset = 60 * scale;
            const xOffset = (index === 0) ? -60 * scale : 60 * scale;

            buttonGroup.append('rect')
              .attr('x', xOffset - (buttonWidth / 2))
              .attr('y', yOffset - (buttonHeight / 2))
              .attr('width', buttonWidth)
              .attr('height', buttonHeight)
              .attr('rx', 16 * scale)
              .style('fill', child.answer === 'Yes' ? '#6366f1' : '#8b5cf6')
              .style('stroke', 'none')
              .style('opacity', 1)
              .style('filter', 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.16))')
              .on('mouseover', function(this: SVGRectElement) {
                const parentGroup = d3.select((this as any).parentNode);
                const isClickable = parentGroup.attr('data-clickable') === 'true';
                if (!isClickable) return;
                d3.select(this).interrupt()
                  .transition()
                  .duration(150)
                  .style('filter', 'drop-shadow(0px 4px 8px rgba(0, 0, 0, 0.24))')
                  .attr('y', yOffset - (buttonHeight / 2) - 2);
              })
              .on('mouseout', function(this: SVGRectElement) {
                const parentGroup = d3.select((this as any).parentNode);
                const isClickable = parentGroup.attr('data-clickable') === 'true';
                if (!isClickable) return;
                d3.select(this).interrupt()
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
    
    // Enable pan and zoom
    this.enablePanZoom();
    
    // Center the root node in the viewport
    setTimeout(() => this.panToNode('root'), 100);
  }

  private updateSelectedState(): void {
    // Update all rectangles (question nodes)
    this.svg.selectAll('.node rect')
      .classed('selected', (d: any) => d.data.id === this.selectedNodeId);
    
    // Update all circles (denomination nodes)
    this.svg.selectAll('.node circle')
      .classed('selected', (d: any) => d.data.id === this.selectedNodeId);
  }

  private updateButtonStates(): void {
    const selfRef = this;
    
    // Update all answer button groups
    this.svg.selectAll('.answer-button')
      .each(function(this: SVGGElement, d: any) {
        const buttonGroup = d3.select(this);
        const parentNodeId = d.data.id;
        const isParentVisible = selfRef.visibleNodes.has(parentNodeId);
        const isClickable = selfRef.mode === 'free' || isParentVisible;
        
        // Update cursor, opacity, display, and clickable state
        buttonGroup
          .style('cursor', isClickable ? 'pointer' : 'default')
          .style('opacity', isClickable ? 1 : 0.4)
          .style('display', selfRef.mode === 'free' ? 'none' : 'block')
          .attr('data-clickable', isClickable ? 'true' : 'false');
      });
  }

  public closeResult(): void {
    this.currentResult = null;
    this.currentResultIcon = null;
    this.currentResultDenomination = null;
    this.selectedNodeId = null;
    this.updateSelectedState();
  }

  private animateFuseEffect(fromNodeId: string, toNodeId: string): void {
    // Find the source and target node positions
    const tree = this.setupTreeLayout();
    const root = this.createHierarchy(tree);
    
    const sourceNode = root.descendants().find((d: any) => d.data.id === fromNodeId);
    const targetNode = root.descendants().find((d: any) => d.data.id === toNodeId);
    
    if (!sourceNode || !targetNode) return;
    
    // Insert the fuse group at the beginning (behind links and nodes)
    const fuseGroup = this.g.insert('g', ':first-child').attr('class', 'fuse-effect');
    
    // Create the glowing fuse line
    const fusePath = fuseGroup.append('path')
      .attr('d', `M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`)
      .style('stroke', 'url(#fuseGradient)')
      .style('stroke-width', 4)
      .style('fill', 'none')
      .style('stroke-linecap', 'round')
      .style('filter', 'drop-shadow(0px 0px 8px rgba(251, 191, 36, 0.8))');
    
    // Create gradient for the fuse effect
    const defs = this.svg.select('defs').empty() 
      ? this.svg.append('defs') 
      : this.svg.select('defs');
    
    const gradient = defs.append('linearGradient')
      .attr('id', 'fuseGradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', sourceNode.x)
      .attr('y1', sourceNode.y)
      .attr('x2', targetNode.x)
      .attr('y2', targetNode.y);
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#fbbf24')
      .attr('stop-opacity', 0);
    
    gradient.append('stop')
      .attr('offset', '30%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 1);
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ef4444')
      .attr('stop-opacity', 0);
    
    // Animate the gradient to create the burning fuse effect
    const totalLength = fusePath.node().getTotalLength();
    
    fusePath
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(600)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0)
      .on('end', () => {
        // Keep the colored line visible - transition to solid color
        fusePath
          .transition()
          .duration(200)
          .style('stroke', '#f59e0b')
          .style('filter', 'none')
          .on('end', () => {
            gradient.remove();
          });
      });
  }
}
