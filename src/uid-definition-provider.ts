import * as vscode from 'vscode';

import { TopicMetadata } from "./docfx/docfx";
import { MetadataCache } from './metadata-cache'

/**
 * The UID definition provider.
 * 
 * @description A work in progress, this is very experimental - enable at your own risk.
 */
export class UidDefinitionProvider implements vscode.DefinitionProvider {
    /** UID regex used to identify the "words" comprising a definition. */
    private uidMatcher = /[A-Za-z0-9\(\)\.]+/g;
    
    /**
     * Create a new UID definition provider.
     * 
     * @param metadataCache The topic metadata cache.
     */
    constructor(private metadataCache: MetadataCache) { }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition> {
        return this.resolveDefinitionCore(document, position, token);
    }

    private async resolveDefinitionCore(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) : Promise<vscode.Definition> {
        const wordRange = document.getWordRangeAtPosition(position, this.uidMatcher);
        if (!wordRange) {
            console.log("UidDefinitionProvider.resolveDefinitionCore: NOMATCH");

            return null;
        }

        const uid = document.getText(wordRange);
        console.log(`UidDefinitionProvider.resolveDefinitionCore("${uid}")`);

        const topicMetadata: TopicMetadata = await this.metadataCache.getTopicMetadataByUID(uid);
        if (!topicMetadata)
            return null;

        const sourceFileUri = vscode.Uri.file(topicMetadata.sourceFile);

        return new vscode.Location(sourceFileUri,
            new vscode.Range(0, 0, 0, 0)
        );
    }
}