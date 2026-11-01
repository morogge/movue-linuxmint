/// <reference types="vite/client" />
import type { MovueApi } from '../../preload/index';

declare global {
  interface Window {
    movue: MovueApi;
  }
}

export {};
