import { BrowserLocationConfig } from './browserLocationConfig.js';
import { HashLocationService } from './hashLocationService.js';
import { locationPluginFactory } from './utils.js';
import { LocationPlugin, ServicesPlugin } from './interface.js';
import { UIRouter } from '../router.js';
import { PushStateLocationService } from './pushStateLocationService.js';
import { MemoryLocationService } from './memoryLocationService.js';
import { MemoryLocationConfig } from './memoryLocationConfig.js';
import { $injector } from './injector.js';
import { $q } from './q.js';
import { services } from '../common/coreservices.js';

export function servicesPlugin(router: UIRouter): ServicesPlugin {
  services.$injector = $injector;
  services.$q = $q;

  return { name: 'vanilla.services', $q, $injector, dispose: () => null };
}

/** A `UIRouterPlugin` uses the browser hash to get/set the current location */
export const hashLocationPlugin: (router: UIRouter) => LocationPlugin = locationPluginFactory(
  'vanilla.hashBangLocation',
  false,
  HashLocationService,
  BrowserLocationConfig
);

/** A `UIRouterPlugin` that gets/sets the current location using the browser's `location` and `history` apis */
export const pushStateLocationPlugin: (router: UIRouter) => LocationPlugin = locationPluginFactory(
  'vanilla.pushStateLocation',
  true,
  PushStateLocationService,
  BrowserLocationConfig
);

/** A `UIRouterPlugin` that gets/sets the current location from an in-memory object */
export const memoryLocationPlugin: (router: UIRouter) => LocationPlugin = locationPluginFactory(
  'vanilla.memoryLocation',
  false,
  MemoryLocationService,
  MemoryLocationConfig
);
