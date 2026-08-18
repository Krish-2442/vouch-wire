import { Wallet } from '../models/wallet.model.js';

export const walletRepository = {
    findByWorkspaceAndCurrency: async (workspaceId, currency) => {
        return Wallet.findOne({ workspaceId, currency }).lean().exec();
    },

    upsertCredit: async (workspaceId, currency, amountMinor, session) => {
        return Wallet.findOneAndUpdate(
            { workspaceId, currency },
            {
                $inc: { availableAmountMinor: amountMinor },
                $setOnInsert: { workspaceId, currency },
            },
            { new: true, upsert: true, session },
        ).exec();
    },

    debitAvailableCreditEscrow: async (workspaceId, currency, amountMinor, session) => {
        return Wallet.findOneAndUpdate(
            { workspaceId, currency, availableAmountMinor: { $gte: amountMinor } },
            {
                $inc: {
                    availableAmountMinor: -amountMinor,
                    escrowedAmountMinor: amountMinor,
                },
            },
            { new: true, session },
        ).exec();
    },

    debitEscrow: async (workspaceId, currency, amountMinor, session) => {
        return Wallet.findOneAndUpdate(
            { workspaceId, currency, escrowedAmountMinor: { $gte: amountMinor } },
            {
                $inc: {
                    escrowedAmountMinor: -amountMinor,
                },
            },
            { new: true, session },
        ).exec();
    },
};
