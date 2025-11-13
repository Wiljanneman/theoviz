import { Injectable } from '@angular/core';
import Shepherd from 'shepherd.js';

@Injectable({
  providedIn: 'root'
})
export class TutorialService {
  private tour: any = null;
  private readonly STORAGE_KEY = 'hasSeenDenominationQuizTutorial';

  constructor() {}

  hasSeenTutorial(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  markTutorialAsSeen(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
  }

  resetTutorial(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  startTutorial(): void {
    if (this.tour) {
      this.tour.cancel();
    }

    this.tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true
        },
        classes: 'shepherd-theme-custom',
        scrollTo: { behavior: 'smooth', block: 'center' }
      }
    });

    // Step 1: Welcome
    this.tour.addStep({
      id: 'welcome',
      text: `
        <h3 class="shepherd-title">Welcome to the Denomination Flow Chart!</h3>
        <p>This interactive visualization helps you explore Christian denominations based on theological beliefs.</p>
        <p>Let's take a quick tour of the features.</p>
      `,
      buttons: [
        {
          text: 'Skip',
          action: () => {
            this.markTutorialAsSeen();
            this.tour?.cancel();
          },
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 2: Header Drawer
    this.tour.addStep({
      id: 'header',
      attachTo: {
        element: '.drawer-card',
        on: 'bottom'
      },
      text: `
        <h3 class="shepherd-title">Header Panel</h3>
        <p>This panel contains important controls:</p>
        <ul>
          <li><strong>Quiz Mode</strong>: Guided step-by-step questions</li>
          <li><strong>Free Mode</strong>: Explore the entire tree freely</li>
        </ul>
        <p>You can collapse this panel using the arrow button.</p>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 3: Question Nodes
    this.tour.addStep({
      id: 'question-node',
      text: `
        <h3 class="shepherd-title">Question Nodes</h3>
        <p>The purple rectangles are theological questions. Click any visible question to read more details about what it means.</p>
        <p>Each question represents a historic point of division in Christian tradition.</p>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 4: Answer Buttons (Quiz Mode)
    this.tour.addStep({
      id: 'answer-buttons',
      text: `
        <h3 class="shepherd-title">Answering Questions (Quiz Mode)</h3>
        <p>In <strong>Quiz Mode</strong>, you'll see colored buttons below each active question:</p>
        <ul>
          <li><strong>Blue button</strong>: "Yes" answer</li>
          <li><strong>Purple button</strong>: "No" answer</li>
        </ul>
        <p>Click a button to answer and reveal the next question in your path.</p>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 5: Free Mode
    this.tour.addStep({
      id: 'free-mode',
      attachTo: {
        element: '.mode-toggle',
        on: 'bottom'
      },
      text: `
        <h3 class="shepherd-title">Free Mode Exploration</h3>
        <p>Switch to <strong>Free Mode</strong> to see the entire decision tree at once.</p>
        <p>In Free Mode:</p>
        <ul>
          <li>All nodes are visible</li>
          <li>Answer labels appear on the connecting lines</li>
          <li>You can explore any path freely</li>
        </ul>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 6: Navigation
    this.tour.addStep({
      id: 'navigation',
      text: `
        <h3 class="shepherd-title">Navigation Controls</h3>
        <p>You can navigate the visualization using:</p>
        <ul>
          <li><strong>Scroll</strong> or <strong>pinch</strong> to zoom in/out</li>
          <li><strong>Click and drag</strong> to pan around</li>
          <li>The tree will auto-focus on active questions in Quiz Mode</li>
        </ul>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Next',
          action: this.tour.next
        }
      ]
    });

    // Step 7: Denomination Results
    this.tour.addStep({
      id: 'results',
      text: `
        <h3 class="shepherd-title">Denomination Results</h3>
        <p>At the end of each path, you'll find denomination circles with icons.</p>
        <p>Click any denomination to learn more about that Christian tradition.</p>
        <p>The denomination name appears below the icon.</p>
      `,
      buttons: [
        {
          text: 'Back',
          action: this.tour.back,
          classes: 'shepherd-button-secondary'
        },
        {
          text: 'Finish',
          action: () => {
            this.markTutorialAsSeen();
            this.tour?.complete();
          }
        }
      ]
    });

    this.tour.start();
  }

  cancelTour(): void {
    if (this.tour) {
      this.tour.cancel();
      this.tour = null;
    }
  }
}
