import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  type FederatedPointerEvent,
} from 'pixi.js';
import { Camera } from '../camera/Camera';

/**
 * F2.5 / F3 - Scene Runtime
 * 封装 Pixi Application、世界容器与相机。
 * 提供按层级渲染节点的能力；所有节点从传入数据(接口/Mock)读取，不写死。
 */

export interface NodeDatum {
  id: string;
  label: string;
  x: number;
  y: number;
  /** 状态：影响样式（open/locked/coming_soon 等） */
  state?: 'active' | 'locked' | 'soon';
  /** 节点类型（前端局部标记，非契约）：区域可继续下钻，景点进入 Spot */
  kind?: 'region' | 'spot';
  color?: number;
  /** hover 浮层用的简介（可选） */
  subtitle?: string;
}

export interface SceneRuntimeOptions {
  width: number;
  height: number;
  background?: number;
}

export class SceneRuntime {
  readonly app: Application;
  readonly world: Container;
  readonly camera: Camera;
  private bg: Container;
  private bgSprite: Sprite | null = null;
  private bgToken = 0;
  private layer: Container;
  private onNodeClick?: (id: string) => void;
  private onNodeHover?: (id: string | null) => void;

  constructor(canvas: HTMLCanvasElement, opts: SceneRuntimeOptions) {
    this.app = new Application({
      view: canvas,
      width: opts.width,
      height: opts.height,
      background: opts.background ?? 0x0f1115,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.world = new Container();
    this.app.stage.addChild(this.world);

    // 底图层在最底层，节点层在其上
    this.bg = new Container();
    this.world.addChild(this.bg);

    this.layer = new Container();
    this.world.addChild(this.layer);

    this.camera = new Camera(this.world, {
      viewWidth: opts.width,
      viewHeight: opts.height,
    });
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
    this.camera.updateParams({ viewWidth: width, viewHeight: height });
  }

  setNodeClickHandler(handler: (id: string) => void) {
    this.onNodeClick = handler;
  }

  setNodeHoverHandler(handler: (id: string | null) => void) {
    this.onNodeHover = handler;
  }

  /**
   * TF-1 - 在 world 容器最底层设置地图底图 Sprite。
   * 尺寸 = mapSize；异步加载纹理，加载期间用 token 防止竞态覆盖。
   */
  async setBackground(url: string, size: { width: number; height: number }) {
    this.clearBackground();
    const token = this.bgToken;
    try {
      const texture = await Assets.load(url);
      if (token !== this.bgToken) return; // 已被后续调用取代
      const sprite = new Sprite(texture);
      sprite.width = size.width;
      sprite.height = size.height;
      sprite.position.set(0, 0);
      this.bgSprite = sprite;
      this.bg.addChild(sprite);
    } catch {
      // 底图加载失败：保持无底图（纯色背景），不崩溃
    }
  }

  /** 清除底图 */
  clearBackground() {
    this.bgToken++;
    this.bg.removeChildren();
    this.bgSprite = null;
  }

  /** 渲染一层节点（先清空再绘制，数据驱动）。
   * pin=true 时，景点(kind!=='region')渲染为地图图钉，子区域(kind==='region')渲染为圆形下钻入口。 */
  renderNodes(nodes: NodeDatum[], opts?: { drawPaths?: boolean; pin?: boolean }) {
    this.layer.removeChildren();

    if (opts?.drawPaths && nodes.length > 1) {
      const path = new Graphics();
      path.lineStyle(2, 0x2a2e38, 0.8);
      nodes.forEach((n, i) => {
        if (i === 0) path.moveTo(n.x, n.y);
        else path.lineTo(n.x, n.y);
      });
      this.layer.addChild(path);
    }

    for (const node of nodes) {
      const asPin = opts?.pin && node.kind !== 'region';
      this.layer.addChild(asPin ? this.buildPin(node) : this.buildNode(node));
    }
  }

  /**
   * TF-3 - 地图图钉：底部尖端对齐坐标 (x,y)，open/locked 区分配色。
   * hover 放大并通过 onNodeHover 通知上层显示浮层卡片。
   */
  private buildPin(node: NodeDatum): Container {
    const c = new Container();
    c.position.set(node.x, node.y);
    const interactive = node.state === 'active';
    c.eventMode = interactive ? 'static' : 'none';
    c.cursor = interactive ? 'pointer' : 'default';

    const headR = 16; // 圆头半径
    const tipY = 0; // 尖端在坐标点
    const headCY = -34; // 圆心相对尖端上移
    const fill =
      node.color ?? (node.state === 'active' ? 0xe8b04b : 0x5a6072);

    // 水滴形图钉：圆头 + 向下汇聚到尖端
    const pin = new Graphics();
    pin.beginFill(fill, node.state === 'active' ? 1 : 0.85);
    pin.lineStyle(3, 0xffffff, node.state === 'active' ? 0.95 : 0.4);
    pin.moveTo(0, tipY);
    pin.bezierCurveTo(-headR, headCY + headR, -headR, headCY - headR / 2, 0, headCY - headR);
    pin.bezierCurveTo(headR, headCY - headR / 2, headR, headCY + headR, 0, tipY);
    pin.endFill();
    // 圆头内圈
    pin.beginFill(0xffffff, node.state === 'active' ? 0.9 : 0.5);
    pin.drawCircle(0, headCY, headR * 0.42);
    pin.endFill();
    c.addChild(pin);

    if (node.state === 'locked' || node.state === 'soon') {
      const lock = new Text('🔒', new TextStyle({ fontSize: 14 }));
      lock.anchor.set(0.5);
      lock.position.set(0, headCY);
      c.addChild(lock);
    }

    const label = new Text(
      node.label,
      new TextStyle({
        fontSize: 13,
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
        stroke: 0x000000,
        strokeThickness: 3,
      }),
    );
    label.anchor.set(0.5, 0);
    label.position.set(0, 6);
    c.addChild(label);

    c.on('pointertap', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (interactive) this.onNodeClick?.(node.id);
    });
    c.on('pointerover', () => {
      c.scale.set(1.12);
      this.onNodeHover?.(node.id);
    });
    c.on('pointerout', () => {
      c.scale.set(1);
      this.onNodeHover?.(null);
    });

    return c;
  }

  private buildNode(node: NodeDatum): Container {
    const c = new Container();
    c.position.set(node.x, node.y);
    c.eventMode = node.state === 'locked' || node.state === 'soon' ? 'none' : 'static';
    c.cursor = 'pointer';

    const fill =
      node.color ??
      (node.state === 'locked' ? 0x3a3f4a : node.state === 'soon' ? 0x4a3f2a : 0xe8b04b);

    const g = new Graphics();
    g.beginFill(fill, node.state === 'active' ? 1 : 0.5);
    g.lineStyle(3, 0xffffff, node.state === 'active' ? 0.9 : 0.3);
    g.drawCircle(0, 0, 22);
    g.endFill();
    c.addChild(g);

    if (node.state === 'locked') {
      const lock = new Text('🔒', new TextStyle({ fontSize: 18 }));
      lock.anchor.set(0.5);
      c.addChild(lock);
    }

    const label = new Text(
      node.label,
      new TextStyle({
        fontSize: 14,
        fill: 0xffffff,
        fontFamily: 'system-ui, sans-serif',
        stroke: 0x000000,
        strokeThickness: 3,
      }),
    );
    label.anchor.set(0.5, 0);
    label.position.set(0, 30);
    c.addChild(label);

    if (c.eventMode === 'static') {
      c.on('pointertap', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        this.onNodeClick?.(node.id);
      });
      c.on('pointerover', () => {
        g.scale.set(1.12);
        this.onNodeHover?.(node.id);
      });
      c.on('pointerout', () => {
        g.scale.set(1);
        this.onNodeHover?.(null);
      });
    }

    return c;
  }

  destroy() {
    this.app.destroy(false, { children: true });
  }
}
