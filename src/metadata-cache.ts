import * as vscode from 'vscode';

import { ProgressReporter, createMessageProgressReporter } from './common/progress-reporter';
import { TopicMetadata, getAllTopics } from './docfx/docfx';

import withProgress = vscode.window.withProgress;

type VSCodeProgress = vscode.Progress<{ message: string }>;

/**
 * Cache for topic metadata.
 */
export class MetadataCache {
    private docfxProjectFile: string;
    private topicMetadata: TopicMetadata[];
    private topicMetadataByUID = new Map<string, TopicMetadata>();

    /**
     * A Promise representing the currently-runnning cache-population operation (if any).
     */
    private populatingPromise: Thenable<boolean>;

    /**
     * Create a new topic metadata cache.
     */
    constructor() { }

    /**
     * Flush the metadata cache.
     */
    public flush() {
        this.docfxProjectFile = null;
        this.topicMetadata = null;
        this.topicMetadataByUID.clear();
    }

    /**
     * Get the metadata for the topic (if any) associated with the specified UID.
     * 
     * @param uid The target UID.
     * @returns A Promise that resolves to the metadata, or null if no topic was found with the specified Id.
     */
    public async getTopicMetadataByUID(uid: string): Promise<TopicMetadata | null> {
        if (!await this.ensurePopulated())
            return null;

        const topicMetadata = this.topicMetadataByUID[uid];
        if (!topicMetadata)
            return null;

        // Clone.
        return Object.assign({}, topicMetadata);
    }

    /**
     * Get VSCode QuickPick items for all known UIDs.
     * 
     * @returns {Promise<vscode.QuickPickItem[] | null>} A promise that resolves to the QuickPick items, or null if the cache could not be populated.
     */
    public async getUIDQuickPickItems(): Promise<vscode.QuickPickItem[] | null> {
        if (!await this.ensurePopulated())
            return null;

        return this.topicMetadata.map(metadata => <vscode.QuickPickItem>{
            label: metadata.uid,
            detail: metadata.title
        });
    }

    /**
     * Ensure that the cache is populated.
     * 
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     * 
     * @returns {boolean} true, if the cache was successfully populated; otherwise, false.
     */
    public async ensurePopulated(ignoreMissingProjectFile?: boolean): Promise<boolean> {
        if (this.docfxProjectFile && this.topicMetadata)
            return true;

        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Window,
            title: 'DocFX Assistant'
        };

        if (!this.populatingPromise) {
            this.populatingPromise = withProgress(progressOptions, async progress => {
                return await this.populate(
                    createMessageProgressReporter(progress),
                    ignoreMissingProjectFile
                );
            })
            .then(result => {
                this.populatingPromise = null; // Clean up.

                return result;
            });
        }
            
        return await this.populatingPromise;
    }

    /**
     * Scan and parse the DocFX project contents.
     * 
     * @param progress The ProgressReporter used to report cache-population progress.
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     * 
     * @returns {boolean} true, if the cache was successfully populated; otherwise, false.
     */
    private async populate(progress: ProgressReporter<string>, ignoreMissingProjectFile: boolean): Promise<boolean> {
        try {
            if (!this.docfxProjectFile) {
                progress.report("Scanning for DocFX project...");

                const files = await vscode.workspace.findFiles('**/docfx.json', '.git/**,**/node_modules/**', 1);
                if (!files.length) {
                    if (!ignoreMissingProjectFile)
                        vscode.window.showWarningMessage("Cannot find docfx.json in the current workspace.");

                    return false;
                }

                this.docfxProjectFile = files[0].fsPath;
            }

            if (!this.topicMetadata) {
                progress.report(
                    `Scanning DocFX project "${this.docfxProjectFile}"...`
                );

                this.topicMetadata = await getAllTopics(this.docfxProjectFile, progress);

                progress.report(
                    `$(check) Found ${this.topicMetadata.length} topics in DocFX project.`
                );
            }
        } catch (scanError) {
            console.log(scanError);

            await vscode.window.showErrorMessage(
                `Failed to scan DocFX project: ${scanError.message}`
            );

            return false;
        }

        return true;
    }
}
