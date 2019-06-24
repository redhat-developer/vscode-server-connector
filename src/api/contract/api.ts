import { ExtensionAPI } from '../../extensionApi';
import { RSPProviderAPI } from './rspProviderAPI';

// The contents of this file are the core API contract used to discover actual
// component APIs.  We can add new component APIs, or change the way APIBroker
// works, but we *must* keep the APIBroker signature compatible.  Basically
// DON'T CHANGE ANYTHING IN THIS FILE unless you know how it's going to affect
// API clients at the discovery level.

export interface APIUnavailable {
    readonly available: false;
}

export interface APIAvailable<T> {
    readonly available: true;
    readonly api: T;
}

export type API<T> = APIAvailable<T> | APIUnavailable;

// The extension activate method must return one of these
export interface APIBroker extends ExtensionAPI {
    get(): API<RSPProviderAPI>;
}
