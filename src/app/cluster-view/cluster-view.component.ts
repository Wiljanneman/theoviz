import { Component, Input, AfterViewInit, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { BibleService, BibleVerse } from '../services/bible.service';

export interface ThoughtProvokingItem {
  type: 'discover' | 'apply' | 'reframe' | 'become';
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

export interface ClusterData {
  title: string;
  description: string;
  nodes: ClusterNode[];
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
  imports: [CommonModule]
})
export class ClusterViewComponent implements AfterViewInit, OnChanges {
  @Input() clusterData!: ClusterData;
  @ViewChild('clusterContainer', { static: false }) clusterContainer!: ElementRef;

  constructor(private bibleService: BibleService) {}

  private svg: any;
  private width = 1200;
  private height = 800;
  private simulation: any;
  private nodeRadius = 60;
  private sectionColors: { [key: string]: string[] } = {};
  
  // Guided mode properties
  isGuidedMode = true;
  currentStep = 0;
  
  // Bible API properties
  verseCache = new Map<string, string>();
  isLoadingVerses = false;
  verseLoadError = false;

  // Flip card properties
  flippedCards = new Set<number>();
  modalCardIndex: number | null = null;
  showCardHelp = false;

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
      
      tooltip.style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .html(tooltipHTML);
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
    this.flippedCards.clear(); // Reset flipped cards
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
    if (this.currentStep < this.clusterData.nodes.length - 1) {
      this.currentStep++;
      this.flippedCards.clear(); // Reset flipped cards
      this.showGuidedStep(this.currentStep);
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.flippedCards.clear(); // Reset flipped cards
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

    // Thought-Provoking Prompts (Collapsible)
    if (node.thoughtProvoking && node.thoughtProvoking.length > 0) {
      const promptSection = content.append('div')
        .attr('class', 'mb-4 border-t border-slate-700 pt-4');
      
      const promptHeader = promptSection.append('button')
        .attr('class', 'w-full flex justify-between items-center bg-slate-700/50 hover:bg-slate-700 rounded-lg p-3 transition text-left')
        .on('click', function(this: HTMLButtonElement) {
          const parent = this.parentNode as HTMLElement;
          const promptsDiv = d3.select(parent).select('.thought-prompts');
          const icon = d3.select(this).select('i');
          const isHidden = promptsDiv.classed('hidden');
          
          promptsDiv.classed('hidden', !isHidden);
          icon.classed('fa-chevron-down', isHidden);
          icon.classed('fa-chevron-up', !isHidden);
        });

      promptHeader.append('div')
        .html('<i class="fas fa-lightbulb mr-2 text-amber-400"></i><span class="font-semibold text-white">Reflect & Consider</span><span class="ml-2 text-xs text-slate-400">(' + node.thoughtProvoking.length + ' prompts)</span>');

      promptHeader.append('i')
        .attr('class', 'fas fa-chevron-down text-slate-400');

      const promptsDiv = promptSection.append('div')
        .attr('class', 'thought-prompts hidden mt-3 space-y-3');

      node.thoughtProvoking.forEach((item: string | ThoughtProvokingItem, index: number) => {
        const promptItem = promptsDiv.append('div')
          .attr('class', 'flex gap-3');
        
        // Determine item type and text
        let itemType: string;
        let itemText: string;
        let iconClass: string;
        let iconColor: string;
        
        if (typeof item === 'string') {
          // Legacy format - try to detect type from text
          if (item.toLowerCase().startsWith('notice') || item.toLowerCase().startsWith('observe')) {
            itemType = 'discover';
            iconClass = 'fa-eye';
            iconColor = 'text-blue-400';
          } else if (item.toLowerCase().startsWith('practice') || item.toLowerCase().startsWith('apply')) {
            itemType = 'apply';
            iconClass = 'fa-hands';
            iconColor = 'text-green-400';
          } else if (item.toLowerCase().startsWith('this reframes') || item.toLowerCase().startsWith('reframe')) {
            itemType = 'reframe';
            iconClass = 'fa-lightbulb';
            iconColor = 'text-amber-400';
          } else {
            itemType = 'become';
            iconClass = 'fa-seedling';
            iconColor = 'text-emerald-400';
          }
          itemText = item;
        } else {
          // Structured format
          itemType = item.type;
          itemText = item.text;
          
          switch (item.type) {
            case 'discover':
              iconClass = 'fa-eye';
              iconColor = 'text-blue-400';
              break;
            case 'apply':
              iconClass = 'fa-hands';
              iconColor = 'text-green-400';
              break;
            case 'reframe':
              iconClass = 'fa-lightbulb';
              iconColor = 'text-amber-400';
              break;
            case 'become':
              iconClass = 'fa-seedling';
              iconColor = 'text-emerald-400';
              break;
          }
        }
        
        // Icon
        promptItem.append('div')
          .attr('class', 'flex-shrink-0 mt-1')
          .html(`<i class=\"fas ${iconClass} ${iconColor}\"></i>`);
        
        // Content
        const contentDiv = promptItem.append('div')
          .attr('class', 'flex-1');
        
        contentDiv.append('div')
          .attr('class', 'text-xs font-semibold uppercase tracking-wide mb-1')
          .attr('style', () => {
            switch (itemType) {
              case 'observe': return 'color: #60a5fa';
              case 'consider': return 'color: #c084fc';
              case 'reflect': return 'color: #fb7185';
              case 'question': return 'color: #fbbf24';
              default: return 'color: #94a3b8';
            }
          })
          .text(itemType.charAt(0).toUpperCase() + itemType.slice(1));
        
        contentDiv.append('div')
          .attr('class', 'text-slate-200 leading-relaxed')
          .text(itemText);
      });
    }

    // Navigation buttons for guided mode, close button for free mode
    if (this.isGuidedMode) {
      const navDiv = content.append('div')
        .attr('class', 'flex gap-2 mt-4');
      
      navDiv.append('button')
        .attr('class', `flex-1 ${this.currentStep === 0 ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white py-2 px-4 rounded transition`)
        .attr('disabled', this.currentStep === 0 ? 'true' : null)
        .text('← Previous')
        .on('click', () => {
          if (this.currentStep > 0) this.previousStep();
        });
      
      navDiv.append('button')
        .attr('class', `flex-1 ${this.currentStep === this.clusterData.nodes.length - 1 ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white py-2 px-4 rounded transition`)
        .attr('disabled', this.currentStep === this.clusterData.nodes.length - 1 ? 'true' : null)
        .text('Next →')
        .on('click', () => {
          if (this.currentStep < this.clusterData.nodes.length - 1) this.nextStep();
        });
    } else {
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

    // Convert to structured format if needed
    return node.thoughtProvoking.map(item => {
      if (typeof item === 'string') {
        // Legacy format - try to detect type
        let type: 'discover' | 'apply' | 'reframe' | 'become' = 'discover';
        if (item.toLowerCase().startsWith('practice') || item.toLowerCase().startsWith('apply')) {
          type = 'apply';
        } else if (item.toLowerCase().startsWith('this reframes') || item.toLowerCase().startsWith('reframe')) {
          type = 'reframe';
        } else if (item.toLowerCase().startsWith('are you becoming')) {
          type = 'become';
        }
        return { type, text: item };
      }
      return item;
    });
  }

  /**
   * Get icon class for prompt type
   */
  getPromptIcon(type: string): string {
    switch (type) {
      case 'discover':
        return 'fa-eye';
      case 'apply':
        return 'fa-hands';
      case 'reframe':
        return 'fa-lightbulb';
      case 'become':
        return 'fa-seedling';
      default:
        return 'fa-lightbulb';
    }
  }

  /**
   * Get display label and subtext for prompt type
   */
  getPromptLabel(type: string): { label: string; subtext: string } {
    const labels: { [key: string]: { label: string; subtext: string } } = {
      'discover': { label: 'Discover', subtext: 'Propositional' },
      'apply': { label: 'Apply', subtext: 'Procedural' },
      'reframe': { label: 'Reframe', subtext: 'Perspectival' },
      'become': { label: 'Become', subtext: 'Participatory' }
    };
    return labels[type] || { label: type, subtext: '' };
  }

  /**
   * Toggle flip card state
   */
  toggleCard(index: number): void {
    this.modalCardIndex = index;
  }

  closeModal(): void {
    this.modalCardIndex = null;
  }
}
