export interface ServerInfo {
    host: string;
    port: number;
}

export interface ServerAPI {
    startRSP(stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void ): Promise<ServerInfo>;
    stopRSP(): Promise<void>;
    onRSPServerStateChanged(listener: (state: number) => void): void;
    getHost(): string;
    getPort(): number;
}

export interface Extension<T> {

    /**
     * The canonical extension identifier in the form of: `publisher.name`.
     */
    readonly id: string;

    /**
     * The absolute file path of the directory containing this extension.
     */
    readonly extensionPath: string;

    /**
     * `true` if the extension has been activated.
     */
    readonly isActive: boolean;

    /**
     * The parsed contents of the extension's package.json.
     */
    readonly packageJSON: any;

    /**
     * The public API exported by this extension. It is an invalid action
     * to access this field before this extension has been activated.
     */
    readonly exports: T;

    /**
     * Activates this extension and returns its public API.
     *
     * @return A promise that will resolve when this extension has been activated.
     */
    activate(): Thenable<T>;
}