import * as fs from 'mz/fs';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { runWithProgressObserver, VSCodeProgress } from './utils/progress';
import { TopicMetadata, TopicType, getFileTopics, DocFXProject } from 'docfx-project';
import { TopicChange, TopicChangeType } from './change-adapter';
import { mapToSerializable, mapFromSerializable, SerializableMapData } from './utils/json';

/**
 * Workspace state keys used by the metadata cache.
 */
class StateKeys {
    /** The workspace state key representing the DocFX project file (if any) for the current workspace. */
    public static readonly projectFile = 'docfxAssistant.projectFile';
}

/**
 * Cache for topic metadata.
 */
export class MetadataCache {
    private topicChangeSubject: Rx.Subject<TopicChange> = new Rx.Subject<TopicChange>();
    private docfxProjectFile: string = null;
    private topics: Map<string, TopicMetadata> = null;
    private topicsByContentFile: Map<string, TopicMetadata[]> = null;

    /**
     * A Promise representing the current cache-population task (if any).
     */
    private populatingPromise: Promise<boolean> = null;

    /**
     * Is the cache currently populated?
     */
    public get isPopulated(): boolean {
        return this.docfxProjectFile !== null && this.topics !== null && this.topicsByContentFile !== null;
    }

    /**
     * An observer for ongoing changes to topic metadata.
     */
    public get topicChanges(): Rx.Observer<TopicChange> {
        return this.topicChangeSubject;
    }

    /**
     * The current project file (if any).
     */
    public get projectFile(): string {
        return this.docfxProjectFile;
    }

    /**
     * Create a new topic metadata cache.
     */
    constructor(private workspaceState: vscode.Memento) {
        this.topicChangeSubject.subscribe(
            change => this.handleTopicChange(change).catch(
                error => console.log('Warning - error encountered by topic metadata cache: ' + error.message, error)
            ),
            error => console.log('Warning - error encountered by topic change observer: ' + error.message, error)
        );
    }

    /**
     * Flush the metadata cache.
     * 
     * @param clearWorkspaceState Also clear any state data persisted in workspace state?
     */
    public async flush(clearWorkspaceState?: boolean): Promise<void> {
        this.docfxProjectFile = null;
        this.topics = null;
        this.topicsByContentFile = null;

        if (clearWorkspaceState)
            await this.workspaceState.update(StateKeys.projectFile, null);
    }

    /**
     * Persist the metadata cache state.
     */
    public async persist(): Promise<void> {
        const stateDirectory = path.join(vscode.workspace.rootPath, '.vscode', 'docfx-assistant');
        if (!await fs.exists(stateDirectory))
            await fs.mkdir(stateDirectory);

        const stateFile = path.join(stateDirectory, 'topic-cache.json');
        if (this.topics) {
            const stateData = JSON.stringify(Array.from(this.topics.values()), null, '    ');
            await fs.writeFile(stateFile, stateData, { encoding: 'utf8' });
        } else if (await fs.exists(stateFile)) {
            await fs.unlink(stateFile);
        }
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

        const topicMetadata = this.topics.get(uid);
        if (!topicMetadata)
            return null;

        // Clone.
        return Object.assign({}, topicMetadata);
    }

    /**
     * Get VSCode QuickPick list items for all known UIDs.
     * 
     * @param topicType An optional topic type used to filter the items.
     * 
     * @returns {Promise<vscode.QuickPickItem[] | null>} A promise that resolves to the items, or null if the cache could not be populated.
     */
    public async getUIDQuickPickItems(topicType?: TopicType): Promise<vscode.QuickPickItem[] | null> {
        if (!await this.ensurePopulated())
            return null;

        let topicMetadata = Array.from(this.topics.values());
        if (topicType) {
            topicMetadata = topicMetadata.filter(
                metadata => metadata.detailedType === topicType
            );
        }

        return topicMetadata
            .sort(
                (topic1, topic2) => topic1.uid.localeCompare(topic2.uid)
            )
            .map(metadata => <vscode.QuickPickItem>{
                label: metadata.uid,
                detail: metadata.title,
                description: TopicType[metadata.detailedType]
            });
    }

