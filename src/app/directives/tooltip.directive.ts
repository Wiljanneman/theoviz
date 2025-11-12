import { Directive, ElementRef, HostListener, Input, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') tooltipText: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  
  private tooltipElement: HTMLElement | null = null;
  private showTimeout: any;
  private hideTimeout: any;

  constructor(private el: ElementRef, private renderer: Renderer2) {
    // Add dotted underline styling to the host element
    this.renderer.setStyle(this.el.nativeElement, 'text-decoration', 'underline');
    this.renderer.setStyle(this.el.nativeElement, 'text-decoration-style', 'dotted');
    this.renderer.setStyle(this.el.nativeElement, 'text-decoration-color', 'rgb(168, 85, 247)');
    this.renderer.setStyle(this.el.nativeElement, 'text-decoration-thickness', '1px');
    this.renderer.setStyle(this.el.nativeElement, 'text-underline-offset', '2px');
    this.renderer.setStyle(this.el.nativeElement, 'cursor', 'help');
  }

  @HostListener('mouseenter') onMouseEnter() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    this.showTimeout = setTimeout(() => {
      this.showTooltip();
    }, 200); // Small delay before showing
  }

  @HostListener('mouseleave') onMouseLeave() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }
    
    this.hideTimeout = setTimeout(() => {
      this.hideTooltip();
    }, 100);
  }

  private showTooltip() {
    if (!this.tooltipText || this.tooltipElement) return;

    // Create tooltip element
    this.tooltipElement = this.renderer.createElement('div');
    
    // Add Tailwind classes for styling
    const classes = [
      'absolute', 'z-[9999]', 'px-3', 'py-2', 'text-sm', 'text-white',
      'bg-slate-900', 'rounded-lg', 'shadow-xl', 'border', 'border-purple-500/50',
      'backdrop-blur-sm', 'max-w-xs', 'pointer-events-none',
      'animate-fade-in', 'whitespace-normal', 'leading-relaxed'
    ];
    
    classes.forEach(className => {
      this.renderer.addClass(this.tooltipElement, className);
    });

    // Set tooltip text
    const text = this.renderer.createText(this.tooltipText);
    this.renderer.appendChild(this.tooltipElement, text);

    // Append to body
    this.renderer.appendChild(document.body, this.tooltipElement);

    // Position tooltip
    this.positionTooltip();
  }

  private positionTooltip() {
    if (!this.tooltipElement) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    let top = 0;
    let left = 0;

    switch (this.tooltipPosition) {
      case 'top':
        top = hostRect.top - tooltipRect.height - 8;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + 8;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + 8;
        break;
    }

    // Adjust if tooltip goes off-screen
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = hostRect.top - tooltipRect.height - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private hideTooltip() {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy() {
    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTooltip();
  }
}
