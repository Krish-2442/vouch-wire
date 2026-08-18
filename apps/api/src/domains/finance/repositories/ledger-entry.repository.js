import { LedgerEntry } from '../models/ledger-entry.model.js';

export const ledgerEntryRepository = {
    create: async (data, session) => {
        const [entry] = await LedgerEntry.create([data], { session });
        return entry;
    },

    findByOperationKey: async (idempotencyScopeWorkspaceId, operationType, idempotencyKey) => {
        return LedgerEntry.find({ idempotencyScopeWorkspaceId, operationType, idempotencyKey })
            .sort({ createdAt: 1 })
            .lean()
            .exec();
    },
};