    /**
     * Get VSCode completion-list items for all known UIDs.
     * 
     * @param topicType An optional topic type used to filter the items.
     * 
     * @returns {Promise<vscode.CompletionItem[] | null>} A promise that resolves to the items, or null if the cache could not be populated.
     */
    public async getUIDCompletionListItems(topicType?: TopicType): Promise<vscode.CompletionItem[] | null> {
        if (!await this.ensurePopulated())
            return null;

        let topicMetadata = Array.from(this.topics.values());
        if (topicType) {
            topicMetadata = topicMetadata.filter(
                metadata => metadata.detailedType === topicType
            );
        }

        return topicMetadata
            .sort(
                (topic1, topic2) => topic1.uid.localeCompare(topic2.uid)
            )
            .map(metadata => {
                let itemKind: vscode.CompletionItemKind;
                switch (metadata.detailedType) {
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

                const completionItem = new vscode.CompletionItem(metadata.uid, itemKind);
                completionItem.detail = metadata.title + '\nLocation: ' + metadata.sourceFile;

                return completionItem;
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
        if (this.docfxProjectFile && this.topics)
            return true;

        if (this.populatingPromise)
            return await this.populatingPromise;

        const populatingPromise = this.populatingPromise = runWithProgressObserver(
            progress => this.populate(progress, ignoreMissingProjectFile)
        );

        return await populatingPromise.then(
            () => this.populatingPromise = null
        );
    }

    /**
     * Scan and parse the DocFX project contents.
     * 
     * TODO: Remove this function entirely, so the cache is initially populated by feeding a sequence of "create" topic changes.
     * 
     * @param progress The Observer used to report cache-population progress.
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     * 
     * @returns {boolean} true, if the cache was successfully populated; otherwise, false.
     */
    private async populate(progress: Rx.Observer<string>, ignoreMissingProjectFile: boolean): Promise<boolean> {
        try {
            if (!this.docfxProjectFile) {
                this.docfxProjectFile = await this.findDocFXProjectFile(progress, ignoreMissingProjectFile);
                if (!this.docfxProjectFile)
                    return false;
            }

            if (!this.topics) {
                const projectDir = path.dirname(this.docfxProjectFile);

                this.topics = new Map<string, TopicMetadata>();
                this.topicsByContentFile = new Map<string, TopicMetadata[]>();
                
                const topicMetadata: TopicMetadata[] = [];
                const persistedTopicCache = await this.loadTopicCache();
                if (persistedTopicCache) {
                    topicMetadata.push(...persistedTopicCache);
                } else {
                    progress.next(
                        `Scanning DocFX project "${this.docfxProjectFile}"...`
                    );

                    const project = await DocFXProject.load(this.docfxProjectFile);
                    const projectTopics = await project.getTopics(progress);
                    topicMetadata.push(...projectTopics);
                }

                topicMetadata.forEach(topic => {
                    if (path.isAbsolute(topic.sourceFile)) {
                        topic.sourceFile = path.relative(projectDir, topic.sourceFile);
                    }

                    this.topics.set(topic.uid, topic);

                    let contentFileTopics: TopicMetadata[] = this.topicsByContentFile.get(topic.sourceFile);
                    if (!contentFileTopics) {
                        contentFileTopics = [];
                        this.topicsByContentFile.set(topic.sourceFile, contentFileTopics);
                    }
                    contentFileTopics.push(topic);
                });

                progress.next(
                    `$(check) Found ${this.topics.size} topics in DocFX project.`
                );

                await this.persist();
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
     * TODO: Eliminate the need for this by making the metadata cache take the project file path as a parameter.
     * 
     * @param progress An Observable<string> used to report progress.
     * @param ignoreMissingProjectFile When true, then no alert will be displayed if no DocFX project file is found in the current workspace.
     */
    private async findDocFXProjectFile(progress: Rx.Observer<string>, ignoreMissingProjectFile: boolean): Promise<string | null> {
        const cachedProjectFile = this.workspaceState.get<string>(StateKeys.projectFile);
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
        await this.workspaceState.update(StateKeys.projectFile, projectFile);

        return projectFile;
    }

    /**
     * Load the persisted topic cache (if any).
     */
    private async loadTopicCache(): Promise<TopicMetadata[] | null> {
        const stateDirectory = path.join(vscode.workspace.rootPath, '.vscode', 'docfx-assistant');
        const stateFile = path.join(stateDirectory, 'topic-cache.json');
        if (!await fs.exists(stateFile))
            return null;

        return JSON.parse(
            await fs.readFile(stateFile, { encoding: 'utf-8' })
        ) as TopicMetadata[];
    }

    /**
     * Handle a changed topic in the current workspace.
     * 
     * @param change A TopicChange representing the changed topic.
     */
    private async handleTopicChange(change: TopicChange): Promise<void> {
        switch (change.changeType)
        {
            case TopicChangeType.Added:
            case TopicChangeType.Changed:
            {
                let contentFileTopics: TopicMetadata[] = this.topicsByContentFile.get(change.contentFile);
                if (contentFileTopics) {
                    contentFileTopics.forEach((topic: TopicMetadata) => {
                        this.topics.delete(topic.uid);
                    });
                }

                contentFileTopics = [];
                this.topicsByContentFile.set(change.contentFile, contentFileTopics);

                change.topics.forEach((topic: TopicMetadata) => {
                    this.topics.set(topic.uid, topic);

                    contentFileTopics.push(topic);
                });

                await this.persist();

                break;
            }
            case TopicChangeType.Removed:
            {
                const existingTopics: TopicMetadata[] = this.topicsByContentFile.get(change.contentFile);
                if (existingTopics) {
                    this.topicsByContentFile.delete(change.contentFile);
                    
                    existingTopics.forEach(existingTopic => {
                        this.topics.delete(existingTopic.uid);
                    });

                    this.topicsByContentFile.delete(change.contentFile);
                }

                await this.persist();
                
                break;
            }
            default:
            {
                console.log('Warning - received unexpected type of topic change notification.', change);

                break;
            }
        }
    }
}

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
