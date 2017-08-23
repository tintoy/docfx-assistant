import { TopicMetadata } from 'docfx-project';
import * as path from 'path';
import * as vscode from 'vscode';

import { MetadataCache } from 'docfx-project';

/**
 * Link provider for DocFX UIDs
 */
export class UIDLinkProvider implements vscode.DocumentLinkProvider {
    /** Regex used to identify inline ('@xxx'-style) links to topic UIDs. */
    private inlineLinkMatcher = /([^\w]@)([\w\._#`]*)/g;

    /** Regex used to identify XRef ('<xref:xxx>'-style) links to topic UIDs. */
    private xrefLinkMatcher = /(<xref:)([\w\._\(\)#`]*)\s*(\>)/g;

    /**
     * Create a new UID document link provider.
     * 
     * @param metadataCache The topic metadata cache.
     */
    constructor(private metadataCache: MetadataCache) { }

    /**
     * Provide links (if any) for the specified document.
     * 
     * @param document The target document.
     * @param cancellationToken An optional cancellation token that can be used to cancel the operation.
     * 
     * @returns {vscode.ProviderResult<vscode.DocumentLink[]>} A ProviderResult that resolves to the document links, or null if there is no current DocFX project file in the current workspace.
     */
    public provideDocumentLinks(document: vscode.TextDocument, cancellationToken: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[] | null> {
        return this.provideDocumentLinksCore(document, cancellationToken);
    }

    /**
     * Provide links (if any) for the specified document.
     * 
     * @param document The target document.
     * @param cancellationToken An optional cancellation token that can be used to cancel the operation.
     * 
     * @returns {Promise<vscode.DocumentLink[]>} A promise that resolves to the document links, or null if there is no current DocFX project file in the current workspace.
     */
    private async provideDocumentLinksCore(document: vscode.TextDocument, cancellationToken: vscode.CancellationToken): Promise<vscode.DocumentLink[]> {
        if (!await this.metadataCache.ensurePopulated())
            return null;

        const links: vscode.DocumentLink[] = [];
        const documentText = document.getText();
        
        const projectDir = path.dirname(this.metadataCache.projectFile);

        let match: RegExpExecArray;

        this.inlineLinkMatcher.lastIndex = 0;
        while ((match = this.inlineLinkMatcher.exec(documentText))) {
            if (cancellationToken.isCancellationRequested)
                return links;

            const link = this.processMatch(document, projectDir, match);
            if (link)
                links.push(link);
        }

        this.xrefLinkMatcher.lastIndex = 0;
        while ((match = this.xrefLinkMatcher.exec(documentText))) {
            if (cancellationToken.isCancellationRequested)
                return links;

            const link = this.processMatch(document, projectDir, match);
            if (link)
                links.push(link);
        }

        return links;
    }

    /**
     * Process a matched inline or XRef link.
     * 
     * @param document The target document.
     * @param projectDir The current DocFX project directory.
     * @param match The current match.
     * 
     * @returns {Promise<vscode.DocumentLink>} The link, or null if the UID refers to a non-existent topic.
     */
    private processMatch(document: vscode.TextDocument, projectDir: string, match: RegExpMatchArray): vscode.DocumentLink | null {
        const prefix = match[1];
        const uid = match[2];
        
        const topicMetadata = this.metadataCache.getTopic(uid);
        if (!topicMetadata)
            return null;

        const offset = (match.index || 0) + prefix.length;
        const uidStart: vscode.Position = document.positionAt(offset);
        const uidEnd: vscode.Position = document.positionAt(offset + uid.length);

        const sourceFilePath = path.join(projectDir, topicMetadata.sourceFile);
        
        return new vscode.DocumentLink(
            new vscode.Range(uidStart, uidEnd),
            vscode.Uri.file(sourceFilePath)
        );
    }
}
