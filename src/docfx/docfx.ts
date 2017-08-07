import { IMinimatch } from 'minimatch';
import { Observer } from 'rxjs';

import { findFiles, readJson, readYaml, readYamlFrontMatter, createMatchers } from './fs-utils';
import * as path from 'path';

/**
 * Represents the metadata for a DocFX topic.
 */
export interface TopicMetadata {
    /** The topic UID. */
    uid: string;

    /** The topic type. */
    type: string;

    /** The source file where the topic is defined. */
    sourceFile: string;

    /** The topic name. */
    name?: string;

    /** The topic title. */
    title?: string;

    /** The member type (for managed reference topics). */
    memberType?: string;

    /** The topic's detailed sub-type. */
    detailedType?: TopicType;
}

/**
 * Well-known topic types used to filter the topic quick-pick list.
 */
export enum TopicType {
    /** A conceptual topic. */
    Conceptual = 1,

    /** A namespace topic. */
    Namespace = 2,

    /** A type (e.g. class, enum, etc) topic. */
    Type = 3,

    /** A property topic. */
    Property = 4,

    /** A method topic. */
    Method = 5,

    /** A PowerShell Cmdlet topic. */
    PowerShellCmdlet = 6,

    /** Some other type of topic (not a well-known topic type). */
    Other = 6
}

/**
 * Get metadata for all topics defined in the specified project.
 * 
 * @param projectFile The full path to docfx.json.
 * @param progress A ProgressReporter used to report progress.
 * 
 * @returns { Promise<TopicMetadata[]> } A Promise that resolves to the topic metadata.
 */
export async function getAllTopics(projectFile: string, progress: Observer<string>): Promise<TopicMetadata[]> {
    progress.next('Scanning for content files...');
    
    const contentFiles: string[] = await getProjectContentFiles(projectFile);

    const totalFileCount: number = contentFiles.length;
    let processedFileCount = 0;
    function reportFileProcessed(): void {
        processedFileCount++;

        if (!progress)
            return;

        const percentComplete = Math.ceil(
            (processedFileCount / totalFileCount) * 100
        );

        progress.next(`Processing (${percentComplete}% complete)...`);
    }

    const topicMetadata: TopicMetadata[] = [];
    for (const contentFile of contentFiles) {
        const contentFileTopicMetadata = await getTopics(contentFile);
        topicMetadata.push(...contentFileTopicMetadata);

        reportFileProcessed();
    }

    topicMetadata.forEach(metadata => {
        metadata.detailedType = categorizeTopic(metadata);
    });

    progress.next('Scan complete.');

    return topicMetadata;
}

/**
 * Get metadata for the topic(s) defined in the specified content file.
 * 
 * @param contentFile The full path of the content file.
 * 
 * @returns { Promise<TopicMetadata[]> } A Promise that resolves to the topic metadata.
 */
export async function getTopics(contentFile: string): Promise<TopicMetadata[]> {
    if (contentFile.endsWith('.json') || contentFile.endsWith('toc.yml'))
        return [];

    if (contentFile.endsWith('.md'))
    {
        const conceptualTopicMetadata = await parseMarkdownTopicMetadata(contentFile);
        if (!conceptualTopicMetadata)
            return [];

        return [ conceptualTopicMetadata ];
    } else if (contentFile.endsWith('.yml')) {
        return await parseManagedReferenceYaml(contentFile);
    }
}

/**
 * Parse page metadata from a Markdown file's YAML front-matter.
 * 
 * @param fileName The full path to the file.
 * @returns A promise that resolves to the page metadata (or null if the page metadata could not be parsed).
 */
async function parseMarkdownTopicMetadata(fileName: string): Promise<TopicMetadata> {
    const topicMetadata = await readYamlFrontMatter<TopicMetadata>(fileName);
    if (!topicMetadata)
        return null;

    if (!topicMetadata.uid)
        return null;

    topicMetadata.type = topicMetadata.type || 'Conceptual';
    topicMetadata.detailedType = TopicType.Conceptual;
    topicMetadata.name = topicMetadata.name || topicMetadata.uid;
    topicMetadata.title = topicMetadata.title || topicMetadata.name;
    topicMetadata.sourceFile = fileName;

    return topicMetadata;
}

/** The root of a DocFX managed reference document. */
interface ManagedReferenceRoot {
    /** The managed reference items. */
    items: ManagedReferenceMetadata[];
}

/** The metadata for a DocFX managed reference. */
interface ManagedReferenceMetadata {
    /** The reference UID. */
    uid: string;

    /** The reference type (e.g. Namespace, Class, Method, etc). */
    type: string;

    /** The reference name. */
    name: string;

    /** The reference name, including enclosing CLR type. */
    nameWithType: string;

    /** The fully-qualified reference name, including enclosing namespace. */
    fullName: string;

    /** The Id of the XML doc comment from which the managed reference was extracted. */
    commentId: string;

    /** The type of member represented by the reference. */
    memberType: string;
}

/**
 * Parse page metadata from DocFX managed-class-reference YAML.
 * @param fileName 
 */
async function parseManagedReferenceYaml(fileName: string): Promise<TopicMetadata[]> {
    const topicMetadata: TopicMetadata[] = [];

    const mrefYaml = await readYaml<ManagedReferenceRoot>(fileName,
        'ManagedReference' // Expected YAML MIME type.
    );
    if (!mrefYaml || !mrefYaml.items)
        return topicMetadata;

    for (const managedReference of mrefYaml.items) {
        if (!managedReference.uid)
            continue;

        topicMetadata.push({
            uid: managedReference.uid,
            type: 'Reference.Managed',
            memberType: managedReference.type,
            name:managedReference.fullName,
            title: managedReference.nameWithType,
            sourceFile: fileName
        });
    }

    return topicMetadata;
}

