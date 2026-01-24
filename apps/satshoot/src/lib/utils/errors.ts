export class DataLoadError extends Error {
    readonly details?: string;

    constructor(message: string, details?: string) {
        super(message);
        this.name = 'DataLoadError';
        this.details = details;
    }
}
