import { defineConfig, presetWind3 } from "unocss";

export default defineConfig({
  theme: {
    colors: {
      dark: {
        DEFAULT: "#000B1A",
      },
      primary: {
        DEFAULT: "#00D897",
      },
    },
  },
  presets: [presetWind3()],
});
