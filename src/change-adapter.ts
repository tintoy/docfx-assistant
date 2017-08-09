import * as chokidar from 'chokidar';
import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { getDocFXProjectFile } from './utils/workspace';
import { DocFXProject, TopicMetadata, getFileTopics } from 'docfx-project';

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
 * @returns {Promise<Rx.Observable<TopicChange>>} A promise that resolves to an observable sequence of {@link TopicChange} representing the changes.
 */
export async function observeTopicChanges(context: vscode.ExtensionContext): Promise<Rx.Observable<TopicChange>> {
    if (!vscode.workspace.rootPath) {
        throw new Error('Current workspace has no root path.');
    }

    const docfxProjectFile = await getDocFXProjectFile(context);
    const docfxProjectDir = path.dirname(docfxProjectFile);

    const docfxProject = await DocFXProject.load(docfxProjectFile);

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
            path.join(docfxProjectDir, '**', '*.md'),
            path.join(docfxProjectDir, '**', '*.yml')
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
