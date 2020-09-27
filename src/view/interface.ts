import { UIRouterPlugin } from '../interface';
import { UIRouter } from '../router';
import { StateDeclaration, StateObject } from '../state';
import { _ViewDeclaration } from '../state/interface';
import { PathNode } from '../path/pathNode';

/** @internalapi */
export type ViewContext = StateObject;

/** Information about a uiview portal component registered the view service. */
export interface UIViewPortalRegistration {
  /** the id of the ui-view portal */
  id: string;

  /** the id of the parent ui-view portal, or null if the view is rendered at the root */
  parentId: string;

  /** ui-view portal component type, e.g., 'react' or 'angular' */
  type: string;

  /** The ui-view short name, for named ui-views. $default for unnamed ui-views */
  name: string;

  /** The state which rendered the ui-view portal */
  portalState: StateDeclaration;

  /** The current uiview portal content from the most recent command */
  portalContentType: PortalContentType;

  /**
   * The portal's current ViewConfig, or undefined.
   * A ViewConfig is only present when [[portalAction]] is equal to `RENDER_ROUTED_VIEW`
   */
  viewConfig?: ViewConfig;

  /**
   * The router state from in the [[viewConfig]], or undefined.
   * This state is the router state which has its component rendered in the uiview portal.
   */
  contentState?: StateDeclaration;
}

/** This object tells the UIView portal to render content */
interface RenderCommand {
  // The type of content to render
  portalContentType: PortalContentType;
  // Current details of the registered ui-view portal
  uiViewPortalRegistration: UIViewPortalRegistration;
}

interface RenderRoutedComponentCommand extends RenderCommand {
  portalContentType: typeof ROUTED_VIEW;
}

interface RenderDefaultContentCommand extends RenderCommand {
  portalContentType: typeof DEFAULT_CONTENT;
}

interface RenderInteropDivCommand extends RenderCommand {
  portalContentType: typeof INTEROP_DIV;
  giveDiv: (div: HTMLDivElement) => void;
}

export const INTEROP_DIV = 'RENDER_INTEROP_DIV';
export const DEFAULT_CONTENT = 'RENDER_DEFAULT_CONTENT';
export const ROUTED_VIEW = 'RENDER_ROUTED_VIEW';
export type PortalContentType = typeof INTEROP_DIV | typeof DEFAULT_CONTENT | typeof ROUTED_VIEW;

export type UIViewPortalRenderCommand =
  | RenderRoutedComponentCommand
  | RenderDefaultContentCommand
  | RenderInteropDivCommand;

/**
 * A callback provided by the uiview portal which instructs the portal what it should render.
 * This function will be called whenever the uiview portal should change its contents, e.g., after a Transition.
 */
export declare type PortalRenderCommandCallback = (uiViewPortalRenderCommand: UIViewPortalRenderCommand) => void;

/**
 * @internal
 *
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
