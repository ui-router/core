/**
 * Naive, pure JS implementation of core ui-router services
 *
 * @internalapi @module vanilla
 */ /** */
import { UIRouter } from "../router";

import { services } from "../common/coreservices";
import { ServicesPlugin } from "./interface";
import { $q } from "./$q";
import { $injector } from "./$injector";

export { $q, $injector };

export function servicesPlugin(router: UIRouter): ServicesPlugin {
  services.$injector = $injector;
  services.$q = $q;

  return { name: "vanilla.services", $q, $injector, dispose: () => null };
}

export * from "./hashLocation";
export * from "./memoryLocation";
export * from "./pushStateLocation";
