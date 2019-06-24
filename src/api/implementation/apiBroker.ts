import { APIBroker, API } from "../contract/api";
import { api } from "./rspProviderAPI";
import { RSPProviderAPI } from "../contract/rspProviderAPI";

export function apiBroker(): APIBroker {
    return {
        get(): API<RSPProviderAPI> {
            return api();
        }
    };
}