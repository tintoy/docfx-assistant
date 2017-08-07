declare module 'minimatch' {
    export default function (target: string, pattern: string, options?: IOptions): boolean;

    export function match(list: string[], pattern: string, options?: IOptions): string[];
    export function filter(pattern: string, options?: IOptions): (element: string, indexed: number, array: string[]) => boolean;
    export function makeRe(pattern: string, options?: IOptions): RegExp;

    export var Minimatch: IMinimatchStatic;

    export interface IOptions {
        debug?: boolean;
        nobrace?: boolean;
        noglobstar?: boolean;
        dot?: boolean;
        noext?: boolean;
        nocase?: boolean;
        nonull?: boolean;
        matchBase?: boolean;
        nocomment?: boolean;
        nonegate?: boolean;
        flipNegate?: boolean;
    }

    export interface IMinimatchStatic {
        new(pattern: string, options?: IOptions): IMinimatch;
        prototype: IMinimatch;
    }

    export interface IMinimatch {
        pattern: string;
        options: IOptions;
        /** 2-dimensional array of regexp or string expressions. */
        set: any[][]; // (RegExp | string)[][]
        regexp: RegExp;
        negate: boolean;
        comment: boolean;
        empty: boolean;

        makeRe(): RegExp; // regexp or boolean
        match(fname: string): boolean;
        matchOne(files: string[], pattern: string[], partial: boolean): boolean;

        /** Deprecated. For internal use. */
        debug(): void;
        /** Deprecated. For internal use. */
        make(): void;
        /** Deprecated. For internal use. */
        parseNegate(): void;
        /** Deprecated. For internal use. */
        braceExpand(pattern: string, options: IOptions): void;
        /** Deprecated. For internal use. */
        parse(pattern: string, isSub?: boolean): void;
    }
}
