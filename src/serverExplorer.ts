import {
    TreeDataProvider,
    Event,
    TreeItem,
    TreeItemCollapsibleState,
    window
} from 'vscode';

export class ServersViewTreeDataProvider implements TreeDataProvider < String > {
    addLocation(): any {
        window.showInformationMessage('Successfully called add entry')
    }
    onDidChangeTreeData ? : Event < String | null | undefined > | undefined;
    getTreeItem(label: string): TreeItem | Thenable < TreeItem > {
        return new TreeItem(label, TreeItemCollapsibleState.Collapsed);
    }
    getChildren(element ? : string | undefined): String[] | Thenable < String[] | null | undefined > | null | undefined {
        return [
            'Server1', 'Server2', 'Server3', 'Server4'
        ];
    }
}