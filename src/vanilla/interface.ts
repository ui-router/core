import { LocationConfig, LocationServices } from '../common/coreservices';
import { UIRouterPlugin } from "../interface";
import { $InjectorLike, $QLike } from "../common/module";

export interface HistoryImplementation {
  service: LocationServices;
  configuration: LocationConfig;
}

export interface HistoryImplementationPlugin extends UIRouterPlugin, HistoryImplementation {

}

export interface ServicesPlugin extends UIRouterPlugin {
  $q: $QLike,
  $injector: $InjectorLike
}
