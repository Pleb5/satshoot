interface SetSerializer {
      stringify: (set: Set<string>) => string,
      parse: (json: string) => Set<string>,
}

interface MapSerializer {
      stringify: (set: Map<string, number>) => string,
      parse: (json: string) => Map<string, number>,
}

export function getSetSerializer(): SetSerializer {

    return {
        stringify: (set: Set<string>) => JSON.stringify(Array.from(set)),
        parse: (json: string) => new Set(JSON.parse(json)),
    }
}

export function getMapSerializer(): MapSerializer {
    return {
        stringify: (map: Map<string, number>) => {
            return JSON.stringify(Array.from(map.entries()));
        },

        parse: (json: string) => {
            const map: Map<string, number> = new Map();
            const array: Array<string[]> = Array.from(JSON.parse(json));
            array.forEach((elem: string[]) => {
                map.set(elem[0], parseInt(elem[1]));
            });
            return map;
        },
    }
}
