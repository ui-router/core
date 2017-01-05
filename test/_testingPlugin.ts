import { UIRouter } from "../src/router";
import { UIRouterPluginBase } from "../src/interface";
import * as vanilla from "../src/vanilla";
import { UrlService } from "../src/url/urlService";

export class TestingPlugin extends UIRouterPluginBase {
  name: string = 'testing';
  errorsCount: number = 0;
  errorsThreshold: number = 1000;

  constructor(public router: UIRouter) {
    super();
    router.plugin(vanilla.servicesPlugin);
    router.plugin(vanilla.memoryLocationPlugin);
    // bind the location proxy functions immediately
    router.urlService = new UrlService(router, false);

    this.addErrorLoopHandler();

    this.startRouter();
  }

  startRouter() {
    this.router.urlMatcherFactory.$get();
    if (!this.router.urlRouter.interceptDeferred) {
      this.router.urlRouter.listen();
    }
  }

  addErrorLoopHandler() {
    let $transitions = this.router.transitionService;
    $transitions.onCreate({}, trans => {
      trans.promise.catch(() => this.errorsCount++);
      if (this.errorsCount > this.errorsThreshold) {
        throw new Error(`Over ${this.errorsThreshold} failures; creation of new transitions disabled`);
      }
    });
  }
}
