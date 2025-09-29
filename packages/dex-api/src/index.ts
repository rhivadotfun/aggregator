import { SarosApi } from "./saros";
import { MeteoraApi } from "./meteora";

export { SarosApi, MeteoraApi };
export type { Chart } from "./saros/models";

export class DexApi {
  readonly saros: SarosApi;
  readonly meteora: MeteoraApi;

  constructor() {
    this.saros = new SarosApi("https://api.saros.xyz/api/");
    this.meteora = new MeteoraApi("https://dlmm-api.meteora.ag");
  }
}
