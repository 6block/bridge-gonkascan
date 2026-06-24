import { useCallback, useEffect, useState } from "react";
import { getReadProvider, readBridgeState, type BridgeState } from "@/lib/evm";
import { getBridgeAddresses, getCurrentGonkaEpoch, type BridgeAddressEntry } from "@/lib/gonka";
import { SEPOLIA } from "@/config/chains";

export interface BridgeStatus {
  bridge: BridgeState;
  gonkaEpoch: number | null;
  /** bridge epoch >= gonka epoch (or gonka unknown → treated as unknown). */
  epochInSync: boolean | null;
  registered: BridgeAddressEntry[];
}

interface State {
  data: BridgeStatus | null;
  loading: boolean;
  error: string | null;
}

export function useBridgeStatus(): State & { refresh: () => void } {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [bridge, gonkaEpoch, registered] = await Promise.all([
        readBridgeState(getReadProvider()),
        getCurrentGonkaEpoch(),
        getBridgeAddresses(SEPOLIA.registryKey),
      ]);
      const epochInSync =
        gonkaEpoch === null ? null : Number(bridge.latestEpochId) >= gonkaEpoch;
      setState({ data: { bridge, gonkaEpoch, epochInSync, registered }, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to read bridge status",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: () => void load() };
}
