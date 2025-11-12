import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TreeNode {
  id: string;
  question?: string;
  answer?: string;
  denomination?: string;
  color?: string;
  result?: string;
  children?: TreeNode[];
}

interface TreeNodeEdit extends TreeNode {
  expanded?: boolean;
  level?: number;
}

@Component({
  selector: 'app-tree-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './tree-editor.component.html',
  styleUrl: './tree-editor.component.css'
})
export class TreeEditorComponent implements OnInit {
  treeData: TreeNodeEdit | null = null;
  flattenedNodes: TreeNodeEdit[] = [];
  selectedNode: TreeNodeEdit | null = null;

  ngOnInit(): void {
    this.loadTreeData();
  }

  private async loadTreeData(): Promise<void> {
    try {
      const response = await fetch('./theoviz/tree-data.json');
      this.treeData = await response.json();
      this.updateFlattenedNodes();
    } catch (error) {
      console.error('Failed to load tree data:', error);
    }
  }

  private updateFlattenedNodes(): void {
    this.flattenedNodes = [];
    if (this.treeData) {
      this.flattenNode(this.treeData, 0);
    }
  }

  private flattenNode(node: TreeNodeEdit, level: number): void {
    node.level = level;
    node.expanded = node.expanded ?? true; // Default to expanded
    this.flattenedNodes.push(node);
    
    if (node.expanded && node.children) {
      node.children.forEach(child => this.flattenNode(child as TreeNodeEdit, level + 1));
    }
  }

  toggleExpand(node: TreeNodeEdit): void {
    node.expanded = !node.expanded;
    this.updateFlattenedNodes();
  }

  selectNode(node: TreeNodeEdit): void {
    this.selectedNode = node;
  }

  getNodeLabel(node: TreeNodeEdit): string {
    if (node.denomination) {
      return `🔵 ${node.denomination}`;
    } else if (node.question) {
      return `❓ ${node.question.substring(0, 50)}${node.question.length > 50 ? '...' : ''}`;
    } else if (node.answer) {
      return `➡️ ${node.answer}`;
    }
    return node.id;
  }

  hasChildren(node: TreeNodeEdit): boolean {
    return !!node.children && node.children.length > 0;
  }

  saveChanges(): void {
    // For now, just log the data - later will save to Firebase
    console.log('Saving tree data:', JSON.stringify(this.treeData, null, 2));
    
    // Create a downloadable JSON file
    const blob = new Blob([JSON.stringify(this.treeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theoviz/tree-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  addChild(): void {
    if (!this.selectedNode) return;
    
    const newChild: TreeNodeEdit = {
      id: `new-${Date.now()}`,
      question: 'New Question',
      result: 'New result text',
      children: []
    };
    
    if (!this.selectedNode.children) {
      this.selectedNode.children = [];
    }
    
    this.selectedNode.children.push(newChild);
    this.selectedNode.expanded = true;
    this.updateFlattenedNodes();
  }

  deleteNode(): void {
    if (!this.selectedNode || !this.treeData) return;
    
    // Can't delete root
    if (this.selectedNode === this.treeData) {
      alert('Cannot delete root node');
      return;
    }
    
    // Find and remove from parent
    this.deleteNodeRecursive(this.treeData, this.selectedNode);
    this.selectedNode = null;
    this.updateFlattenedNodes();
  }

  private deleteNodeRecursive(parent: TreeNodeEdit, nodeToDelete: TreeNodeEdit): boolean {
    if (parent.children) {
      const index = parent.children.indexOf(nodeToDelete as TreeNode);
      if (index !== -1) {
        parent.children.splice(index, 1);
        return true;
      }
      
      for (const child of parent.children) {
        if (this.deleteNodeRecursive(child as TreeNodeEdit, nodeToDelete)) {
          return true;
        }
      }
    }
    return false;
  }
}
