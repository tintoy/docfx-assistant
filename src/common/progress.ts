/*
 * Abstractions for progress reporting so underlying components do not directly depend on VS Code
 */

import { Subject, Observer } from 'rxjs';
import * as vscode from 'vscode';

/**
 * VS Code's progress-reporting API.
 */
export type VSCodeProgress = vscode.Progress<{ message: string }>;

/**
 * Run an asynchronous action with VSCode progress-reporting.
 * 
 * @param action The asynchronous action (receives access to the VSCode progress API).
 */
export async function runWithProgress<T>(action: (progress: VSCodeProgress) => Promise<T>): Promise<T> {
    const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Window,
        title: 'DocFX Assistant'
    };

    return await vscode.window.withProgress(progressOptions, async progress => {
        return await action(progress);
    });
}

/**
 * Run an asynchronous action with an Observer<string> for progress reporting.
 * 
 * @param action The asynchronous action (receives access to the progress Observer).
 */
export async function runWithProgressObserver<T>(action: (progress: Observer<string>) => Promise<T>): Promise<T> {
    const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Window,
        title: 'DocFX Assistant'
    };

    return await vscode.window.withProgress(progressOptions, async progress => {
        const progressObserver: Observer<string> = createProgressObserver(progress);

        return await action(progressObserver);
    });
}

/**
 * Create a new Observable<string> that submits progress to the specified VS Code Progress API.
 * 
 * @param progress The VS Code progress API.
 */
export function createProgressObserver(progress: VSCodeProgress): Observer<string> {
    const messageSubject = new Subject<string>();
    messageSubject.subscribe(
        value => progress.report({
            message: value
        }),
        error => {
            if (error.isWarning) {
                vscode.window.showWarningMessage(error.message);
            } else {
                vscode.window.showErrorMessage(error.message);
            }
        }
    );

    return messageSubject;
}
