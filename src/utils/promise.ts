/**
 * Determine whether the specified object is a @{link Promise<T>}
 * 
 * @param obj The object to test.
 * @template T The promise result type.
 * 
 * @returns true, if the object is a promise / thenable; otherwise, false.
 */
export function isPromise<T>(obj: T | Promise<T>): obj is Promise<T> {
    return typeof obj['then'] === 'function';
}
