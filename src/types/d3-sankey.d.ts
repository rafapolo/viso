/**
 * Ambient type declarations for d3-sankey
 * The package ships without bundled .d.ts files.
 */
declare module 'd3-sankey' {
  export interface SankeyNode<N = object, L = object> {
    index?: number;
    x0?: number;
    x1?: number;
    y0?: number;
    y1?: number;
    value?: number;
    depth?: number;
    height?: number;
    layer?: number;
    name?: string;
    sourceLinks?: SankeyLink<N, L>[];
    targetLinks?: SankeyLink<N, L>[];
    [key: string]: unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface SankeyLink<N = object, L = object> {
    source: N | number | string;
    target: N | number | string;
    value: number;
    y0?: number;
    y1?: number;
    width?: number;
    index?: number;
    [key: string]: unknown;
  }

  export interface SankeyGraph<N = object, L = object> {
    nodes: SankeyNode<N, L>[];
    links: SankeyLink<N, L>[];
  }

  export interface SankeyLayout<N = object, L = object> {
    (graph: SankeyGraph<N, L>): SankeyGraph<N, L>;
    nodeId(): (node: SankeyNode<N, L>) => string | number;
    nodeId(id: (node: SankeyNode<N, L>) => string | number): this;
    nodeAlign(): (node: SankeyNode<N, L>, n: number) => number;
    nodeAlign(align: (node: SankeyNode<N, L>, n: number) => number): this;
    nodeWidth(): number;
    nodeWidth(width: number): this;
    nodePadding(): number;
    nodePadding(padding: number): this;
    extent(): [[number, number], [number, number]];
    extent(extent: [[number, number], [number, number]]): this;
    size(): [number, number];
    size(size: [number, number]): this;
    iterations(): number;
    iterations(iterations: number): this;
    nodes(): (graph: SankeyGraph<N, L>) => SankeyNode<N, L>[];
    nodes(nodes: (graph: SankeyGraph<N, L>) => SankeyNode<N, L>[]): this;
    links(): (graph: SankeyGraph<N, L>) => SankeyLink<N, L>[];
    links(links: (graph: SankeyGraph<N, L>) => SankeyLink<N, L>[]): this;
  }

  export function sankey<N = object, L = object>(): SankeyLayout<N, L>;

  export function sankeyLeft(node: SankeyNode, n: number): number;
  export function sankeyRight(node: SankeyNode, n: number): number;
  export function sankeyCenter(node: SankeyNode, n: number): number;
  export function sankeyJustify(node: SankeyNode, n: number): number;

  export function sankeyLinkHorizontal(): (link: SankeyLink) => string | null;
}
