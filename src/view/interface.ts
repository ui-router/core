import { UIRouterPlugin } from '../interface';
import { UIRouter } from '../router';
import { StateDeclaration, StateObject } from '../state';
import { _ViewDeclaration } from '../state/interface';
import { PathNode } from '../path/pathNode';

/** @internalapi */
export type ViewContext = StateObject;

/**
 * @internalapi
 *
 * The metadata around a ui-view component that registered itself with the view service.
 */
export interface RegisteredUIViewPortal {
  /** ui-view portal component type, e.g., 'react' or 'angular' */
  type: string;
  /** the id of the ui-view portal */
  id: string;
  /** the id of the parent ui-view portal, or null if the view is rendered at the root */
  parentId: string;
  /** the state which rendered the ui-view portal */
  portalState: StateObject;
  /**
   * The state of the content component currently loaded into the portal,
   * or null if no component is loaded into the portal
   */
  contentState?: StateObject;
  /** The ui-view short name, for named ui-views.  $default for unnamed ui-views */
  name: string;
  /** The fully qualified ui-view address, (i.e., `${parentview.fqn}.${name}` */
  fqn: string;
  /** The command most recently sent to the UIView */
  currentPortalCommand: UIViewPortalRenderCommand;
  /**
   * A callback that instructs the uiview portal what to render.
   * This function will be called whenever the uiview portal should change its contents, e.g., after a Transition.
   */
  renderContentIntoUIViewPortal(uiViewPortalRenderCommand: UIViewPortalRenderCommand): void;
}

interface RenderRoutedComponentCommand {
  uiViewId: string;
  portalState: StateDeclaration;
  contentState: StateDeclaration;
  command: 'RENDER_ROUTED_VIEW';
  routedViewConfig: ViewConfig;
}

interface RenderDefaultContentCommand {
  uiViewId: string;
  portalState: StateDeclaration;
  command: 'RENDER_DEFAULT_CONTENT';
}

interface RenderInteropDivCommand {
  uiViewId: string;
  portalState: StateDeclaration;
  command: 'RENDER_INTEROP_DIV';
  giveDiv: (div: HTMLDivElement) => void;
}

export type UIViewPortalRenderCommand =
  | RenderRoutedComponentCommand
  | RenderDefaultContentCommand
  | RenderInteropDivCommand;

export declare type RenderContentCallback = RegisteredUIViewPortal['renderContentIntoUIViewPortal'];

/** @deprecated @internalapi */
export interface ActiveUIView {
  /** type of framework, e.g., "ng1" or "ng2" */
  $type: string;
  /** An auto-incremented id */
  id: number | string;
  /** The ui-view short name */
  name: string;
  /** The ui-view's fully qualified name */
  fqn: string;
  /** The ViewConfig that is currently loaded into the ui-view */
  config: ViewConfig;
  /** The state context in which the ui-view tag was created. */
  creationContext: ViewContext;
  /** A callback that should apply a ViewConfig (or clear the ui-view, if config is undefined) */
  configUpdated: RenderContentCallback;
}

/**
 * This interface represents a [[_ViewDeclaration]] that is bound to a [[PathNode]].
 *
 * A `ViewConfig` is the runtime definition of a single view.
 *
 * During a transition, `ViewConfig`s are created for each [[_ViewDeclaration]] defined on each "entering" [[StateObject]].
 * Then, the [[ViewService]] finds any matching `ui-view`(s) in the DOM, and supplies the ui-view
 * with the `ViewConfig`.  The `ui-view` then loads itself using the information found in the `ViewConfig`.
 *
 * A `ViewConfig` if matched with a `ui-view` by finding all `ui-view`s which were created in the
 * context named by the `uiViewContextAnchor`, and finding the `ui-view` or child `ui-view` that matches
 * the `uiViewName` address.
 */
export interface ViewConfig {
  /* The unique id for the ViewConfig instance */
  $id: number;
  /** The normalized view declaration from [[State.views]] */
  viewDecl: _ViewDeclaration;

  /** The node the ViewConfig is bound to */
  path: PathNode[];

  loaded: boolean;

  /** Fetches templates, runs dynamic (controller|template)Provider code, lazy loads Components, etc */
  load(): Promise<ViewConfig>;
}

export interface UIRouterViewPlugin extends UIRouterPlugin {
  type: 'view';

  /**
   * This function is called by uirouter core when routing content into a UIView from a different type (component technology).
   * When called, the view implementation should render a UIView portal component into the provided divElement.
   *
   * This allows content from one technology to be rendered into the UIView of a different technology.
   * For example, an Angular component may be rendered into a React `<UIView/>` portal.
   *
   * The third argument is passed to the function if there are any ancestor UIViews of the same type (component technology).
   * This can be used to preserve the contextual hierarchy of the component technology, if it has one.
   *
   * For example, React has a Portals (https://reactjs.org/docs/portals.html) which allows React Context to
   * propagate across component technology jumps.
   * Angular has a hierarchical dependency injector.
   * Angular Components are created within the injector hierarchy.
   *
   * Consider a case where React renders a UIView portal.
   * The React UIView portal is filled with content from Angular which in turn renders an Angular UIView portal.
   *
   * When a react UIView renders an interop div, it can save a custom object containing a function that renders a
   * React Portal.
   *
   *
   * A UIView implementation of a particular type (i.e., fooType) may save an object when
   * The third argument will be the object saved by the *most recent UIView of the implementor component technology*.
   * @param router
   * @param divElement
   * @param buriedTreasure
   */
  renderUIViewIntoDivElement(router: UIRouter, divElement: HTMLDivElement, customDataFromAncestor: any);

  // createViewConfig();
}
