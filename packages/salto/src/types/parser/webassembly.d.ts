// Until we find a better solution, this is from https://github.com/01alchemist/webassembly-types

/**
 * WebAssembly v1 (MVP) declaration file for TypeScript
 * Definitions by: 01alchemist (https://twitter.com/01alchemist)
 */
declare namespace WebAssembly {
  /**
   * WebAssembly.Memory
   * Note: A WebAssembly page has a constant size of 65,536 bytes, i.e., 64KiB.
   **/
  interface MemoryDescriptor {
    initial: number;
    maximum?: number;
  }

  /**
   * WebAssembly.Table
   **/
  interface TableDescriptor {
    element: "anyfunc",
    initial: number;
    maximum?: number;
  }

  function compile(bufferSource: ArrayBuffer | Uint8Array): Promise<Module>;

  interface ResultObject {
    module: Module;
    instance: Instance;
  }

  function instantiate(bufferSource: ArrayBuffer | Uint8Array, importObject?: any): Promise<ResultObject>;
  function instantiate(module: Module, importObject?: any): Promise<Instance>;

  function validate(bufferSource: ArrayBuffer | Uint8Array): boolean;
}
