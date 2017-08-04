'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

import { TopicMetadata, getAllTopics } from './docfx/docfx';

let docfxProjectFile: string;
let topicMetadata: TopicMetadata[];
let topicQuickPickItems: vscode.QuickPickItem[];

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.refreshTopicUIDs', handleRefreshTopicUIDs)
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('docfx.insertTopicUID', handleInsertTopicUID)
    );
}

/**
 * Handle the docfx.refreshTopicUIDs command.
 */
async function handleRefreshTopicUIDs() {
    docfxProjectFile = null;
    topicMetadata = null;
    topicQuickPickItems = null;

    await scanDocfxProject();
}

/**
 * Handle the docfx.insertTopicUID command.
 */
async function handleInsertTopicUID() {
    if (!isSupportedLanguage())
        return;

    await scanDocfxProject();

    if (topicQuickPickItems) {
        const selectedItem = await vscode.window.showQuickPick(topicQuickPickItems, { placeHolder: "Choose a topic UID"});
        if (!selectedItem)
            return;
        
        await vscode.window.activeTextEditor.edit(edit => {
            edit.insert(
                vscode.window.activeTextEditor.selection.active,
                selectedItem.label
            );
        });
    }
}

/**
 * Determine whether the active editor (if any) is for a supported language.
 */
function isSupportedLanguage(): boolean {
    if (!vscode.window.activeTextEditor)
        return false;

    switch (vscode.window.activeTextEditor.document.languageId) {
        case "markdown":
        case "yaml": {
            return true;
        }
        default: {
            return false;
        }
    }
}

/**
 * Scan and parse the DocFX project contents.
 */
async function scanDocfxProject() {
    if (!docfxProjectFile) {
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

        statusBarItem.text = "$(telescope) Scanning for DocFX project...";
        statusBarItem.show();

        const files = await vscode.workspace.findFiles('**/docfx.json', '**/node_modules/**', 1);
        if (!files.length) {
            vscode.window.showInformationMessage("Cannot find docfx.json in the current workspace.");

            return;
        }
        
        docfxProjectFile = files[0].fsPath;

        statusBarItem.text = `$(telescope) Scanning DocFX project "${docfxProjectFile}"...`;

        topicMetadata = await getAllTopics(docfxProjectFile);
        topicQuickPickItems = topicMetadata.map(metadata => <vscode.QuickPickItem>{
            label: metadata.uid,
            detail: metadata.title
        });

        statusBarItem.text = `$(check) Found ${topicMetadata.length} topics in DocFX project.`;

        setTimeout(() => {
            statusBarItem.hide();
            statusBarItem.dispose();
        }, 1500);
    }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate() {
}