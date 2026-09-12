export interface DeviceNetworkState {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

export function deviceHasNetwork(state: DeviceNetworkState): boolean {
  return Boolean(state.isConnected && state.isInternetReachable);
}

export function decideOnline(deviceConnected: boolean, serverReachable: boolean): boolean {
  return deviceConnected && serverReachable;
}
