import * as path from 'path';
import * as Rx from 'rxjs';
import * as vscode from 'vscode';

import { getDocFXProjectFile } from './common/workspace-utils';
import { TopicMetadata, getTopics } from './docfx/docfx';

/**
 * Represents a type of topic change.
 */
export enum TopicChangeType {
    /** Topic(s) added. */
    Added,

    /** Topic(s) removed. */
    Removed,

    /** Topic(s) updated. */
    Updated
}

/**
 * Represents a change in one or more topic(s).
 */
export interface TopicChange {
    /**
     * The content file containing the topic(s).
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

    return new Rx.Observable<TopicChange>(subscriber => {
        const glob = path.join(docfxProjectDir, '**', '*.{md,yml}');
        const watcher: vscode.FileSystemWatcher = vscode.workspace.createFileSystemWatcher(glob);

        async function notify(contentFile: string, changeType: TopicChangeType): Promise<void> {
            if (contentFile.endsWith('toc.yml')) // We don't care about table-of-contents files.
                return;

            const changeNotification: TopicChange = {
                changeType: changeType,
                contentFile: vscode.workspace.asRelativePath(contentFile)
            };

            if (changeType !== TopicChangeType.Removed)
                changeNotification.topics = await getTopics(contentFile);
            
            subscriber.next(changeNotification);
        }

        watcher.onDidCreate(fileUri => {
            notify(fileUri.fsPath, TopicChangeType.Added).catch(
                error => subscriber.error(error)
            );
        });
        watcher.onDidChange(fileUri => {
            notify(fileUri.fsPath, TopicChangeType.Updated).catch(
                error => subscriber.error(error)
            );
        });
        watcher.onDidDelete(fileUri => {
            notify(fileUri.fsPath, TopicChangeType.Removed).catch(
                error => subscriber.error(error)
            );
        });

        return () => {
            watcher.dispose();
        };
    });
}
