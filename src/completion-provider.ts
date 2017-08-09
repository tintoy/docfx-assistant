import * as vscode from 'vscode';

import { getUIDRangeAtPosition } from './utils/editor';
import { MetadataCache } from './metadata-cache';

/**
 * Completion provider for DocFX UIDs.
 */
export class UIDCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Create a new DocFX UID completion provider.
     * 
     * @param metadataCache The DocFX topic metadata cache.
     */
    constructor(public metadataCache: MetadataCache) { }

    /**
     * Provide completion items for the specified document position.
     * 
     * @param document The target document.
     * @param position The position within the target document.
     * @param token A vscode.CancellationToken that can be used to cancel completion.
     * 
     * @returns A vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> that resolves to the completion items.
     */
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem[]> {
        return this.provideCompletionItemsCore(document, position, token);
    }

    /**
     * Asynchronously provide completion items for the specified document position.
     * 
     * @param document The target document.
     * @param position The position within the target document.
     * @param token A vscode.CancellationToken that can be used to cancel completion.
     * 
     * @returns A vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> that resolves to the completion items.
     */
    private async provideCompletionItemsCore(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {
        if (!this.metadataCache.projectFile)
            return null; // No current project.

        let completionItems = await this.metadataCache.getUIDCompletionListItems();
        
        // If they've typed part of a UID, filter the list to start there.
        const activeUIDRange = getUIDRangeAtPosition(document, position);
        if (activeUIDRange && !activeUIDRange.isEmpty) {
            const activeUID = document.getText(activeUIDRange);

            completionItems = completionItems.filter(
                item => item.label.startsWith(activeUID)
            );

            completionItems.forEach(item => {
                item.range = activeUIDRange;
            });
        }

        return completionItems;
    }
}
