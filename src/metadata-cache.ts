import * as vscode from 'vscode';

import { TopicMetadata, getAllTopics } from "./docfx/docfx";

/**
 * Cache for topic metadata.
 */
export class MetadataCache {
    private docfxProjectFile: string;
    private topicMetadata: TopicMetadata[];
    private topicMetadataByUID = new Map<string, TopicMetadata>();

    /**
     * Create a new topic metadata cache.
     */
    constructor() { }

    /**
     * Flush the metadata cache.
     */
    public flush() {
        this.topicMetadata = null;
    }

    /**
     * Get the metadata for the topic (if any) associated with the specified UID.
     * 
     * @param uid The target UID.
     * @returns A Promise that resolves to the metadata, or null if no topic was found with the specified Id.
     */
    public async getTopicMetadataByUID(uid: string): Promise<TopicMetadata | null> {
        const topicMetadata = this.topicMetadataByUID[uid];
        if (!topicMetadata)
            return null;

        // Clone.
        return Object.assign({}, topicMetadata);
    }

    /**
     * Get VSCode QuickPick items for all known UIDs.
     */
    public async getUIDQuickPickItems(): Promise<vscode.QuickPickItem[]> {
        if (!this.topicMetadata)
            await this.populate();

        return this.topicMetadata.map(metadata => <vscode.QuickPickItem>{
            label: metadata.uid,
            detail: metadata.title
        });
    }

    /**
     * Scan and parse the DocFX project contents.
     */
    public async populate(): Promise<void> {
        let statusBarItem: vscode.StatusBarItem;
        if (!this.docfxProjectFile || !this.topicMetadata)
            statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

        if (!this.docfxProjectFile) {
            statusBarItem.text = "$(telescope) Scanning for DocFX project...";
            statusBarItem.show();

            const files = await vscode.workspace.findFiles('**/docfx.json', '**/node_modules/**', 1);
            if (!files.length) {
                vscode.window.showInformationMessage("Cannot find docfx.json in the current workspace.");

                return;
            }
            
            this.docfxProjectFile = files[0].fsPath;
        }

        if (!this.topicMetadata) {
            statusBarItem.text = `$(telescope) Scanning DocFX project "${this.docfxProjectFile}"...`;
            statusBarItem.show();

            this.topicMetadata = await getAllTopics(this.docfxProjectFile);
            for (const metadata of this.topicMetadata) {
                this.topicMetadataByUID[metadata.uid] = metadata;
            }

            statusBarItem.text = `$(check) Found ${this.topicMetadata.length} topics in DocFX project.`;
        }

        if (statusBarItem) {
            setTimeout(() => {
                statusBarItem.hide();
                statusBarItem.dispose();
            }, 1500);
        }
        
    }
}