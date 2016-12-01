import { LocationConfig, LocationServices } from '../common/coreservices';
import { UIRouterPlugin } from "../interface";
import { $InjectorLike, $QLike } from "../common/module";

export interface LocationPlugin extends UIRouterPlugin {
  service: LocationServices;
  configuration: LocationConfig;
}

export interface ServicesPlugin extends UIRouterPlugin {
  $q: $QLike,
  $injector: $InjectorLike
}
