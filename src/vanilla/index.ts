/**
 * Naive, pure JS implementation of core ui-router services
 *
 * @module vanilla
 */ /** */
import { UIRouter } from "../router";

import { services as coreservices } from "../common/coreservices";
import { $q } from "./$q";
import { $injector } from "./$injector";
import { hashHistory } from "./hashHistory";
import { browserHistory } from "./browserHistory";
import { HistoryImplementationPlugin, ServicesPlugin, HistoryImplementation } from "./interface";
import { extend } from "../common/common";

export { $q, $injector, hashHistory, browserHistory };

export function services(router: UIRouter): ServicesPlugin {
  coreservices.$injector = $injector;
  coreservices.$q = $q;
  
  return { name: "vanilla.services", $q, $injector };
}

const HistoryImplementationPluginFactory = (name: string, historyImpl: HistoryImplementation) =>
    (router: UIRouter) => {
      const { service, configuration } = historyImpl;
      extend(coreservices.location, service);
      extend(coreservices.locationConfig, configuration);

      return { name, service, configuration };
    };

export const hashLocation: (router: UIRouter) => HistoryImplementationPlugin =
    HistoryImplementationPluginFactory("vanilla.hashBangLocation", hashHistory);
export const pushStateLocation: (router: UIRouter) => HistoryImplementationPlugin =
    HistoryImplementationPluginFactory("vanilla.pushStateLocation", browserHistory);

