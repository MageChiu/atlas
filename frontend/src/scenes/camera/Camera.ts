import { gsap } from 'gsap';
import type { Container } from 'pixi.js';

/**
 * F3.1 - Camera 抽象
 * 作用于一个 Pixi 容器（world container），通过移动/缩放该容器实现相机效果。
 * 所有动画统一走 GSAP；参数来自配置（F3.4），不写死。
 */
export interface CameraParams {
  /** 视口尺寸 */
  viewWidth: number;
  viewHeight: number;
  minZoom?: number;
  maxZoom?: number;
  duration?: number;
}

export interface FocusTarget {
  x: number;
  y: number;
  zoom?: number;
}

export class Camera {
  private container: Container;
  private params: Required<CameraParams>;

  constructor(container: Container, params: CameraParams) {
    this.container = container;
    this.params = {
      viewWidth: params.viewWidth,
      viewHeight: params.viewHeight,
      minZoom: params.minZoom ?? 0.5,
      maxZoom: params.maxZoom ?? 3,
      duration: params.duration ?? 0.8,
    };
  }

  updateParams(params: Partial<CameraParams>) {
    this.params = { ...this.params, ...params };
  }

  private clampZoom(zoom: number): number {
    return Math.min(this.params.maxZoom, Math.max(this.params.minZoom, zoom));
  }

  /** 缩放到指定倍率（围绕视口中心） */
  zoomTo(zoom: number, duration = this.params.duration): gsap.core.Tween {
    return gsap.to(this.container.scale, {
      x: this.clampZoom(zoom),
      y: this.clampZoom(zoom),
      duration,
      ease: 'power2.inOut',
    });
  }

  /** 平移使世界坐标点出现在视口中心 */
  panTo(target: { x: number; y: number }, duration = this.params.duration): gsap.core.Tween {
    const zoom = this.container.scale.x;
    return gsap.to(this.container.position, {
      x: this.params.viewWidth / 2 - target.x * zoom,
      y: this.params.viewHeight / 2 - target.y * zoom,
      duration,
      ease: 'power2.inOut',
    });
  }

  /** 聚焦目标：同时缩放并居中 */
  focusOn(target: FocusTarget, duration = this.params.duration): Promise<void> {
    const zoom = this.clampZoom(target.zoom ?? this.container.scale.x);
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => resolve() });
      tl.to(
        this.container.scale,
        { x: zoom, y: zoom, duration, ease: 'power2.inOut' },
        0,
      );
      tl.to(
        this.container.position,
        {
          x: this.params.viewWidth / 2 - target.x * zoom,
          y: this.params.viewHeight / 2 - target.y * zoom,
          duration,
          ease: 'power2.inOut',
        },
        0,
      );
    });
  }

  /**
   * F3.3 - 层级转场：进入(下钻)放大聚焦，回退(镜像)复位。
   * 回退动画是进入动画的镜像逻辑。
   */
  transitionTo(
    direction: 'enter' | 'back',
    target: FocusTarget,
    duration = this.params.duration,
  ): Promise<void> {
    if (direction === 'enter') {
      return this.focusOn(target, duration);
    }
    return this.focusOn(target, duration);
  }

  /** 复位视图：缩放归 1，回到原点 */
  resetView(duration = this.params.duration): Promise<void> {
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => resolve() });
      tl.to(this.container.scale, { x: 1, y: 1, duration, ease: 'power2.inOut' }, 0);
      tl.to(this.container.position, { x: 0, y: 0, duration, ease: 'power2.inOut' }, 0);
    });
  }

  /** 立即设置（无动画），用于初始化 */
  setImmediate(target: FocusTarget) {
    const zoom = this.clampZoom(target.zoom ?? 1);
    this.container.scale.set(zoom);
    this.container.position.set(
      this.params.viewWidth / 2 - target.x * zoom,
      this.params.viewHeight / 2 - target.y * zoom,
    );
  }
}
