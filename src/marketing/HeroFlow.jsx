import { Component, Suspense, lazy } from "react";

/**
 * Code-split boundary in front of the WebGL hero.
 *
 * three.js + gsap is by far the heaviest thing the site imports (~600 kB) and
 * it is strictly an enhancement: Hero already renders a DOM crossfade and only
 * mounts this when `glWanted`. Loading it lazily means a visitor gets the hero
 * image immediately and the WebGL layer fades in when it arrives.
 *
 * The real implementation lives in HeroFlowCanvas.jsx.
 */
const HeroFlowCanvas = lazy(() => import("./HeroFlowCanvas.jsx"));

/**
 * A failed chunk fetch must behave exactly like a failed WebGL init, otherwise
 * a flaky network would leave Hero waiting on an onReady that never comes.
 */
class ChunkBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("[HeroFlow] chunk failed to load, falling back to DOM hero", error);
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroFlow(props) {
  return (
    <ChunkBoundary onFail={props.onFail}>
      <Suspense fallback={null}>
        <HeroFlowCanvas {...props} />
      </Suspense>
    </ChunkBoundary>
  );
}
