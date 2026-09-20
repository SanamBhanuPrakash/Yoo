/**
 * Adapter registry. Adding a source is: write the module, import it here.
 * @module sources
 */
import * as usgs from './usgs.js';
import * as openMeteo from './openMeteo.js';
import * as gdelt from './gdelt.js';
import * as opensky from './opensky.js';

export const ADAPTERS = Object.freeze([usgs, openMeteo, gdelt, opensky]);

/** Adapters that claim to support an assertion kind. */
export function adaptersFor(assertionKind) {
  return ADAPTERS.filter((a) => a.supports(assertionKind));
}

export function adapterById(id) {
  return ADAPTERS.find((a) => a.id === id) ?? null;
}
