import { Component, Input, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { BibleService, BibleVerse } from '../services/bible.service';
import { ClaudeService } from '../services/claude.service';

export interface ThoughtProvokingItem {
  text: string;
}

export interface ClusterNode {
  id: string;
  label: string;
  section: string;
  verses?: string;
  verseReference?: string; // API reference like "james 1:2-4"
  description: string;
  verseText?: string; // Fetched from API
  theme?: string;
  keywords?: string[];
  thoughtProvoking?: (string | ThoughtProvokingItem)[]; // Support both formats
  color?: string; // Optional custom color
}

export interface OverarchingTheme {
  label: string;
  description: string;
  verseReference?: string;
  verseText?: string;
  content: string;
  keywords?: string[];
}

export interface ClusterData {
  title: string;
  description: string;
  nodes: ClusterNode[];
  overarchingTheme?: OverarchingTheme; // Optional theme node that all nodes merge into
  defaultColors?: { [key: string]: string[] }; // Optional custom color scheme
  layout?: {
    width?: number;
    height?: number;
    nodeRadius?: number;
    linkDistance?: number;
    chargeStrength?: number;
  };
}

@Component({
  selector: 'app-cluster-view',
  templateUrl: './cluster-view.component.html',
  styleUrls: ['./cluster-view.component.css'],
  imports: [CommonModule, FormsModule]
})
export class ClusterViewComponent implements AfterViewInit, OnChanges {
  @Input() clusterData!: ClusterData;
  @ViewChild('clusterContainer', { static: false }) clusterContainer!: ElementRef;

  constructor(
    private bibleService: BibleService,
    private claudeService: ClaudeService
  ) {}

  private svg: any;
  private width = 1200;
  private height = 800;
  private simulation: any;
  private nodeRadius = 60;
  private sectionColors: { [key: string]: string[] } = {};
  
  // Guided mode properties
  isGuidedMode = true;
  currentStep = 0;
  isShowingOverarchingTheme = false;
  
  // Bible API properties
  verseCache = new Map<string, string>();
  isLoadingVerses = false;
  verseLoadError = false;

  // AI Question properties
  showAiModal = false;
  isGeneratingQuestion = false;
  aiQuestion = '';
  aiError = '';
  showApiKeyInput = false;
  apiKeyInput = '';

  getSectionGradient(section: string): string[] {
    if (!this.sectionColors[section]) {
      this.sectionColors = this.clusterData?.defaultColors || this.getDefaultColors();
    }
    return this.sectionColors[section] || ['#8b5cf6', '#6d28d9'];
  }

  ngAfterViewInit() {
    this.renderCluster();
    this.loadVerseContent();
    // Note: showGuidedStep(0) is now called from loadVerseContent after verses load
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['clusterData'] && this.svg) {
      this.loadVerseContent();
      this.renderCluster();
    }
  }

  renderCluster() {
    // Clear existing SVG
    d3.select('#cluster-viz').selectAll('*').remove();

    if (!this.clusterData || !this.clusterData.nodes) return;

    // Apply custom layout settings if provided
    if (this.clusterData.layout) {
      this.width = this.clusterData.layout.width || this.width;
      this.height = this.clusterData.layout.height || this.height;
      this.nodeRadius = this.clusterData.layout.nodeRadius || this.nodeRadius;
    }

    // Use custom colors or defaults
    this.sectionColors = this.clusterData.defaultColors || this.getDefaultColors();

    // Create SVG
    this.svg = d3.select('#cluster-viz')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, this.width, this.height])
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Add gradient definitions dynamically
    const defs = this.svg.append('defs');
    
    Object.entries(this.sectionColors).forEach(([section, colors]) => {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${section}`)
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '100%');
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colors[0]);
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colors[1]);
    });

    // Prepare data with horizontal left-to-right positioning
    const nodeCount = this.clusterData.nodes.length;
    const horizontalSpacing = (this.width * 0.8) / (nodeCount - 1 || 1); // Use 80% of width
    const startX = this.width * 0.1; // Start at 10% from left
    
    const nodes = this.clusterData.nodes.map((node, index) => ({
      ...node,
      x: startX + (index * horizontalSpacing),
      y: this.height / 2,
      fx: startX + (index * horizontalSpacing), // Fix x position to enforce left-to-right
      fy: null // Allow vertical movement
    }));

    // Create links between nodes in sequence
    const links: any[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      links.push({
        source: nodes[i],
        target: nodes[i + 1]
      });
    }

    // Create force simulation with dynamic settings
    const linkDistance = this.clusterData.layout?.linkDistance || 150;
    const chargeStrength = this.clusterData.layout?.chargeStrength || -500;

    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).distance(linkDistance).strength(0.5))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(this.nodeRadius + 20));

    // Add links
    const link = this.svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#64748b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    // Add node groups
    const node = this.svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(this.drag(this.simulation));

    // Add circles
    node.append('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', (d: any) => {
        // Use custom color if provided, otherwise use gradient
        if (d.color) {
          return d.color;
        }
        return `url(#gradient-${d.section})`;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))');

    // Add section labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .attr('fill', '#fff')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .text((d: any) => d.section ? `${d.section}` : d.label);

    // Add verse references with enhanced styling (if available)
    node.each(function(this: SVGGElement, d: any) {
      if (d.verses) {
        const nodeGroup = d3.select(this);
        
        // Add background rectangle for verse reference
        const verseBg = nodeGroup.append('rect')
          .attr('x', -40)
          .attr('y', 5)
          .attr('width', 80)
          .attr('height', 20)
          .attr('rx', 10)
          .attr('fill', 'rgba(255, 255, 255, 0.2)')
          .attr('stroke', 'rgba(255, 255, 255, 0.4)')
          .attr('stroke-width', 1);
        
        // Add verse text with better styling
        nodeGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', 19)
          .attr('fill', '#fff')
          .attr('font-size', '11px')
          .attr('font-weight', '600')
          .attr('letter-spacing', '0.5px')
          .text(d.verses);
      }
    });

    // Define base and expanded radius for use in event handlers
    const baseRadius = this.nodeRadius;
    const expandedRadius = this.nodeRadius + 10;


    // Add theme labels below nodes
    node.each(function(this: SVGGElement, d: any) {
      const textGroup = d3.select(this);
      
      if (d.theme) {
        const themeText = d.theme.split('→')[0].trim();
        textGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', baseRadius + 25)
          .attr('fill', '#e2e8f0')
          .attr('font-size', '13px')
          .attr('font-weight', '600')
          .text(themeText)
      } else {
        textGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', baseRadius + 25)
          .attr('fill', '#e2e8f0')
          .attr('font-size', '13px')
          .attr('font-weight', '600')
          .text(d.label)
      }
    });

    // Add hover effects with dynamic radius
    node.on('mouseenter', function(this: SVGGElement, event: any, d: any) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', expandedRadius);
      
      // Show tooltip with dynamic content and enhanced verse styling
      const tooltip = d3.select('#cluster-tooltip');
      let tooltipHTML = '';
      
      // Section header with verse badge
      if (d.section) {
        tooltipHTML = `<div class="flex items-center justify-between mb-3">
          <div class="font-bold text-lg">Section ${d.section}: ${d.label}</div>`;
        if (d.verses) {
          tooltipHTML += `<div class="inline-flex items-center bg-purple-600/40 border border-purple-400/50 rounded px-2 py-1 ml-2">
            <i class="fas fa-book-open text-purple-200 text-xs mr-1"></i>
            <span class="text-xs font-medium text-purple-100">${d.verses}</span>
          </div>`;
        }
        tooltipHTML += `</div>`;
      } else {
        tooltipHTML = `<div class="flex items-center justify-between mb-3">
          <div class="font-bold text-lg">${d.label}</div>`;
        if (d.verses) {
          tooltipHTML += `<div class="inline-flex items-center bg-purple-600/40 border border-purple-400/50 rounded px-2 py-1 ml-2">
            <i class="fas fa-book-open text-purple-200 text-xs mr-1"></i>
            <span class="text-xs font-medium text-purple-100">${d.verses}</span>
          </div>`;
        }
        tooltipHTML += `</div>`;
      }
      
      tooltipHTML += `<div class="text-sm leading-relaxed">${d.description}</div>`;
      
      if (d.keywords && d.keywords.length > 0) {
        tooltipHTML += `<div class="text-xs mt-3 pt-2 border-t border-purple-500/30 opacity-80">
          <span class="text-purple-300">Keywords:</span> ${d.keywords.join(', ')}
        </div>`;
      }
      
      tooltip.html(tooltipHTML).style('display', 'block');
      
      // Position tooltip with viewport boundary detection
      const tooltipNode = tooltip.node() as HTMLElement;
      const tooltipRect = tooltipNode.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let left = event.pageX + 10;
      let top = event.pageY - 10;
      
      // Check right boundary
      if (left + tooltipRect.width > viewportWidth) {
        left = event.pageX - tooltipRect.width - 10;
      }
      
      // Check bottom boundary
      if (top + tooltipRect.height > viewportHeight) {
        top = event.pageY - tooltipRect.height - 10;
      }
      
      // Check left boundary
      if (left < 0) {
        left = 10;
      }
      
      // Check top boundary
      if (top < 0) {
        top = 10;
      }
      
      tooltip.style('left', left + 'px')
        .style('top', top + 'px');
    })
    .on('mouseleave', function(this: SVGGElement) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', baseRadius);
      
      d3.select('#cluster-tooltip').style('display', 'none');
    })
    .on('click', (event: any, d: any) => {
      // Only allow clicks in free mode
      if (!this.isGuidedMode) {
        this.showNodeDetails(d);
      }
    });

    // Update positions on tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  private drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  getCurrentVerse(): string {
    if (!this.clusterData?.nodes || this.currentStep >= this.clusterData.nodes.length) {
      return '';
    }
    return this.clusterData.nodes[this.currentStep].verses || '';
  }

  /**
   * Load verse content from Bible API for all nodes
   */
  private loadVerseContent(): void {
    if (!this.clusterData?.nodes) {
      return;
    }

    this.isLoadingVerses = true;
    
    // Get all unique verse references
    const references = this.clusterData.nodes
      .filter(node => node.verseReference)
      .map(node => node.verseReference!);

    if (references.length === 0) {
      this.isLoadingVerses = false;
      return;
    }

    // Fetch verses from API
    this.bibleService.getMultipleVerses(references).subscribe({
      next: (results) => {
        // Update nodes with fetched verse text
        this.clusterData.nodes.forEach(node => {
          if (node.verseReference && results[node.verseReference]) {
            const bibleVerse = results[node.verseReference];
            if (bibleVerse) {
              node.verseText = this.bibleService.getFormattedVerseText(bibleVerse);
              this.verseCache.set(node.verseReference, node.verseText);
            }
          }
        });
        
        this.isLoadingVerses = false;
        // Re-render to show updated verse content
        this.renderCluster();
        
        // If in guided mode and this is the initial load, show the first step
        if (this.isGuidedMode && this.currentStep === 0) {
          setTimeout(() => this.showGuidedStep(0), 200);
        }
        
        // If detail panel is open, refresh it with new verse content
        const detailPanel = d3.select('#detail-panel');
        if (!detailPanel.classed('hidden')) {
          // Find the currently displayed node and refresh its details
          const currentNode = this.clusterData.nodes[this.currentStep];
          if (currentNode) {
            this.showNodeDetails(currentNode);
          }
        }
      },
      error: (error) => {
        console.error('Failed to load verse content:', error);
        this.isLoadingVerses = false;
        this.verseLoadError = true;
        
        // Show user-friendly error message
        this.showVerseLoadError();
      }
    });
  }

  /**
   * Get verse text for a node (from cache or API)
   */
  getVerseText(node: ClusterNode): string {
    if (node.verseText) {
      return node.verseText;
    }
    
    if (node.verseReference && this.verseCache.has(node.verseReference)) {
      return this.verseCache.get(node.verseReference)!;
    }
    
    return node.description; // Fallback to description
  }

  /**
   * Show error message for verse loading failure
   */
  private showVerseLoadError(): void {
    // Could implement toast notification or modal here
    console.warn('Unable to load Bible verses. Check your internet connection.');
  }

  /**
   * Retry loading verse content
   */
  retryLoadVerses(): void {
    this.verseLoadError = false;
    this.verseCache.clear(); // Clear cache to force fresh API calls
    this.loadVerseContent();
  }

  toggleMode() {
    this.isGuidedMode = !this.isGuidedMode;
    this.isShowingOverarchingTheme = false;
    if (this.isGuidedMode) {
      this.currentStep = 0;
      // Only show guided step if verses are already loaded
      if (!this.isLoadingVerses && this.clusterData?.nodes?.some(n => n.verseText)) {
        this.showGuidedStep(0);
      }
    } else {
      this.resetGuidedMode();
    }
  }

  nextStep() {
    if (this.isShowingOverarchingTheme) {
      return; // Already at final step
    }
    
    if (this.currentStep < this.clusterData.nodes.length - 1) {
      this.currentStep++;
      this.showGuidedStep(this.currentStep);
    } else if (this.clusterData.overarchingTheme && !this.isShowingOverarchingTheme) {
      // Transition to overarching theme
      this.showOverarchingTheme();
    }
  }

  previousStep() {
    if (this.isShowingOverarchingTheme) {
      // Go back from overarching theme to last node
      this.isShowingOverarchingTheme = false;
      this.currentStep = this.clusterData.nodes.length - 1;
      // Re-render the cluster to restore all nodes
      this.renderCluster();
      // Then show the last step
      setTimeout(() => this.showGuidedStep(this.currentStep), 300);
    } else if (this.currentStep > 0) {
      this.currentStep--;
      this.showGuidedStep(this.currentStep);
    }
  }

  private showGuidedStep(stepIndex: number) {
    if (!this.clusterData?.nodes || stepIndex >= this.clusterData.nodes.length) {
      return;
    }
    
    const node = this.clusterData.nodes[stepIndex];
    
    // Check if SVG nodes exist before trying to filter
    const allNodes = d3.selectAll('#cluster-viz g').filter((d: any) => d && d.id);
    if (allNodes.empty()) {
      // SVG not ready, try again
      setTimeout(() => this.showGuidedStep(stepIndex), 200);
      return;
    }
    
    // Dim all nodes
    allNodes
      .transition()
      .duration(300)
      .style('opacity', 0.2);
    
    // Highlight current node
    allNodes
      .filter((d: any) => d.id === node.id)
      .transition()
      .duration(300)
      .style('opacity', 1);
    
    // Auto-show details for current step
    this.showNodeDetails(node);
  }

  private resetGuidedMode() {
    // Reset all nodes to full opacity
    d3.selectAll('#cluster-viz g')
      .transition()
      .duration(300)
      .style('opacity', 1);
    
    // Hide detail panel
    d3.select('#detail-panel').classed('hidden', true);
  }

  private showNodeDetails(node: ClusterNode) {
    // Get the detail panel
    const panel = d3.select('#detail-panel')
      .classed('hidden', false)
      .html(''); // Clear existing content
    
    const content = panel.append('div')
      .attr('class', 'p-6');

    // Header
    const headerDiv = content.append('div')
      .attr('class', 'flex justify-between items-start mb-4');
    
    const headerContent = headerDiv.append('div');
    
    headerContent.append('h2')
      .attr('class', 'text-2xl font-bold text-white mb-2')
      .text(node.label);
    
    if (node.verses) {
      headerContent.append('div')
        .attr('class', 'flex items-center gap-2 mb-1')
        .html(`
          <div class="inline-flex items-center bg-purple-600/30 border border-purple-500/50 rounded-full px-3 py-1">
            <i class="fas fa-book-open text-purple-300 text-xs mr-2"></i>
            <span class="text-sm font-semibold text-purple-100">${node.verses}</span>
          </div>
        `);
    }
    
    // Close button (only in free mode)
    if (!this.isGuidedMode) {
      headerDiv.append('button')
        .attr('class', 'text-slate-400 hover:text-white text-2xl')
        .html('&times;')
        .on('click', () => {
          panel.classed('hidden', true);
        });
    }

    // Theme
    if (node.theme) {
      content.append('div')
        .attr('class', 'bg-slate-700 rounded p-3 mb-4')
        .html(`<div class="text-sm font-semibold text-slate-300 mb-1">Theme:</div>
               <div class="text-white">${node.theme}</div>`);
    }

    // Bible verse content (if available from API)
    const verseText = this.getVerseText(node);
    if (verseText && verseText !== node.description) {
      content.append('div')
        .attr('class', 'bg-slate-700/30 border border-slate-600 rounded-lg p-4 mb-4')
        .html(`
          <div class="flex items-center gap-2 mb-3">
            <i class="fas fa-bible text-purple-400"></i>
            <span class="text-sm font-semibold text-purple-300">Scripture Text</span>
            ${this.isLoadingVerses ? '<i class="fas fa-spinner fa-spin text-purple-400 ml-2"></i>' : ''}
          </div>
          <div class="text-slate-100 leading-relaxed" style="line-height: 1.6;">
            ${this.isLoadingVerses ? 
              'Loading verse content...' : 
              (this.verseLoadError ? 
                `<div class="flex items-center gap-2 text-amber-300">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>Unable to load verse content. <button onclick="this.closest('.cluster-view').retryLoadVerses()" class="underline hover:text-amber-200">Retry</button></span>
                </div>` : 
                verseText)
            }
          </div>
        `);
    }

    // Navigation buttons for guided mode, close button for free mode
    if (this.isGuidedMode) {
      const navDiv = content.append('div')
        .attr('class', 'flex gap-2 mt-4');
      
      const isAtStart = this.currentStep === 0;
      const isAtLastNode = this.currentStep === this.clusterData.nodes.length - 1;
      const hasOverarchingTheme = !!this.clusterData.overarchingTheme;
      
      navDiv.append('button')
        .attr('class', `flex-1 ${isAtStart ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white py-2 px-4 rounded transition`)
        .attr('disabled', isAtStart ? 'true' : null)
        .text('← Previous')
        .on('click', () => {
          if (!isAtStart) this.previousStep();
        });
      
      navDiv.append('button')
        .attr('class', `flex-1 ${isAtLastNode && !hasOverarchingTheme ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white py-2 px-4 rounded transition`)
        .attr('disabled', isAtLastNode && !hasOverarchingTheme ? 'true' : null)
        .html(isAtLastNode && hasOverarchingTheme ? 'See Overarching Theme →' : 'Next →')
        .on('click', () => {
          if (isAtLastNode && hasOverarchingTheme) {
            this.showOverarchingTheme();
          } else if (!isAtLastNode) {
            this.nextStep();
          }
        });
    } else {
      // In free mode, check if this is the last node
      const isLastNode = node.id === this.clusterData.nodes[this.clusterData.nodes.length - 1].id;
      const hasOverarchingTheme = !!this.clusterData.overarchingTheme;
      
      if (isLastNode && hasOverarchingTheme) {
        // Show button to view overarching theme
        content.append('button')
          .attr('class', 'mt-4 w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 font-semibold')
          .html('<i class="fas fa-unity"></i><span>See Overarching Theme</span>')
          .on('click', () => {
            this.showOverarchingTheme();
          });
      }
      
      content.append('button')
        .attr('class', 'mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded transition')
        .text('Close')
        .on('click', () => {
          panel.classed('hidden', true);
        });
    }
  }

  private getDefaultColors(): { [key: string]: string[] } {
    return {
      'A': ['#ec4899', '#be185d'], // pink
      'B': ['#8b5cf6', '#6d28d9'], // purple
      'C': ['#3b82f6', '#1e40af'], // blue
      'D': ['#f59e0b', '#d97706'], // amber
      'E': ['#10b981', '#047857'], // green
      'F': ['#06b6d4', '#0891b2'], // cyan
      'G': ['#f43f5e', '#e11d48'], // rose
      'H': ['#a855f7', '#9333ea'], // violet
      'I': ['#14b8a6', '#0d9488'], // teal
      'J': ['#fb923c', '#f97316']  // orange
    };
  }

  /**
   * Get thought-provoking prompts for the current node
   */
  getCurrentNodePrompts(): ThoughtProvokingItem[] {
    if (!this.clusterData?.nodes || this.currentStep >= this.clusterData.nodes.length) {
      return [];
    }
    
    const node = this.clusterData.nodes[this.currentStep];
    if (!node.thoughtProvoking) {
      return [];
    }

    // Convert to unified format
    return node.thoughtProvoking.map(item => {
      if (typeof item === 'string') {
        return { text: item };
      }
      return { text: item.text };
    });
  }



  /**
   * Generate AI question for current node
   */
  async generateAiQuestion(): Promise<void> {

    const currentNode = this.clusterData.nodes[this.currentStep];
    if (!currentNode) {
      this.aiError = 'No node selected';
      this.showAiModal = true;
      return;
    }

    // Check if verse text is available
    if (!currentNode.verseText) {
      // Try to use description as fallback if verseText isn't loaded yet
      if (!currentNode.description || !currentNode.verseReference) {
        this.aiError = 'No scripture text available for this node. Verse reference: ' + (currentNode.verseReference || 'none');
        this.showAiModal = true;
        return;
      }
      // Use description as fallback
      this.showAiModal = true;
      this.isGeneratingQuestion = true;
      this.aiError = '';
      this.aiQuestion = '';

      try {
        this.aiQuestion = await this.claudeService.generateQuestion(
          currentNode.description,
          currentNode.verseReference
        );
      } catch (error: any) {
        this.aiError = error.message || 'Failed to generate question';
      } finally {
        this.isGeneratingQuestion = false;
      }
      return;
    }

    this.showAiModal = true;
    this.isGeneratingQuestion = true;
    this.aiError = '';
    this.aiQuestion = '';

    try {
      this.aiQuestion = await this.claudeService.generateQuestion(
        currentNode.verseText,
        currentNode.verseReference || currentNode.verses || ''
      );
    } catch (error: any) {
      this.aiError = error.message || 'Failed to generate question';
    } finally {
      this.isGeneratingQuestion = false;
    }
  }

  /**
   * Save API key and generate question
   */
  async saveApiKey(): Promise<void> {
    if (!this.apiKeyInput.trim()) {
      this.aiError = 'Please enter a valid API key';
      return;
    }
    
    this.showApiKeyInput = false;
    this.apiKeyInput = '';
    
    // Now generate the question
    await this.generateAiQuestion();
  }

  /**
   * Close AI modal
   */
  closeAiModal(): void {
    this.showAiModal = false;
    this.aiQuestion = '';
    this.aiError = '';
    this.showApiKeyInput = false;
  }

  /**
   * Show the overarching theme with merging animation
   */
  showOverarchingTheme(): void {
    if (!this.clusterData?.overarchingTheme) return;
    
    this.isShowingOverarchingTheme = true;
    
    const allNodes = d3.selectAll('#cluster-viz g').filter((d: any) => d && d.id);
    if (allNodes.empty()) return;
    
    // Get center position
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Animate all nodes to center and fade out
    allNodes
      .transition()
      .duration(1000)
      .attr('transform', `translate(${centerX},${centerY})`)
      .style('opacity', 0);
    
    // Fade out all links
    d3.selectAll('#cluster-viz line')
      .transition()
      .duration(800)
      .style('opacity', 0);
    
    // After merge animation, create the overarching theme node
    setTimeout(() => {
      // Remove old nodes
      allNodes.remove();
      d3.selectAll('#cluster-viz line').remove();
      
      // Create central theme node
      const themeNodeGroup = this.svg.append('g')
        .attr('transform', `translate(${centerX},${centerY})`)
        .style('opacity', 0);
      
      // Large central circle with gradient
      const themeGradient = this.svg.select('defs').append('radialGradient')
        .attr('id', 'theme-gradient')
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '50%');
      
      themeGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#a78bfa')
        .attr('stop-opacity', 1);
      
      themeGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#7c3aed')
        .attr('stop-opacity', 1);
      
      const themeRadius = this.nodeRadius * 1.8;
      themeNodeGroup.append('circle')
        .attr('r', themeRadius)
        .attr('fill', 'url(#theme-gradient)')
        .attr('stroke', '#fff')
        .attr('stroke-width', 4)
        .style('filter', 'drop-shadow(0 8px 24px rgba(139, 92, 246, 0.5))');
      
      // Add pulsing animation ring
      const pulseRing = themeNodeGroup.append('circle')
        .attr('r', themeRadius)
        .attr('fill', 'none')
        .attr('stroke', '#a78bfa')
        .attr('stroke-width', 2)
        .style('opacity', 0.8);
      
      // Pulse animation
      const pulse = () => {
        pulseRing
          .transition()
          .duration(2000)
          .attr('r', themeRadius + 30)
          .style('opacity', 0)
          .on('end', () => {
            pulseRing.attr('r', themeRadius).style('opacity', 0.8);
            pulse();
          });
      };
      pulse();
      
      // Add icon
      themeNodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', -15)
        .attr('fill', '#fff')
        .attr('font-size', '32px')
        .attr('class', 'fas')
        .text('\uf674'); // fa-unity icon
      
      // Add label
      themeNodeGroup.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 20)
        .attr('fill', '#fff')
        .attr('font-size', '20px')
        .attr('font-weight', 'bold')
        .text(this.clusterData.overarchingTheme!.label);
      
      // Fade in the theme node
      themeNodeGroup
        .transition()
        .duration(800)
        .style('opacity', 1);
      
      // Show details
      this.showOverarchingThemeDetails();
    }, 1000);
  }

  /**
   * Reset from overarching theme back to normal visualization
   */
  private resetFromOverarchingTheme(): void {
    this.isShowingOverarchingTheme = false;
    d3.select('#detail-panel').classed('hidden', true);
    this.renderCluster();
  }

  /**
   * Show details panel for overarching theme
   */
  private showOverarchingThemeDetails(): void {
    if (!this.clusterData?.overarchingTheme) return;
    
    const theme = this.clusterData.overarchingTheme;
    const panel = d3.select('#detail-panel')
      .classed('hidden', false)
      .html('');
    
    const content = panel.append('div')
      .attr('class', 'p-6');
    
    // Header with special styling for theme
    const headerDiv = content.append('div')
      .attr('class', 'mb-6');
    
    headerDiv.append('div')
      .attr('class', 'flex items-center gap-3 mb-3')
      .html(`
        <i class="fas fa-unity text-3xl text-purple-400"></i>
        <h2 class="text-3xl font-bold text-white">${theme.label}</h2>
      `);
    
    headerDiv.append('p')
      .attr('class', 'text-slate-300 text-sm leading-relaxed')
      .text(theme.description);
    
    if (theme.verseReference) {
      headerDiv.append('div')
        .attr('class', 'mt-3')
        .html(`
          <div class="inline-flex items-center bg-purple-600/30 border border-purple-500/50 rounded-full px-3 py-1">
            <i class="fas fa-book-open text-purple-300 text-xs mr-2"></i>
            <span class="text-sm font-semibold text-purple-100">${theme.verseReference}</span>
          </div>
        `);
    }
    
    // Main content
    content.append('div')
      .attr('class', 'bg-slate-700/30 border-l-4 border-purple-500 rounded-lg p-5 mb-4')
      .html(`
        <div class="text-slate-100 leading-relaxed" style="line-height: 1.8;">
          ${theme.content}
        </div>
      `);
    
    // Keywords if available
    if (theme.keywords && theme.keywords.length > 0) {
      content.append('div')
        .attr('class', 'flex flex-wrap gap-2 mb-4')
        .selectAll('span')
        .data(theme.keywords)
        .join('span')
        .attr('class', 'px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-sm text-purple-200')
        .text((d: string) => d);
    }
    
    // Summary of all nodes
    content.append('div')
      .attr('class', 'mt-6 pt-6 border-t border-purple-500/30')
      .html(`
        <div class="flex items-center gap-2 mb-4">
          <i class="fas fa-project-diagram text-purple-400"></i>
          <h3 class="text-lg font-semibold text-white">Connected Themes</h3>
        </div>
      `);
    
    const nodesList = content.append('div')
      .attr('class', 'grid grid-cols-1 gap-3');
    
    this.clusterData.nodes.forEach((node, index) => {
      const colors = this.getSectionGradient(node.section);
      nodesList.append('div')
        .attr('class', 'flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-purple-500/50 transition')
        .html(`
          <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" 
               style="background: linear-gradient(135deg, ${colors[0]}, ${colors[1]});">
            ${node.section || (index + 1)}
          </div>
          <div class="flex-1">
            <div class="font-semibold text-white text-sm">${node.label}</div>
            ${node.verses ? `<div class="text-xs text-slate-400 mt-0.5">${node.verses}</div>` : ''}
          </div>
        `);
    });
    
    // Navigation
    const navDiv = content.append('div')
      .attr('class', 'flex gap-2 mt-6');
    
    if (this.isGuidedMode) {
      navDiv.append('button')
        .attr('class', 'flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition')
        .text('← Previous')
        .on('click', () => this.previousStep());
      
      navDiv.append('button')
        .attr('class', 'flex-1 bg-slate-700 opacity-50 cursor-not-allowed text-white py-2 px-4 rounded')
        .attr('disabled', 'true')
        .text('Complete');
    } else {
      navDiv.append('button')
        .attr('class', 'w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded transition')
        .text('← Back to Visualization')
        .on('click', () => this.resetFromOverarchingTheme());
    }
  }
}
