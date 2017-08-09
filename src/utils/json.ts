/**
 * Represents the serialisable data from a {@link Map}.
 */
export interface SerializableMapData<TValue> {
    /**
     * Get the value with the specified key.
     * 
     * @param key The key.
     */
    [key: string]: TValue;
}

/**
 * Convert a {@link Map} to serialisable data.
 * 
 * @param map The {@link Map} to convert.
 * @returns The serialisable data.
 */
export function mapToSerializable<TValue>(map: Map<string, TValue>): SerializableMapData<TValue> {
    if (!map)
        return null;

    const data: SerializableMapData<TValue> = {};
    for (const key of map.keys())
        data[key] = map.get(key);

    return data;
}

/**
 * Create a {@link Map} from serialisable data.
 * 
 * @param data The serialisable map data.
 * @returns The {@link Map}.
 */
export function mapFromSerializable<TValue>(data: SerializableMapData<TValue>): Map<string, TValue> {
    const map = new Map<string, TValue>();

    Object.getOwnPropertyNames(data).forEach(
        propertyName => map.set(propertyName, data[propertyName])
    );
    
    return map;
}

/**
 * Convert a {@link Set} to serialisable data.
 * 
 * @param set The {@link Set}.
 * @returns An array of serialisable set values.
 */
export function setToSerializable<TValue>(set: Set<TValue>): TValue[] {
    if (!set)
        return null;

    return Array.from(
        set.values()
    );
}

/**
 * Create a {@link Set} from serialisable data.
 * 
 * @param data An array of serialisable set values.
 * @returns The {@link Set}.
 */
export function setFromSerializable<TValue>(data: TValue[]): Set<TValue> {
    if (!data)
        return null;

    return new Set<TValue>(data);
}
