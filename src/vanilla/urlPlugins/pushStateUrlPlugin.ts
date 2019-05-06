/** @internalapi @module vanilla */ /** */
import { PushStateLocationService } from '..';
import { UIRouter } from '../../router';
import { BaseUrlPlugin } from './baseUrlPlugin';
import { BrowserLocationConfig } from '../locatonConfig/browserLocationConfig';

/** A UrlPlugin that uses pushState APIs to updates the browsers url */
export class PushStateUrlPlugin extends BaseUrlPlugin {
  constructor(router: UIRouter) {
    super(router, 'vanilla.PushStateUrlPlugin', new BrowserLocationConfig(), new PushStateLocationService(router));
  }
}
