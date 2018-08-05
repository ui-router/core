import { UIRouter } from '../src/router';
import { UIRouterPluginBase } from '../src/interface';
import * as vanilla from '../src/vanilla';
import { UrlService } from '../src/url/urlService';

export class TestingPlugin extends UIRouterPluginBase {
  name = 'testing';
  errorsCount = 0;
  errorsThreshold = 1000;

  constructor(public router: UIRouter) {
    super();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.memoryLocationPlugin);
    this.addErrorLoopHandler();
    this.startRouter();
  }

  startRouter() {
    this.router.urlMatcherFactory.$get();
    if (!this.router.urlService.interceptDeferred) {
      this.router.urlService.listen();
    }
  }

  addErrorLoopHandler() {
    const $transitions = this.router.transitionService;
    $transitions.onCreate({}, trans => {
      trans.promise.catch(() => this.errorsCount++);
      if (this.errorsCount > this.errorsThreshold) {
        throw new Error(`Over ${this.errorsThreshold} failures; creation of new transitions disabled`);
      }
    });
  }
}
