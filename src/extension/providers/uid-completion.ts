import * as vscode from 'vscode';

import { getUIDRangeAtPosition } from '../utils/editor';
import { MetadataCache, TopicType, TopicMetadata } from 'docfx-project';

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
        if (!await this.metadataCache.ensurePopulated())
            return null; // No current project.

        // If they've typed part of a UID, filter the list to start there.
        let uidPrefix: string = null;
        const activeUIDRange = getUIDRangeAtPosition(document, position);
        if (activeUIDRange && !activeUIDRange.isEmpty)
            uidPrefix = document.getText(activeUIDRange);

        const completionItems = this.metadataCache.getTopics(uidPrefix).map(
            topicMetadata => completionItemFromTopicMetadata(topicMetadata, activeUIDRange)
        );

        return completionItems;
    }
}

/**
 * Create a new completion item from topic metadata.
 * 
 * @param topicMetadata The topic metadata.
 * @param replaceRange The range of text (if any) that the completion will replace.
 */
function completionItemFromTopicMetadata(topicMetadata: TopicMetadata, replaceRange: vscode.Range): vscode.CompletionItem {
    let itemKind: vscode.CompletionItemKind;
    switch (topicMetadata.detailedType) {
        case TopicType.Conceptual: {
            itemKind = vscode.CompletionItemKind.Text;

            break;
        }
        case TopicType.Namespace: {
            itemKind = vscode.CompletionItemKind.Module;

            break;
        }
        case TopicType.Type: {
            itemKind = vscode.CompletionItemKind.Class;

            break;
        }
        case TopicType.Property: {
            itemKind = vscode.CompletionItemKind.Property;

            break;
        }
        case TopicType.Method: {
            itemKind = vscode.CompletionItemKind.Method;

            break;
        }
        default: {
            itemKind = vscode.CompletionItemKind.Value;

            break;
        }
    }

    const completionItem = new vscode.CompletionItem(topicMetadata.uid, itemKind);
    completionItem.detail = topicMetadata.title + '\nLocation: ' + topicMetadata.sourceFile;
    completionItem.range = replaceRange;

    return completionItem;
}