/**
 * Matchers for files (include / exclude).
 */
export class FileMatcher {
    /** Matchers for including content files. */
    private includeMatchers: IMinimatch[];

    /** Matchers for excluding content files. */
    private excludeMatchers: IMinimatch[];

    /** The base directory for comparisons. */
    private baseDir: string;

    /**
     * Create a new content file matcher.
     * 
     * @param baseDir The base directory for comparisons.
     * @param includePatterns Matchers for including content files.
     * @param excludePatterns 
     */
    constructor(baseDir: string, includePatterns: string[], excludePatterns: string[]) {
        this.baseDir = baseDir;
        this.includeMatchers = createMatchers(...includePatterns);
        this.excludeMatchers = createMatchers(...excludePatterns);
    }

    /**
     * Determine whether the specified file should be included.
     * 
     * @param filePath The full or relative path of the file.
     */
    public shouldIncludeFile(filePath: string): boolean {
        const relativeFilePath = path.relative(this.baseDir, filePath);

        for (const exclude of this.excludeMatchers) {
            if (exclude.match(relativeFilePath))
                return false;
        }
        
        for (const include of this.includeMatchers) {
            if (include.match(relativeFilePath)) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Get all content files defined in the DocFX project.
 * 
 * @param projectFile The full path to docfx.json.
 * @returns A promise resolving as an array of content file names.
 */
export async function getProjectContentFileMatchers(projectFile: string, baseDir?: string): Promise<FileMatcher> {
    // TODO: Define interfaces so we can eliminate this use of "any".
    // tslint:disable-next-line no-any
    const project: any = await readJson(projectFile);

    baseDir = baseDir || path.dirname(projectFile);
    const includePatterns: string[] = [];
    const excludePatterns: string[] = [];
    for (const contentEntry of project.build.content) {
        if (!contentEntry.files)
            continue;

        const entryBaseDirectory = path.join(baseDir, contentEntry.src || '');

        const entryIncludePatterns = contentEntry.files.filter(
            (pattern: string) => !pattern.endsWith('.json') // Ignore Swagger files
        );
        if (!entryIncludePatterns.length)
            continue;

        const entryExcludePatterns = (contentEntry.exclude as string[] || []).filter(
            (pattern: string) => !pattern.endsWith('.json') // Ignore Swagger files
        );
        
        includePatterns.push(...entryIncludePatterns);
        excludePatterns.push(...entryExcludePatterns);
    }

    return new FileMatcher(baseDir, includePatterns, excludePatterns);
}

/**
 * Get all content files defined in the DocFX project.
 * 
 * @param projectFile The full path to docfx.json.
 * @returns A promise resolving as an array of content file names.
 */
export async function getProjectContentFiles(projectFile: string): Promise<string[]> {
    // TODO: Define interfaces so we can eliminate this use of "any".
    // tslint:disable-next-line no-any
    const project: any = await readJson(projectFile);

    let files: string[] = [];
    const baseDir = path.dirname(projectFile);
    const patterns: string[] = [];
    for (const contentEntry of project.build.content) {
        if (!contentEntry.files)
            continue;

        const entryBaseDirectory = path.join(baseDir, contentEntry.src || '');
        const entryPatterns = contentEntry.files.filter(
            (pattern: string) => !pattern.endsWith('.json') // Ignore Swagger files
        );
        if (!entryPatterns.length)
            continue;

        files = files.concat(
            await getFiles(entryBaseDirectory, ...entryPatterns)
        );
    }

    return files;
}

/**
 * Get all files that match the specified globbing pattern.
 * 
 * @param baseDirectory The base directory (patterns are considered relative to this).
 * @param globPatterns One or more globbing patterns to match.
 * @returns A promise resolving as an array of matching file names.
 */
async function getFiles(baseDirectory: string, ...globPatterns: string[]): Promise<string[]> {
    const scanners: Promise<string[]>[] = [];
    for (const globPattern of globPatterns) {
        scanners.push(
            findFiles(baseDirectory, globPattern)
        );
    }
    
    let files: string[] = [];
    for (const scanResult of await Promise.all(scanners)) {
        files = files.concat(scanResult);
    }

    return files;
}

/**
 * Determine the type of topic represented by the specified topic metadata.
 * 
 * @param metadata The topic metadata.
 */
function categorizeTopic(metadata: TopicMetadata): TopicType {
    switch (metadata.type) {
        case 'Conceptual': {
            return TopicType.Conceptual;
        }
        case 'Reference.Managed': {
            switch (metadata.memberType) {
                case 'Namespace': {
                    return TopicType.Namespace;
                }
                case 'Class':
                case 'Struct':
                case 'Interface':
                case 'Delegate': {
                    return TopicType.Type;
                }
                case 'Property': {
                    return TopicType.Property;
                }
                case 'Method':
                case 'Constructor': {
                    return TopicType.Method;
                }
                default: {
                    return TopicType.Other;
                }
            }
        }
        case 'Reference.PowerShell': {
            switch (metadata.memberType) {
                case 'Cmdlet': {
                    return TopicType.PowerShellCmdlet;
                }
                default: {
                    return TopicType.Other;
                }
            }
        }
        default: {
            return TopicType.Other;
        }
    }
}
