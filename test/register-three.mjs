import { registerHooks } from 'node:module';

// Test the same vendored Three.js module that the browser import map resolves.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: new URL('../three.js/build/three.module.js', import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  }
});
