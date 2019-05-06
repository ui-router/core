/** @internalapi @module vanilla */ /** */
import { UIRouter } from '../../router';
import { MemoryLocationService } from '../locationServices';
import { MemoryLocationConfig } from '../locatonConfig';
import { BaseUrlPlugin } from './baseUrlPlugin';

/**
 * A UrlPlugin that doesn't have any browser support
 * This plugin stores the current URL in memory.
 * This UrlPlugin is useful for unit testing or server side rendering.
 * */
export class MemoryUrlPlugin extends BaseUrlPlugin {
  constructor(router: UIRouter) {
    super(router, 'vanilla.MemoryUrlPlugin', new MemoryLocationConfig(), new MemoryLocationService(router));
  }
}
