/**
 * Naive, pure JS implementation of core ui-router services
 *
 * @internalapi @module vanilla
 */ /** */
import { UIRouter } from "../router";

import { services, LocationServices, LocationConfig } from "../common/coreservices";
import { LocationPlugin, ServicesPlugin } from "./interface";
import { extend } from "../common/common";
import { hashLocationService, hashLocationConfig } from "./hashLocation";
import { pushStateLocationService, pushStateLocationConfig } from "./pushStateLocation";
import { $q } from "./$q";
import { $injector } from "./$injector";

export { $q, $injector };

export function servicesPlugin(router: UIRouter): ServicesPlugin {
  services.$injector = $injector;
  services.$q = $q;
  
  return { name: "vanilla.services", $q, $injector };
}

const locationPluginFactory = (name: string, service: LocationServices, configuration: LocationConfig) =>
    (router: UIRouter) => {
      extend(services.location, service);
      extend(services.locationConfig, configuration);
      return { name, service, configuration };
    };

export const hashLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.hashBangLocation", hashLocationService, hashLocationConfig);

export const pushStateLocationPlugin: (router: UIRouter) => LocationPlugin =
    locationPluginFactory("vanilla.pushStateLocation", pushStateLocationService, pushStateLocationConfig);

