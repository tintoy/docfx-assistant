import * as fs from 'mz/fs';
import { Observer } from 'rxjs';
import * as vscode from 'vscode';

import { runWithProgressObserver, VSCodeProgress } from './common/progress';
import { TopicMetadata, getAllTopics } from './docfx/docfx';

/**
 * An error relating to the metadata cache.
 */
export class MetadataCacheError extends Error {
    /**
     * Should the error be displayed as a warning in the UI?
     */
    public isWarning: boolean;

    /**
     * Create a new MetadataCacheWarningError.
     * 
     * @param message The error message.
     */
    constructor(message: string, isWarning?: boolean) {
        super(message);

        this.isWarning = isWarning || false;
    }

    /**
     * Create a MetadataCacheError that should be displayed as a warning in the UI.
     * 
     * @param message The warning message.
     */
    public static warning(message: string): MetadataCacheError {
        return new MetadataCacheError(message, true);
    }
}

/**
 * Cache for topic metadata.
 */
export class MetadataCache {
    private docfxProjectFile: string = null;
    private topicMetadata: TopicMetadata[]  = null;
    private topicMetadataByUID = new Map<string, TopicMetadata>();

    /**
     * Is the cache currently populated?
     */
    public get isPopulated(): boolean {
        return this.docfxProjectFile !== null && this.topicMetadata !== null;
    }

    /**
     * Create a new topic metadata cache.
     */
    constructor(private workspaceState: vscode.Memento) { }

    /**
     * Flush the metadata cache.
     */
    public flush(): void {
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

        const topicMetadata = this.topicMetadataByUID.get(uid);
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

        return await runWithProgressObserver(
            progress => this.populate(progress, ignoreMissingProjectFile)
        );
    }

    /**
     * Scan and parse the DocFX project contents.
     * 
     * @param progress The Observer used to report cache-population progress.
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     * 
     * @returns {boolean} true, if the cache was successfully populated; otherwise, false.
     */
    private async populate(progress: Observer<string>, ignoreMissingProjectFile: boolean): Promise<boolean> {
        try {
            if (!this.docfxProjectFile) {
                this.docfxProjectFile = await this.findDocFXProjectFile(progress, ignoreMissingProjectFile);
                if (!this.docfxProjectFile)
                    return false;
            }

            if (!this.topicMetadata) {
                progress.next(
                    `Scanning DocFX project "${this.docfxProjectFile}"...`
                );

                this.topicMetadata = await getAllTopics(this.docfxProjectFile, progress);

                progress.next(
                    `$(check) Found ${this.topicMetadata.length} topics in DocFX project.`
                );
            }
        } catch (scanError) {
            console.log(scanError);

            progress.error(scanError);

            return false;
        }

        return true;
    }

    /**
     * Find the first DocFX project file (if any) in the current workspace.
     * 
     * @param progress An Observable<string> used to report progress.
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     */
    private async findDocFXProjectFile(progress: Observer<string>, ignoreMissingProjectFile: boolean): Promise<string | null> {
        const cachedProjectFile = this.workspaceState.get<string>('docfxAssistant.projectFile');
        if (cachedProjectFile && await fs.exists(cachedProjectFile)) {
            return cachedProjectFile;
        }
        
        const files = await vscode.workspace.findFiles('**/docfx.json', '.git/**,**/node_modules/**', 1);
        if (!files.length) {
            if (!ignoreMissingProjectFile) {
                progress.error(
                    MetadataCacheError.warning('Cannot find docfx.json in the current workspace.')
                );
            }

            return null;
        }

        const projectFile = files[0].fsPath;
        await this.workspaceState.update('docfxAssistant.projectFile', projectFile);

        return projectFile;
    }
}
