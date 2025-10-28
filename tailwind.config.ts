// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // 토글로 제어할 것이므로 'class' 전략. OS가 아니라 우리가 토글로 제어한다는 뜻
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
