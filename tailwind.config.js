/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1016", well: "#0E141D", surface: "#141B26", raised: "#1C2635",
        line: "#263246", edge: "#33425E",
        text: "#E9EEF6", mute: "#93A1B5", faint: "#5C6B82",
        ember: "#FF5C38", emberSoft: "#FF8A66", emberDeep: "#D63E1E",
        amberGold: "#FFB454", mint: "#3DDC97", sky: "#5AB8E8", crit: "#F0665A",
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', "sans-serif"],
        body: ["Barlow", "system-ui", "sans-serif"],
      },
      boxShadow: { ember: "0 4px 24px -6px rgba(255,92,56,.45)" },
    },
  },
  plugins: [],
};
