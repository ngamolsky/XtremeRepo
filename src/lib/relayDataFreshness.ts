export const RELAY_DATA_INVALIDATED_EVENT = "relay-data:invalidated";

const relayDataMutationTools = new Set([
  "saveLegObservation",
  "deleteLegObservation",
]);

export const isRelayDataMutationTool = (toolName: string) =>
  relayDataMutationTools.has(toolName);

export const dispatchRelayDataInvalidated = () => {
  window.dispatchEvent(new Event(RELAY_DATA_INVALIDATED_EVENT));
};
