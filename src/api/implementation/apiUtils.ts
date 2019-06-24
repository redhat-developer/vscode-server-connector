import { API } from '../contract/api';
import { RSPProviderAPI } from '../contract/rspProviderAPI';

export function available(api: RSPProviderAPI): API<RSPProviderAPI> {
    return { available: true, api: api };
}
