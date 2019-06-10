export class Utils {

    public static async getKeyByValueString<T>(map: Map<T, string>, value: string): Promise<T> {
        for (const [k, v] of map) {
            if (v.toLowerCase() === value.toLowerCase()) {
                return k;
            }
        }
    }
}
