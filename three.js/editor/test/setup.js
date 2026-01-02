/**
 * Vitest 测试环境设置
 */

// 模拟 signals 库
globalThis.signals = {
  Signal: class Signal {
    constructor() {
      this.listeners = [];
      this.active = true;
    }
    add(listener) {
      this.listeners.push(listener);
    }
    remove(listener) {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    }
    dispatch(...args) {
      if (!this.active) return;
      this.listeners.forEach(listener => listener(...args));
    }
  }
};

// 模拟 window.location
Object.defineProperty(globalThis, 'location', {
  value: {
    protocol: 'https:',
    search: '',
    href: 'https://localhost/',
  },
  writable: true,
});

// 模拟 fetch
globalThis.fetch = async (url) => {
  return {
    ok: true,
    json: async () => ({}),
  };
};

// 模拟 alert
globalThis.alert = (msg) => console.log('[Alert]', msg);

console.log('✅ Test environment setup complete');
