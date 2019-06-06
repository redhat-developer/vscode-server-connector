export class Utils {

    public static async getKeyByValue<T>(map: Map<T, any>, value: any): Promise<T> {
        for (const [k, v] of map) {
            if (v === value) {
                return k;
            }
        }
    }
}
