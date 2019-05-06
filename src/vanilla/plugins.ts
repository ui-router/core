/** @packageDocumentation @internalapi @module vanilla */
import { BrowserLocationConfig } from './locatonConfig/browserLocationConfig';
import { HashLocationService } from './locationServices/hashLocationService';
import { locationPluginFactory } from './utils';
import { LocationPlugin, ServicesPlugin } from './interface';
import { UIRouter } from '../router';
import { PushStateLocationService } from './locationServices/pushStateLocationService';
import { MemoryLocationService } from './locationServices/memoryLocationService';
import { MemoryLocationConfig } from './locatonConfig/memoryLocationConfig';
import { HashUrlPlugin, MemoryUrlPlugin, PushStateUrlPlugin } from './urlPlugins';

import { $injector } from './injector';
import { $q } from './q';
import { services } from '../common/coreservices';

export function servicesPlugin(router: UIRouter): ServicesPlugin {
  services.$injector = $injector;
  services.$q = $q;

  return { name: 'vanilla.services', $q, $injector, dispose: () => null };
}

/** @deprecated use HashLocationPlugin */
export const hashLocationPlugin = HashUrlPlugin;

/** @deprecated use PushStateUrlPlugin */
export const pushStateLocationPlugin = PushStateUrlPlugin;

/** @deprecated use MemoryUrlPlugin */
export const memoryLocationPlugin = MemoryUrlPlugin;
