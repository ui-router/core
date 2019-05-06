/** @internalapi @module vanilla */ /** */
import { UIRouter } from '../../router';
import { BaseUrlPlugin } from './baseUrlPlugin';
import { BrowserLocationConfig } from '../locatonConfig/browserLocationConfig';
import { HashLocationService } from '../locationServices/hashLocationService';

/** A UrlPlugin that updates the browsers hash */
export class HashUrlPlugin extends BaseUrlPlugin {
  constructor(router: UIRouter) {
    super(router, 'vanilla.hashBangLocation', new BrowserLocationConfig(), new HashLocationService(router));
  }
}
