function createWindowBackedConstant(name) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === Symbol.toStringTag) return name;
        const source = typeof window !== 'undefined' ? window[name] || {} : {};
        return source[prop];
      },
      has(_target, prop) {
        const source = typeof window !== 'undefined' ? window[name] || {} : {};
        return prop in source;
      },
      ownKeys() {
        const source = typeof window !== 'undefined' ? window[name] || {} : {};
        return Reflect.ownKeys(source);
      },
      getOwnPropertyDescriptor(_target, prop) {
        const source = typeof window !== 'undefined' ? window[name] || {} : {};
        if (!(prop in source)) return undefined;
        return {
          configurable: true,
          enumerable: true,
          value: source[prop],
          writable: false,
        };
      },
    }
  );
}

export const FATIGUE_CONFIG = createWindowBackedConstant('FATIGUE_CONFIG');
export const MUSCLE_LOAD_CONFIG = createWindowBackedConstant('MUSCLE_LOAD_CONFIG');
