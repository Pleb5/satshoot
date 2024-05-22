
export const BTCTroubleshootPubkey = 'e3244843f8ab6483827e305e5b9d7f61b9eb791aa274d2a36836f3999c767650';

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

export function percentile(arr:number[], val:number) {
    let count = 0;
    arr.forEach(v => {
        if (v < val) {
            count++;
        } else if (v == val) {
            count += 0.5;
        }
    });
    return Math.floor(100 * count / arr.length);
}
