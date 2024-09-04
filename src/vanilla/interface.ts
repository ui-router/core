import { LocationConfig, LocationServices } from '../common/coreservices.js';
import { UIRouterPlugin } from '../interface.js';
import { $InjectorLike, $QLike } from '../common/index.js';

export interface LocationPlugin extends UIRouterPlugin {
  service: LocationServices;
  configuration: LocationConfig;
}

export interface ServicesPlugin extends UIRouterPlugin {
  $q: $QLike;
  $injector: $InjectorLike;
}

export interface LocationLike {
  hash: string;
  pathname: string;
  search: string;
}

export interface HistoryLike {
  back(distance?: any): void;
  forward(distance?: any): void;
  pushState(statedata: any, title?: string, url?: string): void;
  replaceState(statedata: any, title?: string, url?: string): void;
}
