import { GONKA } from "@/config/chains";

// Keplr ChainInfo for the Gonka testnet. The non-standard coinType 1200 must be
// declared here so Keplr derives the same account the chain expects; getting
// this wrong is the address-mismatch fund-loss mode (see addressGuard.ts).
export const GONKA_CHAIN_INFO = {
  chainId: GONKA.chainId,
  chainName: "Gonka Testnet",
  rpc: GONKA.rpc,
  rest: GONKA.rest,
  bip44: { coinType: GONKA.coinType },
  bech32Config: {
    bech32PrefixAccAddr: GONKA.bech32Prefix,
    bech32PrefixAccPub: `${GONKA.bech32Prefix}pub`,
    bech32PrefixValAddr: `${GONKA.bech32Prefix}valoper`,
    bech32PrefixValPub: `${GONKA.bech32Prefix}valoperpub`,
    bech32PrefixConsAddr: `${GONKA.bech32Prefix}valcons`,
    bech32PrefixConsPub: `${GONKA.bech32Prefix}valconspub`,
  },
  currencies: [
    {
      coinDenom: GONKA.displayDenom.toUpperCase(),
      coinMinimalDenom: GONKA.baseDenom,
      coinDecimals: GONKA.denomExponent,
    },
  ],
  feeCurrencies: [
    {
      coinDenom: GONKA.displayDenom.toUpperCase(),
      coinMinimalDenom: GONKA.baseDenom,
      coinDecimals: GONKA.denomExponent,
      gasPriceStep: { low: 0, average: 0.025, high: 0.04 },
    },
  ],
  stakeCurrency: {
    coinDenom: GONKA.displayDenom.toUpperCase(),
    coinMinimalDenom: GONKA.baseDenom,
    coinDecimals: GONKA.denomExponent,
  },
  features: ["cosmwasm"],
};

export interface KeplrAccount {
  bech32Address: string;
  pubKey: Uint8Array;
}

/** Suggest + enable the Gonka chain in Keplr and return the active account. */
export async function connectKeplr(): Promise<KeplrAccount> {
  if (!window.keplr) {
    throw new Error("Keplr extension not found. Install Keplr to continue.");
  }
  await window.keplr.experimentalSuggestChain(GONKA_CHAIN_INFO);
  await window.keplr.enable(GONKA.chainId);
  const key = await window.keplr.getKey(GONKA.chainId);
  return { bech32Address: key.bech32Address, pubKey: key.pubKey as Uint8Array };
}
