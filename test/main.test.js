import { expect, test } from "vitest";
import * as datasync from '../src/main';

test('Apis is define', () => {
    expect(datasync.activeRequestCount).toBeDefined();
    expect(datasync.dataStore).toBeDefined();
    expect(datasync.hasError).toBeDefined();
    expect(datasync.interceptors).toBeDefined();
    expect(datasync.loadingHooks).toBeDefined();
    expect(datasync.messageState).toBeDefined();
    expect(datasync.paramCache).toBeDefined();
    expect(datasync.registerGetEndpoint).toBeDefined();
    expect(datasync.registerPostEndpoint).toBeDefined();
    expect(datasync.requestHandlers).toBeDefined();
    expect(datasync.setLoadingHooks).toBeDefined();
});