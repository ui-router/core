/**
 * @internalapi
 * @module vanilla
 */
/** */
import { BrowserLocationConfig } from "./browserLocationConfig";
import { HashLocationService } from "./hashLocationService";
import { locationPluginFactory } from "./utils";
import { LocationPlugin, ServicesPlugin } from "./interface";
import { UIRouter } from "../router";
import { PushStateLocationService } from "./pushStateLocationService";
import { MemoryLocationService } from "./memoryLocationService";
import { MemoryLocationConfig } from "./memoryLocationConfig";
import { $injector } from "./injector";
import { $q } from "./q";
import { services } from "../common/coreservices";

export function servicesPlugin(router: UIRouter): ServicesPlugin {
  services.$injector = $injector;
  services.$q = $q;

  return { name: "vanilla.services", $q, $injector, dispose: () => null };
}

/** A `UIRouterPlugin` uses the browser hash to get/set the current location */
export const hashLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory('vanilla.hashBangLocation', false, HashLocationService, BrowserLocationConfig);

/** A `UIRouterPlugin` that gets/sets the current location using the browser's `location` and `history` apis */
export const pushStateLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.pushStateLocation", true, PushStateLocationService, BrowserLocationConfig);

/** A `UIRouterPlugin` that gets/sets the current location from an in-memory object */
export const memoryLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.memoryLocation", false, MemoryLocationService, MemoryLocationConfig);
