import * as chokidar from 'chokidar';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { getDocFXProjectFile } from './utils/workspace';
import { DocFXProject, TopicMetadata, getFileTopics } from 'docfx-project';
import { runWithProgressObserver } from './utils/progress';

/**
 * Represents a type of topic change.
 */
export enum TopicChangeType {
    /** Topic(s) added. */
    Added,

    /** Topic(s) removed. */
    Removed,

    /** Topic(s) changed. */
    Changed
}

/**
 * Represents a change in one or more topic(s).
 */
export interface TopicChange {
    /**
     * The content file containing the topic(s).
     * 
     * Must be relative to DocFX project directory.
     */
    contentFile: string;

    /**
     * The type of change.
     */
    changeType: TopicChangeType;

    /**
     * The changed topic(s).
     * 
     * null for {@link TopicChangeType.Delete}.
     * */
    topics?: TopicMetadata[];
}

/**
 * Observe changes to topics in content files contained in the workspace.
 * 
 * @param docfxProject { DocFXProject } The DocFX project for which topic changes will be observed.
 * @returns {Rx.Observable<TopicChange>} An observable sequence of {@link TopicChange} representing the changes.
 */
export function observeTopicChanges(docfxProject: DocFXProject): Rx.Observable<TopicChange> {
    return new Rx.Observable<TopicChange>(subscriber => {
        async function notify(filePath: string, changeType: TopicChangeType): Promise<void> {
            if (!docfxProject.includesContentFile(filePath))
                return;

            const changeNotification: TopicChange = {
                changeType: changeType,
                contentFile: path.relative(docfxProject.projectDir, filePath)
            };

            if (changeType !== TopicChangeType.Removed)
                changeNotification.topics = await getFileTopics(filePath);

            subscriber.next(changeNotification);
        }

        const contentFileGlobs = [
            path.join(docfxProject.projectDir, '**', '*.md'),
            path.join(docfxProject.projectDir, '**', '*.yml')
        ];
        const watcher = chokidar.watch(contentFileGlobs, {
            ignoreInitial: true,
            usePolling: false
        });

        watcher.on('add', (filePath: string) => {
            notify(filePath, TopicChangeType.Added).catch(
                error => subscriber.error(error)
            );
        });
        watcher.on('change', (filePath: string) => {
            notify(filePath, TopicChangeType.Changed).catch(
                error => subscriber.error(error)
            );
        });
        watcher.on('unlink', (filePath: string) => {
            notify(filePath, TopicChangeType.Removed).catch(
                error => subscriber.error(error)
            );
        });
        
        return () => {
            watcher.close();
        };
    });
}
